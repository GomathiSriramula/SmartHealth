const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { CaseReport, SensorReading, Prediction } = require("../models");
const { authMiddleware } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");
const { notifyUsersOfPrediction } = require("../utils/mailer");
const { notifyAlertCreation } = require("../utils/mailer");
const { logAudit } = require("../utils/auditLogger");
const { checkForAlerts } = require("../services/alertChecker");
const { triggerPrediction } = require("../services/predictionTrigger");

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
    // Prioritize location field (village name) over coordinates for proper alert matching
    const locationField = highRiskCases.find(c => c.report.location)?.report.location;
    let locationStr;
    
    if (locationField) {
      // Use village/location name if available (critical for alert matching)
      locationStr = locationField;
      console.log(`📍 [CSV Bulk Upload] Using location field: ${locationStr}`);
    } else {
      // Fallback to coordinates if no location field
      const locations = highRiskCases
        .map(c => c.report.lat && c.report.lng ? `(${c.report.lat.toFixed(4)}, ${c.report.lng.toFixed(4)})` : null)
        .filter(Boolean);
      const uniqueLocations = [...new Set(locations)];
      locationStr = uniqueLocations.slice(0, 3).join(', ') + 
                   (uniqueLocations.length > 3 ? ` and ${uniqueLocations.length - 3} more` : 'Multiple locations');
      console.log(`📍 [CSV Bulk Upload] Using coordinates: ${locationStr}`);
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
      lat: highRiskCases[0]?.report.lat,
      lng: highRiskCases[0]?.report.lng,
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
 * Analyze sensor readings and trigger ML predictions for water quality
 */
async function analyzeSensorReadingsAndPredict(sensorReadings) {
  try {
    if (!sensorReadings || sensorReadings.length === 0) return null;
    
    console.log(`🌊 [CSV Sensor Upload] Processing ${sensorReadings.length} sensor readings for ML predictions...`);
    
    let predictionsCreated = 0;
    let alertsCreated = 0;
    const predictions = [];
    
    // Process each sensor reading that has water quality data
    for (const reading of sensorReadings) {
      if (reading.pH !== null && reading.pH !== undefined && 
          reading.turbidity !== null && reading.turbidity !== undefined) {
        
        try {
          const waterQualityData = {
            pH: reading.pH,
            Turbidity: reading.turbidity,
            Dissolved_Oxygen: reading.conductivity || 8.0 // Use conductivity as proxy or default
          };
          
          const location = reading.location || `Sensor ${reading.sensor_id}`;
          const prediction = await triggerPrediction(waterQualityData, { 
            location, 
            source: 'csv_sensor_upload',
            sensorId: reading.sensor_id
          });
          
          if (prediction) {
            predictionsCreated++;
            predictions.push(prediction);
            console.log(`✅ [CSV Sensor] Prediction for ${reading.sensor_id}: ${prediction.risk} risk`);
            
            // Check for alerts if HIGH risk
            if (prediction.risk === 'high' || prediction.riskLevel === 'HIGH') {
              try {
                const alertResult = await checkForAlerts(prediction);
                
                if (alertResult.action === 'created') {
                  alertsCreated++;
                  console.log(`🚨 [CSV Sensor Alert] CREATED: ${alertResult.message}`);
                  
                  // Send alert notification
                  try {
                    await notifyAlertCreation(alertResult.alert);
                  } catch (notifyError) {
                    console.error(`⚠️  [CSV Sensor Alert] Notification failed: ${notifyError.message}`);
                  }
                } else if (alertResult.action === 'resolved') {
                  console.log(`✅ [CSV Sensor Alert] RESOLVED: ${alertResult.message}`);
                } else {
                  console.log(`ℹ️  [CSV Sensor Alert] ${alertResult.message}`);
                }
              } catch (alertError) {
                console.error(`⚠️  [CSV Sensor Alert] Check failed: ${alertError.message}`);
              }
            }
          }
        } catch (predError) {
          console.error(`❌ [CSV Sensor] Prediction failed for ${reading.sensor_id}:`, predError.message);
        }
      }
    }
    
    console.log(`✅ [CSV Sensor Upload] Complete: ${predictionsCreated} predictions, ${alertsCreated} alerts`);
    
    return {
      predictionsCount: predictionsCreated,
      alertsCount: alertsCreated,
      predictions: predictions
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing sensor readings:`, error);
    return null;
  }
}

/**
 * POST /upload/case-reports
 * Upload CSV file containing case reports
 * 
 * Expected CSV columns:
 * reporter_type, reporter_id, patient_age, sex, lat, lng, symptoms, reported_at
 * Optional: location (required for ADMIN users - must match their assigned village)
 * 
 * Notes:
 * - reporter_id will be overridden with the authenticated user's username
 * - For ADMIN users: Every row's location must match the admin's assigned village
 *   If any row has a different location, the entire upload is rejected
 * - USER role has no location restrictions
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
    let adminLocationError = null; // Track ADMIN location validation failure

    console.log('📤 CSV Upload: User', authenticatedUsername, 'uploading case reports');

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        lineNumber++;
        try {
          // Validate required fields (reporter_id is optional as we override it)
          if (!data.reporter_type || !data.patient_age || 
              !data.sex || !data.lat || !data.lng || !data.symptoms || !data.reported_at) {
            errors.push({
              line: lineNumber,
              error: "Missing required fields",
              data: data,
            });
            return;
          }

          // Parse symptoms (can be pipe-separated)
          const symptoms = data.symptoms.split("|").map((s) => s.trim());

          // Create case report object
          const caseReport = {
            reporter_type: data.reporter_type.trim(),
            reporter_id: authenticatedUsername, // 🔑 Always use authenticated user's username
            patient_age: parseInt(data.patient_age),
            sex: data.sex.trim().toUpperCase(),
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            symptoms: symptoms,
            reported_at: new Date(data.reported_at),
          };

          // Add location field if present in CSV (important for alert matching)
          if (data.location && data.location.trim()) {
            caseReport.location = data.location.trim();
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

          if (isNaN(caseReport.lat) || isNaN(caseReport.lng)) {
            errors.push({
              line: lineNumber,
              error: "Invalid lat/lng coordinates",
              data: data,
            });
            return;
          }

          if (!["M", "F", "O"].includes(caseReport.sex)) {
            errors.push({
              line: lineNumber,
              error: "Invalid sex (must be M, F, or O)",
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

          // ADMIN location validation
          if (req.user.role === 'ADMIN') {
            const adminLocation = req.user.adminLocation;
            
            // Admin must have location assigned
            if (!adminLocation || !adminLocation.village) {
              errors.push({
                line: lineNumber,
                error: "Admin location not configured on server",
                data: data,
              });
              return;
            }

            // Extract location from CSV row (can be in 'location' column or use lat/lng)
            const rowLocation = data.location ? data.location.trim() : null;
            
            if (!rowLocation) {
              errors.push({
                line: lineNumber,
                error: "Location field required for admin uploads",
                data: data,
              });
              return;
            }

            // Normalize for comparison (lowercase and trim whitespace)
            const adminVillage = adminLocation.village.toLowerCase().trim();
            const submittedLocation = rowLocation.toLowerCase().trim();

            // CRITICAL: If ADMIN location mismatch, record error and abort all processing
            if (adminVillage !== submittedLocation) {
              // Set adminLocationError to prevent ANY database insertion
              if (!adminLocationError) {
                adminLocationError = {
                  line: lineNumber,
                  expectedVillage: adminLocation.village,
                  receivedVillage: rowLocation
                };
              }
              errors.push({
                line: lineNumber,
                error: `Location mismatch: submitted '${rowLocation}' but admin is assigned to '${adminLocation.village}'`,
                data: data,
                submittedLocation: rowLocation,
                allowedLocation: adminLocation.village
              });
              return;
            }

            // Location validation passed for ADMIN
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
          // 🔐 CRITICAL: If ADMIN user had location validation error, REJECT immediately without inserting
          if (adminLocationError) {
            // Clean up file before returning error
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            return res.status(403).json({
              error: "Unauthorized location in CSV",
              detail: `Row ${adminLocationError.line} location mismatch`,
              rowNumber: adminLocationError.line,
              expectedVillage: adminLocationError.expectedVillage,
              receivedVillage: adminLocationError.receivedVillage,
              message: `Admin assigned to '${adminLocationError.expectedVillage}' but row ${adminLocationError.line} submitted '${adminLocationError.receivedVillage}'. No data inserted.`
            });
          }

          // Insert all valid records into database
          let inserted = 0;
          let insertedRecords = [];
          if (results.length > 0) {
            insertedRecords = await CaseReport.insertMany(results, { ordered: false });
            inserted = insertedRecords.length;
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

          // 🚨 NEW: Analyze uploaded reports for HIGH RISK cases
          const analysisResult = await analyzeCSVReportsAndNotify(results, authenticatedUsername);

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
 * POST /upload/sensor-readings
 * Upload CSV file containing sensor readings
 * 
 * Expected CSV columns:
 * sensor_id, reading_at, lat, lng, turbidity, pH, conductivity
 */
router.post("/upload/sensor-readings", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const results = [];
    const errors = [];
    let lineNumber = 1;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        lineNumber++;
        try {
          // Validate required fields
          if (!data.sensor_id || !data.reading_at || !data.lat || !data.lng) {
            errors.push({
              line: lineNumber,
              error: "Missing required fields (sensor_id, reading_at, lat, lng)",
              data: data,
            });
            return;
          }

          const sensorReading = {
            sensor_id: data.sensor_id.trim(),
            reading_at: new Date(data.reading_at),
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            turbidity: data.turbidity ? parseFloat(data.turbidity) : null,
            pH: data.pH ? parseFloat(data.pH) : null,
            conductivity: data.conductivity ? parseFloat(data.conductivity) : null,
          };

          // Add location field if present in CSV (important for alert matching)
          if (data.location && data.location.trim()) {
            sensorReading.location = data.location.trim();
          }

          // Validate data
          if (isNaN(sensorReading.lat) || isNaN(sensorReading.lng)) {
            errors.push({
              line: lineNumber,
              error: "Invalid lat/lng coordinates",
              data: data,
            });
            return;
          }

          if (isNaN(sensorReading.reading_at.getTime())) {
            errors.push({
              line: lineNumber,
              error: "Invalid reading_at date",
              data: data,
            });
            return;
          }

          results.push(sensorReading);
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
          let inserted = 0;
          let insertedRecords = [];
          if (results.length > 0) {
            insertedRecords = await SensorReading.insertMany(results, { ordered: false });
            inserted = insertedRecords.length;
          }

          // 🌊 NEW: Trigger ML predictions for sensor readings with water quality data
          let mlAnalysis = null;
          if (insertedRecords.length > 0) {
            // Convert MongoDB documents to plain objects for processing
            const recordsToAnalyze = insertedRecords.map(record => ({
              sensor_id: record.sensor_id,
              pH: record.pH,
              turbidity: record.turbidity,
              conductivity: record.conductivity,
              location: record.location,
              lat: record.lat,
              lng: record.lng
            }));
            mlAnalysis = await analyzeSensorReadingsAndPredict(recordsToAnalyze);
          }

          fs.unlinkSync(filePath);

          const response = {
            message: "CSV file processed successfully",
            summary: {
              totalRows: lineNumber - 1,
              successful: inserted,
              failed: errors.length,
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : [],
          };

          // Include ML prediction info if predictions were made
          if (mlAnalysis && mlAnalysis.predictionsCount > 0) {
            response.mlAnalysis = {
              predictionsCreated: mlAnalysis.predictionsCount,
              alertsCreated: mlAnalysis.alertsCount,
              message: `🎯 ${mlAnalysis.predictionsCount} ML predictions created, ${mlAnalysis.alertsCount} alerts triggered`
            };
          }

          res.json(response);
        } catch (dbError) {
          console.error("Database error:", dbError);
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
    const sensorReadingCount = await SensorReading.countDocuments();

    res.json({
      database: {
        caseReports: caseReportCount,
        sensorReadings: sensorReadingCount,
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
