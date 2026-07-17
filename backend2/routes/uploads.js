const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { CaseReport, Prediction } = require("../models");
const { authMiddleware, requireRole, getUserDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");
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
/**
 * Analyze EVERY CSV row individually.
 * - Creates ONE Prediction per row (not one aggregated prediction for the batch)
 * - Runs checkForAlerts() for every row whose prediction is HIGH risk
 * - Sends alert + email notifications per HIGH row
 */
async function analyzeCSVReportsAndNotify(reports, authenticatedUsername) {
  if (!reports || reports.length === 0) return null;

  const perRowResults = [];
  let highRiskCount = 0;
  let alertsCreated = 0;
  let notificationsSent = 0;

  for (const report of reports) {
    const analysis = analyzeReportRisk(report);

    const predictionData = {
      predictionType: "Water-Borne Disease Case Prediction",
      location: report.location || report.village_area || "Unknown location",
      riskLevel: analysis.riskLevel,
      predictedDate: new Date(),
      details:
        `Case report for ${report.village_area || report.location || "unknown area"}. ` +
        `Risk level: ${analysis.riskLevel.toUpperCase()}. ` +
        `Symptoms: ${(report.symptoms || []).join(", ")}.`,
      recommendations:
        analysis.riskLevel === "high"
          ? [
            "Investigate this case immediately",
            "Test water sources in the affected area",
            "Issue water boil advisory if pattern confirmed",
            "Monitor for additional cases in the next 24-48 hours",
          ]
          : ["Continue routine monitoring"],
      confidence: analysis.confidence,
      modelVersion: "csv-bulk-analyzer-v1.0",
      // 🔑 Top-level link, same field DELETE /reports/:id and
      // DELETE /predictions/orphaned both key off of. Without this,
      // CSV-created predictions never cascade-delete and never show up
      // as orphaned when the report is removed.
      relatedReportId: report._id || null,
      metadata: {
        uploadedBy: authenticatedUsername,
        source: "csv_bulk_upload",
        caseReportId: report._id || null,
        uploadTimestamp: new Date(),
      },
    };

    // 🔑 Create ONE Prediction per row
    const prediction = await Prediction.create(predictionData);
    console.log(
      `✅ [CSV Row] Prediction created (${analysis.riskLevel.toUpperCase()}): ${prediction._id}`
    );

    let alertResult = null;
    let notificationResult = null;

    // 🔑 Run checkForAlerts() for every HIGH prediction
    if (analysis.riskLevel === "high") {
      highRiskCount++;

      try {
        const predictionForAlert = {
          ...prediction.toObject(),
          risk: prediction.riskLevel,
          predictedAt: prediction.predictedDate,
        };

        console.log(`📡 Calling checkForAlerts for row prediction ${prediction._id}...`);
        alertResult = await checkForAlerts(predictionForAlert);
        console.log(`📡 checkForAlerts returned:`, alertResult);

        // 🔑 checkForAlerts() itself sends the "alert created" email (see
        // alertChecker.js) and returns the outcome on `notification`. This
        // loop must NOT send its own follow-up email — it previously sent
        // up to two more (notifyAlertCreation + notifyUsersOfPrediction) on
        // top of the one checkForAlerts() already sent, for a total of 3
        // identical alerts per newly-created row.
        if (alertResult && alertResult.action === "created" && alertResult.alert) {
          alertsCreated++;
          console.log(`🚨 [CSV Alert] CREATED: ${alertResult.message}`);
          notificationResult = alertResult.notification || { success: false, message: 'No notification result returned' };
          if (notificationResult.success && notificationResult.count > 0) {
            notificationsSent += notificationResult.count;
          }
        } else if (alertResult && alertResult.action === "resolved" && alertResult.alert) {
          console.log(`✅ [CSV Alert] RESOLVED: ${alertResult.message}`);
        } else if (alertResult) {
          console.log(`ℹ️  [CSV Alert] ${alertResult.message}`);
        }
      } catch (alertError) {
        console.error(`⚠️  [CSV Alert] Check failed (non-blocking): ${alertError.message}`);
        console.error(alertError);
      }
    }

    perRowResults.push({ report, analysis, prediction, alertResult, notificationResult });
  }

  return {
    perRowResults,
    totalReports: reports.length,
    highRiskCount,
    alertsCreated,
    notificationsSent,
  };
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
router.post("/upload/case-reports", authMiddleware, requireRole('ADMIN', 'OPERATOR'), upload.single("file"), async (req, res) => {
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
            if (rawDistrict && userDistrict && rawDistrict.toLowerCase() !== userDistrict.toLowerCase()) {
              errors.push({
                line: lineNumber,
                error: `Forbidden: As an Operator, you can only submit reports for your assigned district (${userDistrict}). Found CSV district: "${rawDistrict}"`,
                data: data,
              });
              return;
            }
            district = userDistrict;
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
          // 🚨 Analyze every uploaded report individually — creates one Prediction
          // per row and runs checkForAlerts() for every HIGH-risk row.
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

          // Include per-row prediction/alert info if any predictions were created
          if (analysisResult) {
            response.riskAlert = {
              totalPredictions: analysisResult.perRowResults.length,
              highRiskCases: analysisResult.highRiskCount,
              alertsCreated: analysisResult.alertsCreated,
              emailsSent: analysisResult.notificationsSent,
              message: `🚨 ${analysisResult.highRiskCount} HIGH RISK cases detected out of ${analysisResult.totalReports} rows - ${analysisResult.alertsCreated} alert(s) created, emails sent for ${analysisResult.notificationsSent} notifications`,
              predictions: analysisResult.perRowResults.map((r) => ({
                predictionId: r.prediction._id,
                riskLevel: r.analysis.riskLevel,
                location: r.prediction.location,
                alert: r.alertResult
                  ? {
                    action: r.alertResult.action,
                    message: r.alertResult.message,
                    alertId: r.alertResult.alert ? r.alertResult.alert._id : null,
                  }
                  : null,
              })),
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