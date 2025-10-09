const express = require("express");
const router = express.Router();
const { notifyUsersOfPrediction } = require("../utils/mailer");
const mongoose = require("mongoose");

// Define Prediction Schema
const PredictionSchema = new mongoose.Schema(
  {
    predictionType: { type: String, required: true },
    location: { type: String, required: false },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "Low", "Medium", "High"],
      required: true,
    },
    predictedDate: { type: Date, required: true, default: Date.now },
    details: { type: String, required: true },
    recommendations: { type: [String], default: [] },
    modelVersion: { type: String, required: false },
    confidence: { type: Number, required: false, min: 0, max: 100 },
    lat: { type: Number, required: false },
    lng: { type: Number, required: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const Prediction = mongoose.model(
  "Prediction",
  PredictionSchema,
  "predictions"
);

/**
 * POST /predictions
 * Create a new prediction and notify all registered users
 * 
 * Request body:
 * {
 *   "predictionType": "Disease Outbreak",
 *   "location": "Downtown Area",
 *   "riskLevel": "high",
 *   "details": "Predicted cholera outbreak based on water quality data",
 *   "recommendations": ["Boil water before drinking", "Seek medical attention if symptoms appear"],
 *   "lat": 40.7128,
 *   "lng": -74.0060,
 *   "modelVersion": "v1.0",
 *   "confidence": 85
 * }
 */
router.post("/predictions", async (req, res) => {
  try {
    const {
      predictionType,
      location,
      riskLevel,
      details,
      recommendations,
      lat,
      lng,
      modelVersion,
      confidence,
    } = req.body;

    // Validation
    if (!predictionType || !riskLevel || !details) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["predictionType", "riskLevel", "details"],
      });
    }

    // Create prediction document
    const prediction = new Prediction({
      predictionType,
      location: location || "Unknown",
      riskLevel: riskLevel.toLowerCase(),
      details,
      recommendations: recommendations || [],
      lat,
      lng,
      modelVersion,
      confidence,
      predictedDate: new Date(),
    });

    await prediction.save();
    console.log(`✅ Prediction saved: ${prediction._id}`);

    // Send email notifications to all users
    try {
      const result = await notifyUsersOfPrediction(prediction);
      console.log(`📧 Email notification result:`, result);

      return res.status(201).json({
        message: "Prediction created and notifications sent",
        prediction: {
          id: prediction._id,
          predictionType: prediction.predictionType,
          riskLevel: prediction.riskLevel,
          location: prediction.location,
          predictedDate: prediction.predictedDate,
        },
        notification: result,
      });
    } catch (emailError) {
      console.error("Failed to send email notifications:", emailError.message);
      // Still return success for prediction creation
      return res.status(201).json({
        message: "Prediction created but email notification failed",
        prediction: {
          id: prediction._id,
          predictionType: prediction.predictionType,
          riskLevel: prediction.riskLevel,
          location: prediction.location,
          predictedDate: prediction.predictedDate,
        },
        notification: {
          success: false,
          error: emailError.message,
        },
      });
    }
  } catch (error) {
    console.error("Error creating prediction:", error.message);
    return res.status(500).json({
      error: "Failed to create prediction",
      detail: error.message,
    });
  }
});

/**
 * GET /predictions
 * Get all predictions with optional filtering and pagination
 * 
 * Query parameters:
 * - riskLevel: filter by risk level (low, medium, high)
 * - limit: number of results (default: 50)
 * - skip: number of results to skip (default: 0)
 * - sort: sort order (newest or oldest, default: newest)
 */
router.get("/predictions", async (req, res) => {
  try {
    const { riskLevel, limit = 50, skip = 0, sort = "newest" } = req.query;

    const query = {};
    if (riskLevel) {
      query.riskLevel = riskLevel.toLowerCase();
    }

    const sortOrder = sort === "oldest" ? 1 : -1;

    const predictions = await Prediction.find(query)
      .sort({ predictedDate: sortOrder })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Prediction.countDocuments(query);

    return res.json({
      predictions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        returned: predictions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching predictions:", error.message);
    return res.status(500).json({
      error: "Failed to fetch predictions",
      detail: error.message,
    });
  }
});

/**
 * GET /predictions/:id
 * Get a specific prediction by ID
 */
router.get("/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findById(id);

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    return res.json(prediction);
  } catch (error) {
    console.error("Error fetching prediction:", error.message);
    return res.status(500).json({
      error: "Failed to fetch prediction",
      detail: error.message,
    });
  }
});

/**
 * POST /predictions/:id/notify
 * Resend email notification for a specific prediction
 */
router.post("/predictions/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findById(id);

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    const result = await notifyUsersOfPrediction(prediction);

    return res.json({
      message: "Notification sent",
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
        riskLevel: prediction.riskLevel,
      },
      notification: result,
    });
  } catch (error) {
    console.error("Error sending notification:", error.message);
    return res.status(500).json({
      error: "Failed to send notification",
      detail: error.message,
    });
  }
});

/**
 * DELETE /predictions/:id
 * Delete a specific prediction
 */
router.delete("/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findByIdAndDelete(id);

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    return res.json({
      message: "Prediction deleted successfully",
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
      },
    });
  } catch (error) {
    console.error("Error deleting prediction:", error.message);
    return res.status(500).json({
      error: "Failed to delete prediction",
      detail: error.message,
    });
  }
});

module.exports = router;
