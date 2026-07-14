const express = require("express");
const router = express.Router();
const { CaseReport, Prediction } = require("../models");
const publish = require("../utils/publisher");
const { notifyUsersOfPrediction } = require("../utils/mailer");
const { checkForAlerts } = require("../services/alertChecker");

const { authMiddleware, buildDistrictFilter, getUserDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");

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
 * AND the reporter-selected severity ("Mild"/"Moderate"/"Severe"/"Critical").
 *
 * Severity acts as a FLOOR, never a ceiling: if symptom-keyword analysis
 * already produced a higher risk level, that stands. But "Severe"/"Critical"
 * severity will escalate risk to HIGH even if the free-text symptom list
 * doesn't happen to match the hardcoded keyword list below — a reporter's
 * direct clinical judgement shouldn't be silently ignored.
 *
 * @param {object} report - Health report with symptoms + severity
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

  // Determine risk level from symptoms
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

  // 🔑 Factor in the reporter-selected severity as a floor on risk level.
  // "Critical" and "Severe" escalate to HIGH even if symptom keywords alone
  // wouldn't have gotten there. Severity can only push risk UP, never down —
  // a HIGH from symptom analysis is never downgraded because someone picked
  // "Mild" by mistake.
  const rank = { low: 0, medium: 1, high: 2 };
  const severityFloor = {
    critical: { riskLevel: 'high', confidence: 90 },
    severe: { riskLevel: 'high', confidence: 80 },
  };

  const severityKey = typeof report.severity === 'string' ? report.severity.toLowerCase().trim() : '';
  const floor = severityFloor[severityKey];

  if (floor && rank[floor.riskLevel] > rank[riskLevel]) {
    reasoning = `Severity marked as "${report.severity}" by reporter — escalated to ${floor.riskLevel.toUpperCase()} regardless of symptom keyword match. ${reasoning}`;
    riskLevel = floor.riskLevel;
    confidence = Math.max(confidence, floor.confidence);
  } else if (floor) {
    // Symptom analysis already reached this level or higher — just make sure
    // confidence reflects the reporter's severity input too.
    confidence = Math.max(confidence, floor.confidence);
  }

  return {
    riskLevel,
    confidence,
    reasoning,
    highRiskSymptoms: highRiskMatches,
    mediumRiskSymptoms: mediumRiskMatches,
    severity: report.severity || null,
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
      console.log(`📊 [Case Report Prediction] Report ${report._id}: Risk level is ${analysis.riskLevel} - no prediction triggered`);
      return null;
    }

    console.log(`🚨 [Case Report Prediction] HIGH RISK CASE DETECTED: ${report._id} - Triggering prediction...`);

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
    console.log(`✅ [Case Report Prediction] Prediction created: ${prediction._id}`);

    // 🚨 Check for alerts (now triggers on a single HIGH-risk prediction — see alertChecker.js)
    let alertResult = null;
    try {
      alertResult = await checkForAlerts(prediction);

      if (alertResult.action === 'created') {
        console.log(`🚨 [Case Report Alert] Alert CREATED from disease case: ${alertResult.message}`);
      } else if (alertResult.action === 'resolved') {
        console.log(`✅ [Case Report Alert] Alert RESOLVED: ${alertResult.message}`);
      } else {
        console.log(`⏳ [Case Report Alert] Alert check: ${alertResult.message}`);
      }
    } catch (alertError) {
      console.error(`⚠️  [Case Report Alert] Alert check failed (non-blocking):`, alertError.message);
    }

    // Send email notification to all users
    console.log(`📧 [Case Report Prediction] Sending email alerts for HIGH RISK case...`);
    const notificationResult = await notifyUsersOfPrediction(prediction);

    if (notificationResult.success && notificationResult.count > 0) {
      console.log(`✅ [Case Report Prediction] Email alerts sent to ${notificationResult.count} users`);
    } else {
      console.log(`⚠️  [Case Report Prediction] Email notification result: ${notificationResult.message}`);
    }

    return {
      prediction,
      notification: notificationResult,
      alert: alertResult
    };

  } catch (error) {
    console.error(`❌ [Case Report Prediction] Error creating prediction/notification:`, error);
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

router.post("/report", authMiddleware, locationGuard(), async (req, res) => {
  try {
    const obj = await normalizeAndCreateReport(req.body);
    await publish("case_reports", { id: obj._id });

    // 🚨 Analyze report for disease risk and trigger prediction if HIGH RISK
    const analysis = analyzeReportRisk(obj);
    console.log(`📊 [Case Report] Report ${obj._id} created - Risk: ${analysis.riskLevel}, Confidence: ${analysis.confidence}%`);

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

router.post("/reports", authMiddleware, locationGuard(), async (req, res) => {
  try {
    const reportBody = { ...req.body };
    if (!reportBody.location) {
      reportBody.location = getUserDistrict(req.user) || reportBody.location;
    }


    const obj = await normalizeAndCreateReport(reportBody);
    await publish("case_reports", { id: obj._id });

    // 🚨 Analyze report for disease risk and trigger prediction if HIGH RISK
    const analysis = analyzeReportRisk(obj);
    console.log(`📊 [Case Report] Report ${obj._id} created - Risk: ${analysis.riskLevel}, Confidence: ${analysis.confidence}%`);

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

router.get("/reports", authMiddleware, async (req, res) => {
  try {
    const skip = parseInt(req.query.skip || "0", 10) || 0;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 10000); // 🔑 Increased to 10,000
    const filter = buildDistrictFilter(req.user);
    // const filter = buildDistrictFilter(req.user, "district");
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