const express = require("express");
const router = express.Router();
const { CaseReport, Prediction } = require("../models");
const publish = require("../utils/publisher");
const { notifyUsersOfPrediction } = require("../utils/mailer");

const { authMiddleware } = require("../utils/auth");

// Debug endpoint
router.post("/reports/debug", express.json(), (req, res) => {
  const json_data = req.body;
  try {
    const types = {};
    Object.entries(json_data || {}).forEach(
      ([k, v]) =>
        (types[k] = Array.isArray(v) ? "array" : v === null ? "null" : typeof v)
    );
    return res.json({
      received_data: json_data,
      data_types: types,
      expected_schema: {
        reporter_type: "string",
        reporter_id: "string",
        patient_age: "integer",
        sex: "string (M/F/O)",
        lat: "float",
        lng: "float",
        symptoms: "array of strings",
        reported_at: "datetime (ISO format)",
      },
    });
  } catch (e) {
    return res.json({ error: e.message, raw_body: JSON.stringify(req.body) });
  }
});

/**
 * Analyze health report and determine risk level based on symptoms
 * @param {object} report - Health report with symptoms
 * @returns {object} - Risk analysis result
 */
function analyzeReportRisk(report) {
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [];
  
  // High-risk symptoms indicating potential water-borne diseases
  const highRiskSymptoms = [
    'severe diarrhea', 'diarrhea', 'bloody stool', 'bloody diarrhea',
    'dehydration', 'severe dehydration', 'cholera', 'typhoid',
    'dysentery', 'hepatitis', 'severe vomiting', 'high fever with diarrhea'
  ];
  
  // Medium-risk symptoms
  const mediumRiskSymptoms = [
    'nausea', 'vomiting', 'stomach cramps', 'abdominal pain',
    'mild fever', 'fatigue', 'weakness', 'headache', 'loss of appetite'
  ];
  
  // Normalize symptoms for comparison
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
  
  // Count matching symptoms
  const highRiskMatches = normalizedSymptoms.filter(s => 
    highRiskSymptoms.some(hrs => s.includes(hrs) || hrs.includes(s))
  ).length;
  
  const mediumRiskMatches = normalizedSymptoms.filter(s => 
    mediumRiskSymptoms.some(mrs => s.includes(mrs) || mrs.includes(s))
  ).length;
  
  // Determine risk level
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
  
  return {
    riskLevel,
    confidence,
    reasoning,
    highRiskSymptoms: highRiskMatches,
    mediumRiskSymptoms: mediumRiskMatches
  };
}

/**
 * Create prediction and send email notification if HIGH RISK
 * @param {object} report - Created health report
 * @param {object} analysis - Risk analysis result
 */
async function createPredictionAndNotify(report, analysis) {
  try {
    // Only create prediction and notify for HIGH RISK cases
    if (analysis.riskLevel !== 'high') {
      console.log(`📊 Report ${report._id}: Risk level is ${analysis.riskLevel} - no alert needed`);
      return null;
    }
    
    console.log(`🚨 HIGH RISK REPORT DETECTED: ${report._id}`);
    
    // Create prediction record
    const predictionData = {
      predictionType: "Water-Borne Disease Case",
      location: report.location || `Coordinates: (${report.lat}, ${report.lng})`,
      riskLevel: analysis.riskLevel,
      predictedDate: report.reported_at || new Date(),
      details: `URGENT: High-risk case reported with ${analysis.highRiskSymptoms} critical symptoms. ` +
               `${analysis.reasoning} Patient age: ${report.patient_age || 'Unknown'}, ` +
               `Sex: ${report.sex || 'Unknown'}. Symptoms: ${Array.isArray(report.symptoms) ? report.symptoms.join(', ') : report.symptoms}.`,
      recommendations: [
        "Immediate medical attention required for patient",
        "Test water source in affected area immediately",
        "Do NOT drink tap water until testing is complete",
        "Boil all water for at least 1 minute before use",
        "Monitor for additional cases in the area",
        "Report any similar symptoms to health authorities",
        "Consider temporary water supply alternatives"
      ],
      confidence: analysis.confidence,
      modelVersion: "symptom-analyzer-v1.0",
      lat: report.lat,
      lng: report.lng,
      relatedReportId: report._id
    };
    
    // Save prediction to database
    const prediction = await Prediction.create(predictionData);
    console.log(`✅ Prediction created: ${prediction._id}`);
    
    // Send email notification to all users
    console.log(`📧 Triggering email notifications for HIGH RISK case...`);
    const notificationResult = await notifyUsersOfPrediction(prediction);
    
    if (notificationResult.success && notificationResult.count > 0) {
      console.log(`✅ Email alerts sent to ${notificationResult.count} users`);
    } else {
      console.log(`⚠️  Email notification result: ${notificationResult.message}`);
    }
    
    return {
      prediction,
      notification: notificationResult
    };
    
  } catch (error) {
    console.error(`❌ Error creating prediction/notification:`, error);
    // Don't fail the report submission if prediction fails
    return null;
  }
}

async function normalizeAndCreateReport(body) {
  const report = Object.assign({}, body);
  // symptoms: allow string (comma separated) or array
  if (typeof report.symptoms === "string") {
    report.symptoms = report.symptoms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // sex normalization
  if (typeof report.sex === "string") {
    const s = report.sex.toUpperCase();
    if (["MALE", "M"].includes(s)) report.sex = "M";
    else if (["FEMALE", "F"].includes(s)) report.sex = "F";
    else if (["OTHER", "O"].includes(s)) report.sex = "O";
  }
  // reported_at string -> Date
  if (typeof report.reported_at === "string") {
    const date = new Date(report.reported_at);
    if (!isNaN(date)) report.reported_at = date;
  }
  // final create
  const obj = await CaseReport.create(report);
  return obj;
}

router.post("/report", authMiddleware, async (req, res) => {
  try {
    const obj = await normalizeAndCreateReport(req.body);
    await publish("case_reports", { id: obj._id });
    
    // 🚨 NEW: Analyze report and send email if HIGH RISK
    const analysis = analyzeReportRisk(obj);
    console.log(`📊 Report ${obj._id} - Risk: ${analysis.riskLevel}, Confidence: ${analysis.confidence}%`);
    
    const predictionResult = await createPredictionAndNotify(obj, analysis);
    
    // Include analysis in response
    const response = { 
      status: "accepted", 
      id: obj._id,
      riskAnalysis: {
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        emailSent: predictionResult ? (predictionResult.notification?.count > 0) : false
      }
    };
    
    if (predictionResult && predictionResult.notification?.count > 0) {
      response.notification = {
        message: `🚨 HIGH RISK: Email alert sent to ${predictionResult.notification.count} users`,
        predictionId: predictionResult.prediction._id
      };
    }
    
    return res.json(response);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating report", detail: e.message });
  }
});

router.post("/reports", authMiddleware, async (req, res) => {
  try {
    const obj = await normalizeAndCreateReport(req.body);
    await publish("case_reports", { id: obj._id });
    
    // 🚨 NEW: Analyze report and send email if HIGH RISK
    const analysis = analyzeReportRisk(obj);
    console.log(`📊 Report ${obj._id} - Risk: ${analysis.riskLevel}, Confidence: ${analysis.confidence}%`);
    
    const predictionResult = await createPredictionAndNotify(obj, analysis);
    
    // Include analysis in response
    const response = { 
      status: "accepted", 
      id: obj._id,
      riskAnalysis: {
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        emailSent: predictionResult ? (predictionResult.notification?.count > 0) : false
      }
    };
    
    if (predictionResult && predictionResult.notification?.count > 0) {
      response.notification = {
        message: `🚨 HIGH RISK: Email alert sent to ${predictionResult.notification.count} users`,
        predictionId: predictionResult.prediction._id
      };
    }
    
    return res.json(response);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating report", detail: e.message });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip || "0", 10) || 0;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 10000); // 🔑 Increased to 10,000
    const filter = {};
    if (req.query.reporter_id) {
      filter.reporter_id = req.query.reporter_id;
    }
    const docs = await CaseReport.find(filter).skip(skip).limit(limit).lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error fetching reports", detail: e.message });
  }
});

module.exports = router;
