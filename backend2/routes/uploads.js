const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { CaseReport, Prediction } = require("../models");
const { authMiddleware, getUserDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");
const { notifyUsersOfPrediction } = require("../utils/mailer");
const { notifyAlertCreation } = require("../utils/mailer");
const { logAudit } = require("../utils/auditLogger");
const { checkForAlerts } = require("../services/alertChecker");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to accept only CSV files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || path.extname(file.originalname).toLowerCase() === ".csv") {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Analyze health report symptoms for risk level
 */
function analyzeReportRisk(report) {
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

  if (highRiskMatches >= 2) {
    riskLevel = 'high';
    confidence = Math.min(85 + (highRiskMatches * 5), 98);
  } else if (highRiskMatches === 1) {
    riskLevel = 'high';
    confidence = 75 + (mediumRiskMatches * 3);
  } else if (mediumRiskMatches >= 3) {
    riskLevel = 'medium';
    confidence = 65 + (mediumRiskMatches * 2);
  } else if (mediumRiskMatches >= 1) {
    riskLevel = 'low';
    confidence = 50 + (mediumRiskMatches * 5);
  }

  return { riskLevel, confidence, highRiskMatches, mediumRiskMatches };
}

/**
 * Analyze CSV upload results and create prediction if HIGH RISK cases found
 */
async function analyzeCSVReportsAndNotify(reports, authenticatedUsername) {
  try {
    if (!reports || reports.length === 0) return null;

    // Analyze all reports
    const analyses = reports.map(report => ({
      report,
      analysis: analyzeReportRisk(report)
    }));

    // Count high-risk cases
    const highRiskCases = analyses.filter(a => a.analysis.riskLevel === 'high');

    if (highRiskCases.length === 0) {
      console.log(`📊 [CSV Bulk Upload] No HIGH RISK cases found in ${reports.length} reports - no prediction triggered`);
      return null;
    }

    console.log(`🚨 [CSV Bulk Upload] ${highRiskCases.length} HIGH RISK cases detected out of ${reports.length} total! - Triggering prediction...`);

    // Get location info from high-risk cases
    // Prioritize location (district) field, then fall back to village/area name
    const locationField = highRiskCases.find(c => c.report.location)?.report.location;
    let locationStr;

    if (locationField) {
      // Use district/location name if available (critical for alert matching)
      locationStr = locationField;
      console.log(`📍 [CSV Bulk Upload] Using location field: ${locationStr}`);
    } else {
      // Fallback to village/area names if no district/location field
      const villages = highRiskCases
        .map(c => c.report.village_area)
        .filter(Boolean);
      const uniqueVillages = [...new Set(villages)];
      locationStr = uniqueVillages.length > 0
        ? uniqueVillages.slice(0, 3).join(', ') +
        (uniqueVillages.length > 3 ? ` and ${uniqueVillages.length - 3} more` : '')
        : 'Multiple locations';
      console.log(`📍 [CSV Bulk Upload] Using village/area field: ${locationStr}`);
    }

    // Calculate average confidence
    const avgConfidence = highRiskCases.reduce((sum, c) => sum + c.analysis.confidence, 0) / highRiskCases.length;

    // Collect all symptoms from high-risk cases
    const allSymptoms = highRiskCases
      .flatMap(c => c.report.symptoms)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    // Create prediction
    const predictionData = {
      predictionType: "Multiple Water-Borne Disease Cases Detected",
      location: locationStr || "Multiple locations",
      riskLevel: "high",
      predictedDate: new Date(),
      details: `URGENT ALERT: Bulk upload detected ${highRiskCases.length} HIGH RISK cases out of ${reports.length} total reports. ` +
        `Critical symptoms reported: ${allSymptoms.slice(0, 5).join(', ')}${allSymptoms.length > 5 ? '...' : ''}. ` +
        `This pattern suggests potential outbreak in progress. Immediate investigation required.`,
      recommendations: [
        `Investigate all ${highRiskCases.length} high-risk cases immediately`,
        "Test water sources in affected areas",
        "Issue water boil advisory for affected regions",
        "Set up medical screening stations",
        "Distribute bottled water and water purification supplies",
        "Monitor for additional cases in the next 24-48 hours",
        "Contact epidemiology team for outbreak assessment"
      ],
      confidence: Math.round(avgConfidence),
      modelVersion: "csv-bulk-analyzer-v1.0",
      metadata: {
        uploadedBy: authenticatedUsername,
        totalReports: reports.length,
        highRiskCount: highRiskCases.length,
        uploadTimestamp: new Date()
      }
    };

    // Save prediction
    const prediction = await Prediction.create(predictionData);
    console.log(`✅ [CSV Bulk Upload] Prediction created: ${prediction._id}`);

    // 🚨 Check for alerts from this HIGH RISK prediction
    let alertResult = null;
    try {
      // Convert prediction format for alert checker (needs 'risk' not 'riskLevel')
      const predictionForAlert = {
        ...prediction.toObject(),
        risk: prediction.riskLevel, // Convert riskLevel to risk for alert checker
        predictedAt: prediction.predictedDate, // Convert predictedDate to predictedAt
      };

      console.log(`📡 Calling checkForAlerts for CSV upload prediction...`);
      alertResult = await checkForAlerts(predictionForAlert);
      console.log(`📡 checkForAlerts returned:`, alertResult);

      if (alertResult && alertResult.action === 'created' && alertResult.alert) {
        console.log(`🚨 [CSV Alert] CREATED: ${alertResult.message}`);

        // Send alert notification
        try {
          const notifyResult = await notifyAlertCreation(alertResult.alert);
          console.log(`📧 [CSV Alert] Notification sent: ${notifyResult.message}`);
        } catch (notifyError) {
          console.error(`⚠️  [CSV Alert] Notification failed (non-blocking): ${notifyError.message}`);
        }
      } else if (alertResult && alertResult.action === 'resolved' && alertResult.alert) {
        console.log(`✅ [CSV Alert] RESOLVED: ${alertResult.message}`);
      } else if (alertResult) {
        console.log(`ℹ️  [CSV Alert] ${alertResult.message}`);
      }
    } catch (alertError) {
      console.error(`⚠️  [CSV Alert] Check failed (non-blocking): ${alertError.message}`);
      console.error(alertError);
    }

    // Send email notification
    console.log(`📧 [CSV Bulk Upload] Sending email alerts to users...`);
    const notificationResult = await notifyUsersOfPrediction(prediction);

    if (notificationResult.success && notificationResult.count > 0) {
      console.log(`✅ [CSV Bulk Upload] Email alerts sent to ${notificationResult.count} users`);
    }

    return {
      prediction,
      notification: notificationResult,
      highRiskCount: highRiskCases.length,
      alert: alertResult
    };

  } catch (error) {
    console.error(`❌ Error analyzing CSV reports:`, error);
    return null;
  }
}

/**
 * POST /upload/case-reports
 * Upload CSV file containing case reports
 *
 * Expected CSV columns (mirrors the Submit Report form):
 * reporter_type, patient_age, sex, district, village_area, severity, symptoms, reported_at
 * Optional: remarks, reporter_id (ignored), location (alias for district)
 *
 * Notes:
 * - reporter_id will be overridden with the authenticated user's username
 * - district for OPERATOR accounts is ALWAYS forced to that operator's assigned
 *   district — any district/location value in the CSV row is IGNORED for
 *   OPERATOR uploads. This mirrors the reporter_id override above.
 *   WHY: Dashboard/Alerts views scope an operator to their own district. If a
 *   CSV row's district text doesn't match the operator's assigned district
 *   exactly (typo, different casing, stale sample file, wrong district
 *   entirely), the row still saves to the DB successfully but then silently
 *   fails to show up in that operator's Dashboard/Reports/Alerts views. Forcing
 *   the district server-side removes that entire class of "upload succeeded
 *   but nothing shows up" bug.
 * - ADMIN/USER accounts have no assigned district, so district must be
 *   provided in the CSV for those roles and is used as-is.
 * - locationGuard is NOT used here because location validation happens during CSV parsing
 */
router.post("/upload/case-reports", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const authenticatedUsername = req.user.username; // Get username from auth token
    const results = [];
    const errors = [];
    let lineNumber = 1; // Start at 1 for header
    console.log('📤 CSV Upload: User', authenticatedUsername, 'uploading case reports');

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        lineNumber++;
        try {
          // Validate required fields (reporter_id is optional as we override it).
          // District is checked separately below so blank-district failures get a
          // clear, actionable message instead of a generic "Missing required fields".
          if (!data.reporter_type || !data.patient_age || !data.sex ||
            !data.village_area || !data.severity ||
            !data.symptoms || !data.reported_at) {
            errors.push({
              line: lineNumber,
              error: "Missing required fields",
              data: data,
            });
            return;
          }

          // 🔑 FIX: district resolution
          // For OPERATOR accounts: ALWAYS use the operator's own assigned district.
          // Any district/location value present in the CSV row is ignored (and logged)
          // so an operator's uploads can never end up scoped to a different district
          // than the one their Dashboard/Reports/Alerts views filter on.
          // For ADMIN/USER: no assigned district exists, so the CSV value is authoritative.
          const rawDistrict = (data.district || data.location || "").trim();
          const userDistrict = getUserDistrict(req.user);

          let district;
          if (req.user.role === "OPERATOR") {
            district = userDistrict;
            if (rawDistrict && userDistrict && rawDistrict.toLowerCase() !== userDistrict.toLowerCase()) {
              console.warn(
                `⚠️  [CSV Bulk Upload] Line ${lineNumber}: CSV district "${rawDistrict}" ` +
                `was IGNORED and overridden with operator's assigned district "${userDistrict}"`
              );
            }
          } else {
            district = rawDistrict;
          }

          if (!district) {
            errors.push({
              line: lineNumber,
              error:
                req.user.role === "OPERATOR"
                  ? "Missing district - your operator account has no assigned district to auto-fill from. Contact an admin to assign one."
                  : "Missing district - district must be provided in the CSV for ADMIN/USER accounts (only OPERATOR accounts auto-fill a district).",
              data: data,
            });
            return;
          }

          // Normalize sex (accepts Male/Female/Other or M/F/O)
          const sexRaw = data.sex.trim().toUpperCase();
          let sex;
          if (["MALE", "M"].includes(sexRaw)) sex = "M";
          else if (["FEMALE", "F"].includes(sexRaw)) sex = "F";
          else if (["OTHER", "O"].includes(sexRaw)) sex = "O";
          else sex = sexRaw;

          // Normalize severity to match the Submit Report form's casing
          const severityRaw = data.severity.trim();
          const severityMap = {
            mild: "Mild",
            moderate: "Moderate",
            severe: "Severe",
            critical: "Critical",
          };
          const severity =
            severityMap[severityRaw.toLowerCase()] || severityRaw;

          // Parse symptoms (can be pipe-separated)
          const symptoms = data.symptoms.split("|").map((s) => s.trim());

          // Create case report object
          const caseReport = {
            reporter_type: data.reporter_type.trim(),
            reporter_id: authenticatedUsername, // 🔑 Always use authenticated user's username
            patient_age: parseInt(data.patient_age),
            sex: sex,
            location: district, // District, matching the Submit Report form
            village_area: data.village_area.trim(),
            severity: severity,
            symptoms: symptoms,
            reported_at: new Date(data.reported_at),
          };

          // Additional Remarks (optional)
          if (data.remarks && data.remarks.trim()) {
            caseReport.remarks = data.remarks.trim();
          }

          // Validate data types
          if (isNaN(caseReport.patient_age)) {
            errors.push({
              line: lineNumber,
              error: "Invalid patient_age",
              data: data,
            });
            return;
          }

          if (!["M", "F", "O"].includes(caseReport.sex)) {
            errors.push({
              line: lineNumber,
              error: "Invalid sex (must be Male/Female/Other or M/F/O)",
              data: data,
            });
            return;
          }

          if (!["Mild", "Moderate", "Severe", "Critical"].includes(caseReport.severity)) {
            errors.push({
              line: lineNumber,
              error: "Invalid severity (must be Mild, Moderate, Severe, or Critical)",
              data: data,
            });
            return;
          }

          if (isNaN(caseReport.reported_at.getTime())) {
            errors.push({
              line: lineNumber,
              error: "Invalid reported_at date",
              data: data,
            });
            return;
          }

          results.push(caseReport);
        } catch (error) {
          errors.push({
            line: lineNumber,
            error: error.message,
            data: data,
          });
        }
      })
      .on("end", async () => {
        try {
          // Insert all valid records into database
          let inserted = 0;
          let insertedRecords = [];
          if (results.length > 0) {
            try {
              insertedRecords = await CaseReport.insertMany(results, { ordered: false });
              inserted = insertedRecords.length;
            } catch (bulkError) {
              // 🔑 FIX: with ordered:false, Mongo/Mongoose still inserts every row that
              // passed validation even if some rows failed (e.g. duplicate key). The
              // old code let this exception bubble straight to the outer catch, which
              // reported the ENTIRE batch as failed even when most rows actually saved.
              // Recover the rows that did succeed instead of discarding that info.
              const partiallyInserted =
                bulkError.insertedDocs || bulkError.result?.insertedIds || [];

              if (partiallyInserted && Object.keys(partiallyInserted).length > 0) {
                insertedRecords = Array.isArray(partiallyInserted)
                  ? partiallyInserted
                  : Object.values(partiallyInserted);
                inserted = insertedRecords.length;
                const failedCount = results.length - inserted;
                errors.push({
                  line: null,
                  error: `${failedCount} row(s) passed validation but failed to insert into the database: ${bulkError.message}`,
                  data: {},
                });
                console.warn(
                  `⚠️  [CSV Bulk Upload] Partial DB insert: ${inserted}/${results.length} rows saved. ` +
                  `Reason: ${bulkError.message}`
                );
              } else {
                // Nothing was inserted at all — this is a genuine total failure.
                throw bulkError;
              }
            }
          }

          // Log audit event for UPLOAD_CSV action
          await logAudit({
            action: 'UPLOAD_CSV',
            req,
            village: req.user.adminLocation?.village || null,
            metadata: {
              totalRows: lineNumber - 1,
              successful: inserted,
              failed: errors.length,
              fileName: req.file.originalname,
            },
          });

          // 🚨 Analyze uploaded reports for HIGH RISK cases
          // Use insertedRecords (what's actually in the DB) rather than `results`
          // (what merely passed pre-insert validation) so the risk analysis and
          // any resulting alert are based on rows that genuinely made it in.
          const analysisResult = await analyzeCSVReportsAndNotify(
            insertedRecords.length > 0 ? insertedRecords : results,
            authenticatedUsername
          );

          // Delete the uploaded file after processing
          fs.unlinkSync(filePath);

          const response = {
            message: "CSV file processed successfully",
            summary: {
              totalRows: lineNumber - 1, // Excluding header
              successful: inserted,
              failed: errors.length,
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : [], // Return first 10 errors
          };

          // Include notification info if HIGH RISK was detected
          if (analysisResult) {
            response.riskAlert = {
              highRiskCases: analysisResult.highRiskCount,
              emailsSent: analysisResult.notification?.count || 0,
              predictionId: analysisResult.prediction?._id,
              message: `🚨 ${analysisResult.highRiskCount} HIGH RISK cases detected - Email alerts sent to ${analysisResult.notification?.count || 0} users`,
              alert: analysisResult.alert ? {
                action: analysisResult.alert.action,
                message: analysisResult.alert.message,
                alertId: analysisResult.alert.alert ? analysisResult.alert.alert._id : null,
              } : null
            };
          }

          res.json(response);
        } catch (dbError) {
          console.error("Database error:", dbError);
          // Clean up file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          res.status(500).json({
            error: "Database insertion failed",
            detail: dbError.message,
          });
        }
      })
      .on("error", (error) => {
        console.error("CSV parsing error:", error);
        // Clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        res.status(500).json({
          error: "CSV parsing failed",
          detail: error.message,
        });
      });
  } catch (error) {
    console.error("Upload error:", error);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "File upload failed",
      detail: error.message,
    });
  }
});

/**
 * GET /upload/stats
 * Get upload statistics and database counts
 */
router.get("/upload/stats", async (req, res) => {
  try {
    const caseReportCount = await CaseReport.countDocuments();

    res.json({
      database: {
        caseReports: caseReportCount,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      detail: error.message,
    });
  }
});

module.exports = router;