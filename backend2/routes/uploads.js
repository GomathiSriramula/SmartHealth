const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { CaseReport, SensorReading, Prediction } = require("../models");
const { authMiddleware } = require("../utils/auth");
const { notifyUsersOfPrediction } = require("../utils/mailer");

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
      console.log(`📊 CSV Upload: No HIGH RISK cases found in ${reports.length} reports`);
      return null;
    }
    
    console.log(`🚨 CSV Upload: ${highRiskCases.length} HIGH RISK cases detected!`);
    
    // Get location info from high-risk cases
    const locations = highRiskCases
      .map(c => c.report.lat && c.report.lng ? `(${c.report.lat.toFixed(4)}, ${c.report.lng.toFixed(4)})` : null)
      .filter(Boolean);
    const uniqueLocations = [...new Set(locations)];
    const locationStr = uniqueLocations.slice(0, 3).join(', ') + 
                       (uniqueLocations.length > 3 ? ` and ${uniqueLocations.length - 3} more` : '');
    
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
    console.log(`✅ Bulk upload prediction created: ${prediction._id}`);
    
    // Send email notification
    console.log(`📧 Sending email alerts for bulk HIGH RISK detection...`);
    const notificationResult = await notifyUsersOfPrediction(prediction);
    
    if (notificationResult.success && notificationResult.count > 0) {
      console.log(`✅ Email alerts sent to ${notificationResult.count} users`);
    }
    
    return {
      prediction,
      notification: notificationResult,
      highRiskCount: highRiskCases.length
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
 * Expected CSV columns:
 * reporter_type, reporter_id, patient_age, sex, lat, lng, symptoms, reported_at
 * 
 * Note: reporter_id will be overridden with the authenticated user's username
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
            insertedRecords = await CaseReport.insertMany(results, { ordered: false });
            inserted = insertedRecords.length;
          }

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
              message: `🚨 ${analysisResult.highRiskCount} HIGH RISK cases detected - Email alerts sent to ${analysisResult.notification?.count || 0} users`
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
          if (results.length > 0) {
            const insertResult = await SensorReading.insertMany(results, { ordered: false });
            inserted = insertResult.length;
          }

          fs.unlinkSync(filePath);

          res.json({
            message: "CSV file processed successfully",
            summary: {
              totalRows: lineNumber - 1,
              successful: inserted,
              failed: errors.length,
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : [],
          });
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
