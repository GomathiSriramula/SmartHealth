const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { CaseReport, Prediction } = require("../models");
const publish = require("../utils/publisher");
const { checkForAlerts } = require("../services/alertChecker");
const { getPredictionWithFallback } = require("../utils/mlPredictor");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

const { authMiddleware, requireRole, buildDistrictFilter, getUserDistrict, operatorMatchesDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");
const { logAudit } = require("../utils/auditLogger");

// Fields any permitted editor (ADMIN or OPERATOR-in-district) may change.
const EDITABLE_REPORT_FIELDS = [
  "reporter_type",
  "patient_age",
  "sex",
  "symptoms",
  "severity",
  "remarks",
  "reported_at",
  "lat",
  "lng",
];

// Fields that move a report between districts — only ADMIN may touch these.
// OPERATORs are scoped to their own district and must never be able to
// relocate a report out of (or into) it.
const ADMIN_ONLY_REPORT_FIELDS = ["location", "village_area"];

function normalizeForCompare(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

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
    const hasValidCoords = typeof report.lat === 'number' && typeof report.lng === 'number'
      && !Number.isNaN(report.lat) && !Number.isNaN(report.lng);
    const predictionData = {
      predictionType: "Water-Borne Disease Case",
      location: report.location || (hasValidCoords ? `Coordinates: (${report.lat}, ${report.lng})` : 'Unknown'),
      riskLevel: analysis.riskLevel,
      predictedDate: report.reported_at || new Date(),
      details: `URGENT: High-risk case reported. ` +
        `${analysis.reasoning} Patient age: ${report.patient_age || 'Unknown'}, ` +
        `Sex: ${report.sex || 'Unknown'}. Symptoms: ${Array.isArray(report.symptoms) ? report.symptoms.join(', ') : report.symptoms}.` +
        (analysis.topFactors && analysis.topFactors.length > 0 ? ` Top Contributing Factors: ${analysis.topFactors.join(', ')}.` : ''),
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
      modelVersion: analysis.modelVersion || "symptom-analyzer-v1.0",
      topFactors: analysis.topFactors || [],
      reasoning: analysis.reasoning || "",
      lat: report.lat,
      lng: report.lng,
      relatedReportId: report._id
    };

    // Save prediction to database
    const prediction = await Prediction.create(predictionData);
    console.log(`✅ [Case Report Prediction] Prediction created: ${prediction._id}`);

    // 🚨 Check for alerts. Note: this requires TWO consecutive HIGH-risk
    // predictions at the same location before an Alert is actually created —
    // see ALERT_THRESHOLD in services/alertChecker.js. A single HIGH-risk
    // report/prediction alone will NOT create an alert or send an email.
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

    // 🔑 checkForAlerts() itself sends the "alert created" email (see
    // alertChecker.js) and returns the outcome on `notification`. This
    // function must NOT send its own follow-up email — doing so used to
    // double-send (a differently-styled "High Risk Detected" email on top
    // of checkForAlerts()'s own "Outbreak Alert" email) to the same
    // admins/operator every time a report triggered a new alert.
    let notificationResult = { success: false, count: 0, skipped: true, message: 'No new alert — notification skipped' };
    if (alertResult && alertResult.action === 'created') {
      notificationResult = alertResult.notification || { success: false, message: 'No notification result returned' };
      if (notificationResult.success) {
        console.log(`✅ [Case Report Prediction] Email alerts sent for newly created alert`);
      } else {
        console.log(`⚠️  [Case Report Prediction] Email notification result: ${notificationResult.message}`);
      }
    } else {
      console.log(`📭 [Case Report Prediction] Skipping email — ${alertResult ? `alert action was "${alertResult.action}"` : 'no alert result'}`);
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

// 🔑 FIX: /report (singular, legacy alias of /reports) previously skipped
// the operator-district auto-fill that /reports has. That meant a report
// submitted here by an OPERATOR without an explicit `location` would save
// with no district and silently disappear from that operator's own
// district-filtered Dashboard/Reports/Alerts views. Now matches /reports.
router.post("/report", authMiddleware, requireRole('ADMIN', 'OPERATOR'), locationGuard(), async (req, res) => {
  try {
    const reportBody = { ...req.body };
    if (!reportBody.location) {
      reportBody.location = getUserDistrict(req.user) || reportBody.location;
    }

    const obj = await normalizeAndCreateReport(reportBody);
    await publish("case_reports", { id: obj._id });

    // 🚨 Analyze report for disease risk using ML service (falling back to rule-based analysis)
    const analysis = await getPredictionWithFallback(obj);
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

router.post("/reports", authMiddleware, requireRole('ADMIN', 'OPERATOR'), locationGuard(), async (req, res) => {
  try {
    const reportBody = { ...req.body };
    if (!reportBody.location) {
      reportBody.location = getUserDistrict(req.user) || reportBody.location;
    }


    const obj = await normalizeAndCreateReport(reportBody);
    await publish("case_reports", { id: obj._id });

    // 🚨 Analyze report for disease risk using ML service (falling back to rule-based analysis)
    const analysis = await getPredictionWithFallback(obj);
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
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 10000);
    const filter = buildDistrictFilter(req.user);
    if (req.query.reporter_id) {
      filter.reporter_id = req.query.reporter_id;
    }
    // 🔑 FIX: sort newest-first by created_at. Without an explicit sort,
    // Mongo does not guarantee any particular order — it's typically close
    // to insertion order in practice, but that's not reliable, and it's
    // definitely not "most recent first". The frontend relies on that
    // ordering in two places: Dashboard's Overview "Recent Reports" card
    // takes reports.slice(0, 5) assuming the array is already newest-first,
    // and the Reports tab table lists everything in whatever order it's
    // given. Without this sort, a freshly submitted or CSV-uploaded report
    // could land anywhere in the response and never show up as "recent".
    const docs = await CaseReport.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error fetching reports", detail: e.message });
  }
});

router.get("/reports/export", authMiddleware, requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  try {
    const format = (req.query.format || "pdf").toLowerCase();
    
    // Build query filters based on active parameters and user role (RBAC)
    const filter = buildDistrictFilter(req.user);
    
    // Add optional UI query filters
    if (req.query.reporter_id) {
      filter.reporter_id = req.query.reporter_id;
    }
    if (req.query.severity) {
      filter.severity = req.query.severity;
    }
    if (req.query.location && req.user.role === 'ADMIN') {
      // ADMINs can filter by any location; OPERATORs are restricted to their own by buildDistrictFilter
      filter.location = String(req.query.location);
    }
    if (req.query.startDate || req.query.endDate) {
      filter.created_at = {};
      if (req.query.startDate) {
        filter.created_at.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.created_at.$lte = new Date(req.query.endDate);
      }
    }

    // Fetch reports
    const reports = await CaseReport.find(filter).sort({ created_at: -1 }).lean();

    // Check if there are no reports to avoid errors
    if (reports.length === 0 && format !== "excel" && format !== "pdf") {
      return res.status(404).json({ error: "No reports found matching criteria" });
    }

    // Calculate Summary Statistics
    const totalReports = reports.length;
    
    const severityCounts = { Low: 0, Medium: 0, Severe: 0, Critical: 0 };
    const districtCounts = {};
    const symptomCounts = {};
    let totalAge = 0;
    let ageCount = 0;

    for (const r of reports) {
      // Severity
      const sev = r.severity || "Low";
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;

      // Location / District
      const dist = r.location || "Unknown";
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;

      // Age
      if (typeof r.patient_age === 'number' && !isNaN(r.patient_age)) {
        totalAge += r.patient_age;
        ageCount++;
      }

      // Symptoms
      const symptoms = Array.isArray(r.symptoms) ? r.symptoms : [];
      for (const sym of symptoms) {
        const cleaned = sym.trim();
        symptomCounts[cleaned] = (symptomCounts[cleaned] || 0) + 1;
      }
    }

    const averageAge = ageCount > 0 ? (totalAge / ageCount).toFixed(1) : "N/A";
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => `${entry[0]} (${entry[1]})`)
      .join(", ");

    const generationTimestamp = new Date().toLocaleString();
    const generatingUser = `${req.user.username} (${req.user.role}${req.user.operatorLocation?.district ? ` - ${req.user.operatorLocation.district}` : ""})`;

    if (format === "excel") {
      // Create Workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary Statistics
      const summaryData = [
        ["SmartHealth Reports Export - Summary Dashboard"],
        [],
        ["Metric", "Value"],
        ["Total Reports", totalReports],
        ["Average Patient Age", averageAge],
        ["Top Reported Symptoms", topSymptoms || "None"],
        ["Generated At", generationTimestamp],
        ["Generated By", generatingUser],
        [],
        ["Severity Level", "Count"],
        ["Critical", severityCounts.Critical || 0],
        ["Severe", severityCounts.Severe || 0],
        ["Medium / Moderate", severityCounts.Medium || severityCounts.Moderate || 0],
        ["Low", severityCounts.Low || 0],
        [],
        ["District", "Count"]
      ];

      for (const [dist, count] of Object.entries(districtCounts)) {
        summaryData.push([dist, count]);
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Dashboard");

      // Sheet 2: Report Details
      const detailsHeaders = [
        "Report ID", "Date Reported", "Reporter Type", "Reporter ID", 
        "Patient Age", "Sex", "Severity", "District", "Village / Area", 
        "Symptoms", "Remarks"
      ];
      
      const detailsRows = reports.map(r => [
        String(r._id || r.id),
        new Date(r.created_at).toLocaleDateString(),
        r.reporter_type || "",
        r.reporter_id || "",
        r.patient_age !== undefined ? r.patient_age : "",
        r.sex || "",
        r.severity || "",
        r.location || "",
        r.village_area || "",
        Array.isArray(r.symptoms) ? r.symptoms.join(", ") : "",
        r.remarks || ""
      ]);

      const wsDetails = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsRows]);
      XLSX.utils.book_append_sheet(wb, wsDetails, "Case Details");

      // Generate buffer
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_Export_${Date.now()}.xlsx"`);
      return res.send(buffer);

    } else {
      // PDF Format
      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });

      // Stream PDF directly to client response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_Export_${Date.now()}.pdf"`);
      doc.pipe(res);

      // Header block
      doc.rect(0, 0, 595.28, 90).fill("#1e3a8a");
      doc.fillColor("#ffffff")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("SmartHealth Public Health Ingestion System", 40, 25);
      
      doc.fontSize(10)
        .font("Helvetica")
        .text("CONFIDENTIAL MEDICAL REPORT", 40, 55);

      doc.y = 110;

      // Metadata card
      doc.fillColor("#1e293b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Report Summary Metrics", 40, 110);
      
      doc.rect(40, 125, 515, 80).fill("#f8fafc");
      doc.strokeColor("#cbd5e1").lineWidth(1).rect(40, 125, 515, 80).stroke();

      doc.fillColor("#475569")
        .fontSize(9)
        .font("Helvetica")
        .text(`Generated At: ${generationTimestamp}`, 55, 140)
        .text(`Generated By: ${generatingUser}`, 55, 155)
        .text(`Total Case Reports: ${totalReports}`, 55, 170)
        .text(`Average Age: ${averageAge} yrs`, 300, 140)
        .text(`Top Symptoms: ${topSymptoms || "None"}`, 300, 155);

      // Draw Severity breakdown
      doc.fillColor("#1e293b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Severity Metrics", 40, 225);

      doc.rect(40, 240, 515, 45).fill("#f8fafc");
      doc.strokeColor("#cbd5e1").lineWidth(1).rect(40, 240, 515, 45).stroke();

      doc.fillColor("#b91c1c").font("Helvetica-Bold").fontSize(10).text(`Critical: ${severityCounts.Critical || 0}`, 55, 258);
      doc.fillColor("#ea580c").text(`Severe: ${severityCounts.Severe || 0}`, 180, 258);
      doc.fillColor("#ca8a04").text(`Moderate: ${severityCounts.Medium || severityCounts.Moderate || 0}`, 310, 258);
      doc.fillColor("#16a34a").text(`Low: ${severityCounts.Low || 0}`, 450, 258);

      // Draw reports table header
      doc.fillColor("#1e293b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Report Listing", 40, 310);

      const tableTop = 330;
      doc.rect(40, tableTop, 515, 20).fill("#1e3a8a");
      doc.fillColor("#ffffff")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Date", 45, tableTop + 6)
        .text("District", 110, tableTop + 6)
        .text("Village / Area", 200, tableTop + 6)
        .text("Age/Sex", 310, tableTop + 6)
        .text("Severity", 370, tableTop + 6)
        .text("Symptoms Summary", 430, tableTop + 6);

      let currentY = tableTop + 20;

      for (let i = 0; i < reports.length; i++) {
        const r = reports[i];

        // Page break logic
        if (currentY > 750) {
          doc.addPage();
          
          // Draw header on new page
          doc.rect(0, 0, 595.28, 40).fill("#1e3a8a");
          doc.fillColor("#ffffff")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("SmartHealth Public Health Ingestion System - Reports List", 40, 15);
          
          currentY = 60;
          
          // Draw table header
          doc.rect(40, currentY, 515, 20).fill("#1e3a8a");
          doc.fillColor("#ffffff")
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("Date", 45, currentY + 6)
            .text("District", 110, currentY + 6)
            .text("Village / Area", 200, currentY + 6)
            .text("Age/Sex", 310, currentY + 6)
            .text("Severity", 370, currentY + 6)
            .text("Symptoms Summary", 430, currentY + 6);
            
          currentY += 20;
        }

        // Alternating row background
        if (i % 2 === 0) {
          doc.rect(40, currentY, 515, 20).fill("#f8fafc");
        }

        const dateStr = new Date(r.created_at).toLocaleDateString();
        const distStr = (r.location || "N/A").substring(0, 15);
        const vilStr = (r.village_area || "N/A").substring(0, 18);
        const ageSex = `${r.patient_age || "?"}/${r.sex || "?"}`;
        const sevStr = r.severity || "Low";
        const symStr = (Array.isArray(r.symptoms) ? r.symptoms.join(", ") : "").substring(0, 22);

        // Draw row text
        doc.fillColor("#334155")
          .font("Helvetica")
          .fontSize(8)
          .text(dateStr, 45, currentY + 6)
          .text(distStr, 110, currentY + 6)
          .text(vilStr, 200, currentY + 6)
          .text(ageSex, 310, currentY + 6);

        // Draw severity badge text color
        let sevColor = "#16a34a";
        if (sevStr === "Critical" || sevStr === "Severe") {
          sevColor = "#b91c1c";
        } else if (sevStr === "Moderate" || sevStr === "Medium") {
          sevColor = "#d97706";
        }

        doc.fillColor(sevColor)
          .font("Helvetica-Bold")
          .text(sevStr, 370, currentY + 6);

        doc.fillColor("#334155")
          .font("Helvetica")
          .text(symStr, 430, currentY + 6);

        currentY += 20;
      }

      // Add page numbers footer to all pages
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        // Footer line
        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, 800).lineTo(555, 800).stroke();
        
        doc.fillColor("#94a3b8")
          .fontSize(8)
          .text("Confidential - SmartHealth Public Health Portal", 40, 808)
          .text(`Page ${i + 1} of ${pages.count}`, 500, 808);
      }

      doc.end();
    }

  } catch (e) {
    console.error("Export error:", e);
    return res.status(500).json({ error: "Failed to generate report export", detail: e.message });
  }
});

router.get("/reports/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid report ID" });
    }
    const report = await CaseReport.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: "report not found" });

    // Scoping check (Operator can only see reports in their own district)
    if (req.user.role === 'OPERATOR') {
      const { getUserDistrict } = require("../utils/auth");
      const myDistrict = (getUserDistrict(req.user) || "").trim().toLowerCase();
      const reportDistrict = (report.location || "").trim().toLowerCase();
      if (myDistrict && reportDistrict !== myDistrict) {
        return res.status(403).json({ error: "Forbidden", message: "Operators can only view reports in their assigned district" });
      }
    }

    // Find linked prediction (if any)
    const prediction = await Prediction.findOne({ relatedReportId: report._id }).lean();

    return res.json({
      report,
      prediction: prediction || null
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error fetching report details", detail: e.message });
  }
});
/**
 * PUT /reports/:id
 * Edit an existing health report.
 *
 * Role-based access control:
 * - ADMIN:    can edit any report, including moving it to a different
 *             district (location/village_area).
 * - OPERATOR: can edit ONLY reports whose location matches their own
 *             assigned district, and can never change that district.
 * - USER:     forbidden entirely (blocked by requireRole below).
 */
router.put("/reports/:id", authMiddleware, requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid report ID" });
    }
    const report = await CaseReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "report not found" });

    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin) {
      // OPERATOR: report must currently belong to their assigned district.
      if (!operatorMatchesDistrict(req.user, report.location)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Operators can only edit reports in their assigned district",
        });
      }

      // OPERATOR: reject any attempt to change the district-defining fields,
      // even to a value that happens to look the same (defense in depth —
      // never trust client input for the scoping field).
      const attemptsLocationChange = ADMIN_ONLY_REPORT_FIELDS.some((field) => {
        if (!Object.prototype.hasOwnProperty.call(req.body, field)) return false;
        if (field !== "location") return true; // village_area: never allowed for operators
        return normalizeForCompare(req.body.location) !== normalizeForCompare(report.location);
      });

      if (attemptsLocationChange) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Operators cannot change a report's district",
        });
      }
    }

    // Build the update payload from an allow-list only — never trust
    // arbitrary client-supplied keys (e.g. reporter_id, _id, createdAt).
    const updates = {};
    for (const field of EDITABLE_REPORT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }
    if (isAdmin) {
      for (const field of ADMIN_ONLY_REPORT_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Normalize the same way report creation does.
    if (typeof updates.symptoms === "string") {
      updates.symptoms = updates.symptoms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof updates.sex === "string") {
      const s = updates.sex.toUpperCase();
      if (["MALE", "M"].includes(s)) updates.sex = "M";
      else if (["FEMALE", "F"].includes(s)) updates.sex = "F";
      else if (["OTHER", "O"].includes(s)) updates.sex = "O";
    }
    if (typeof updates.reported_at === "string") {
      const date = new Date(updates.reported_at);
      if (!isNaN(date)) updates.reported_at = date;
    }
    if (updates.patient_age !== undefined) {
      const age = Number(updates.patient_age);
      if (!Number.isNaN(age)) updates.patient_age = age;
    }
    if (updates.lat !== undefined) {
      const lat = Number(updates.lat);
      if (!Number.isNaN(lat)) updates.lat = lat;
    }
    if (updates.lng !== undefined) {
      const lng = Number(updates.lng);
      if (!Number.isNaN(lng)) updates.lng = lng;
    }

    const previousValues = {};
    for (const field of Object.keys(updates)) {
      previousValues[field] = report[field];
    }

    Object.assign(report, updates);
    await report.save();

    await logAudit({
      action: 'EDIT_REPORT',
      req,
      village: report.location,
      entityId: report._id,
      metadata: {
        updatedFields: Object.keys(updates),
        previousValues,
      },
    });

    console.log(`✏️  Report ${report._id} edited by ${req.user.username} (${req.user.role})`);

    return res.json({ success: true, report });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error updating report", detail: e.message });
  }
});

/**
 * DELETE /reports/:id
 * Delete a health report (and its dependent predictions/alerts).
 *
 * Role-based access control:
 * - ADMIN:    can delete any report.
 * - OPERATOR: FORBIDDEN — operators may edit but never delete.
 * - USER:     forbidden entirely.
 */
router.delete("/reports/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid report ID" });
    }
    const report = await CaseReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "report not found" });

    // Find predictions tied to this report
    const predictions = await Prediction.find({ relatedReportId: report._id });
    const predictionIds = predictions.map((p) => p._id);

    // Resolve (not hard-delete) any alerts that were triggered by those predictions,
    // so the audit trail survives but the UI stops showing them as active
    let resolvedAlertsCount = 0;
    if (predictionIds.length > 0) {
      const Alert = require("../models/Alert");
      const alertUpdateResult = await Alert.updateMany(
        { "triggeringPredictions.predictionId": { $in: predictionIds }, status: "active" },
        { status: "resolved", resolvedAt: new Date(), resolvedReason: "Source report deleted" }
      );
      resolvedAlertsCount = alertUpdateResult.modifiedCount;
    }

    // Delete the predictions themselves
    const predDeleteResult = await Prediction.deleteMany({ relatedReportId: report._id });

    // Finally delete the report
    await CaseReport.deleteOne({ _id: report._id });

    console.log(`🗑️  Deleted report ${report._id}: ${predDeleteResult.deletedCount} prediction(s) removed, ${resolvedAlertsCount} alert(s) resolved`);

    await logAudit({
      action: 'DELETE_REPORT',
      req,
      village: report.location,
      entityId: report._id,
      metadata: {
        deletedPredictions: predDeleteResult.deletedCount,
        resolvedAlerts: resolvedAlertsCount,
      },
    });

    return res.json({
      success: true,
      deletedPredictions: predDeleteResult.deletedCount,
      resolvedAlerts: resolvedAlertsCount,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error deleting report", detail: e.message });
  }
});

module.exports = router;