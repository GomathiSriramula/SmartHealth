const axios = require('axios');

// ML Predictor helper for SmartHealth ML integration

const RISK_RANK = { low: 0, medium: 1, high: 2 };
const SEVERITY_FLOOR = {
  critical: { riskLevel: 'high', confidence: 90 },
  severe: { riskLevel: 'high', confidence: 80 },
};

/**
 * Severity acts as a FLOOR, never a ceiling: a reporter marking a case
 * "Critical"/"Severe" must escalate risk to HIGH regardless of what the
 * underlying model (ML or rule-based) predicted from symptoms alone — a
 * clinician's direct judgement shouldn't be silently overridden just
 * because the model's symptom/severity correlation wasn't strong enough
 * to clear the HIGH threshold on its own. Applied uniformly to BOTH
 * prediction paths so this guarantee holds whether or not the ML service
 * is reachable.
 */
function applySeverityFloor(riskLevel, confidence, reasoning, severity) {
  const severityKey = typeof severity === 'string' ? severity.toLowerCase().trim() : '';
  const floor = SEVERITY_FLOOR[severityKey];
  if (!floor) return { riskLevel, confidence, reasoning };

  if (RISK_RANK[floor.riskLevel] > RISK_RANK[riskLevel]) {
    return {
      riskLevel: floor.riskLevel,
      confidence: Math.max(confidence, floor.confidence),
      reasoning: `Severity marked as "${severity}" by reporter — escalated to ${floor.riskLevel.toUpperCase()} regardless of model output. ${reasoning}`,
    };
  }

  return { riskLevel, confidence: Math.max(confidence, floor.confidence), reasoning };
}

function analyzeReportRiskRuleBased(report) {
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [];
  const highRiskSymptoms = [
    'severe diarrhea', 'diarrhea', 'bloody stool', 'bloody diarrhea',
    'dehydration', 'severe dehydration', 'cholera', 'typhoid',
    'dysentery', 'hepatitis', 'severe vomiting', 'high fever with diarrhea'
  ];
  const mediumRiskSymptoms = [
    'nausea', 'vomiting', 'stomach cramps', 'abdominal pain',
    'mild fever', 'fatigue', 'weakness', 'headache', 'loss of appetite'
  ];

  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
  const highRiskMatches = normalizedSymptoms.filter(s =>
    highRiskSymptoms.some(hrs => s.includes(hrs) || hrs.includes(s))
  ).length;
  const mediumRiskMatches = normalizedSymptoms.filter(s =>
    mediumRiskSymptoms.some(mrs => s.includes(mrs) || mrs.includes(s))
  ).length;

  let riskLevel = 'low';
  let confidence = 50;
  let reasoning = '';

  if (highRiskMatches >= 2) {
    riskLevel = 'high';
    confidence = Math.min(85 + (highRiskMatches * 5), 98);
    reasoning = `Multiple high-risk symptoms detected: ${highRiskMatches} severe indicators of water-borne disease.`;
  } else if (highRiskMatches === 1) {
    riskLevel = 'high';
    confidence = 75 + (mediumRiskMatches * 3);
    reasoning = `Critical symptom detected with ${mediumRiskMatches} supporting symptoms.`;
  } else if (mediumRiskMatches >= 3) {
    riskLevel = 'medium';
    confidence = 65 + (mediumRiskMatches * 2);
    reasoning = `Multiple moderate symptoms suggesting possible water-borne illness.`;
  } else if (mediumRiskMatches >= 1) {
    riskLevel = 'low';
    confidence = 50 + (mediumRiskMatches * 5);
    reasoning = `Mild symptoms detected. Monitoring recommended.`;
  } else {
    riskLevel = 'low';
    confidence = 40;
    reasoning = `No specific water-borne disease symptoms identified.`;
  }

  const floored = applySeverityFloor(riskLevel, confidence, reasoning, report.severity);

  return {
    riskLevel: floored.riskLevel,
    confidence: floored.confidence,
    reasoning: floored.reasoning,
    highRiskSymptoms: highRiskMatches,
    mediumRiskSymptoms: mediumRiskMatches,
    severity: report.severity || null,
  };
}

async function getPredictionWithFallback(report) {
  const serviceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5005';
  try {
    console.log(`🤖 [ML Predictor] Requesting ML risk assessment from ${serviceUrl}/predict...`);
    const payload = {
      patient_age: report.patient_age,
      sex: report.sex,
      severity: report.severity,
      symptoms: Array.isArray(report.symptoms) ? report.symptoms : []
    };
    
    const response = await axios.post(`${serviceUrl}/predict`, payload, { timeout: 3000 });
    
    if (response.status === 200 && response.data) {
      const mlData = response.data;
      console.log(`✅ [ML Predictor] ML prediction successful. Risk: ${mlData.riskLevel}, Confidence: ${mlData.confidence}%`);

      const floored = applySeverityFloor(
        (mlData.riskLevel || 'low').toLowerCase(),
        mlData.confidence,
        mlData.reasoning,
        report.severity
      );

      return {
        riskLevel: floored.riskLevel,
        confidence: floored.confidence,
        reasoning: floored.reasoning,
        topFactors: mlData.topFactors || [],
        modelVersion: mlData.modelVersion || 'random-forest-v1.0',
        highRiskSymptoms: 0,
        mediumRiskSymptoms: 0,
        severity: report.severity || null,
        isML: true
      };
    }
  } catch (error) {
    console.warn(`⚠️ [ML Predictor] ML service call failed (${error.message}). Falling back to rule-based logic.`);
  }
  
  // Fallback to rule-based
  const ruleAnalysis = analyzeReportRiskRuleBased(report);
  return {
    ...ruleAnalysis,
    topFactors: [],
    reasoning: ruleAnalysis.reasoning,
    modelVersion: 'symptom-analyzer-v1.0',
    isML: false
  };
}

module.exports = {
  getPredictionWithFallback,
  analyzeReportRiskRuleBased
};
