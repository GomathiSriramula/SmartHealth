const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { CaseReport, SensorReading } = require("../models");
const { authMiddleware } = require("../utils/auth");

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
          if (results.length > 0) {
            const insertResult = await CaseReport.insertMany(results, { ordered: false });
            inserted = insertResult.length;
          }

          // Delete the uploaded file after processing
          fs.unlinkSync(filePath);

          res.json({
            message: "CSV file processed successfully",
            summary: {
              totalRows: lineNumber - 1, // Excluding header
              successful: inserted,
              failed: errors.length,
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : [], // Return first 10 errors
          });
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
