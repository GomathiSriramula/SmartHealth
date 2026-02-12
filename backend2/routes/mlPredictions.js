/**
 * ML-Based Water Quality Predictions Route
 * 
 * This route handles integration with the Flask ML service for:
 * - Real-time water quality risk predictions
 * - Batch predictions for multiple samples
 * - Alert generation for HIGH risk predictions
 * - Automatic email notifications
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../utils/auth');
const locationGuard = require('../utils/locationGuard');
const {
  predictWaterQuality,
  predictWaterQualityBatch,
  formatPredictionForStorage,
  normalizeRiskLevel,
  generateRecommendations,
} = require('../utils/mlClient');
const { notifyUsersOfPrediction } = require('../utils/mailer');

// Define Alert Schema for tracking consecutive high predictions
const AlertSchema = new mongoose.Schema(
  {
    alertType: { type: String, enum: ['consecutive_high_predictions'], required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
    consecutiveCount: { type: Number, default: 1 },
    predictions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Prediction' }],
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// Define Prediction Schema
const PredictionSchema = new mongoose.Schema(
  {
    predictionType: { type: String, default: 'Water Quality', required: true },
    location: { type: String, required: false },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    details: { type: String, required: true },
    recommendations: [{ type: String }],
    modelVersion: { type: String, default: 'ml-pipeline-v1.0' },
    confidence: { type: Number, min: 0, max: 100 },
    rawPrediction: {
      risk: String,
      confidence: Number,
      probabilities: mongoose.Schema.Types.Mixed,
    },
    waterQualityInput: {
      pH: Number,
      Turbidity: Number,
      Dissolved_Oxygen: Number,
    },
    lat: { type: Number, required: false },
    lng: { type: Number, required: false },
    predictedDate: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Check if models already exist before creating
let Prediction, Alert;
try {
  Prediction = mongoose.model('MLPrediction');
} catch (error) {
  Prediction = mongoose.model('MLPrediction', PredictionSchema, 'ml_predictions');
}

try {
  Alert = mongoose.model('MLAlert');
} catch (error) {
  Alert = mongoose.model('MLAlert', AlertSchema, 'ml_alerts');
}

/**
 * POST /ml-predictions/predict
 * Make a single prediction based on water quality measurements
 * 
 * SECURITY NOTE (Academic Project Design):
 * - This endpoint is intentionally secured with authentication and role-based location validation.
 * - ADMIN users are restricted to their assigned village location.
 * - USER and OPERATOR roles have no location restrictions.
 * - This design choice was made to keep the system simple and safe for an academic monitoring project.
 * 
 * Request body:
 * {
 *   "pH": 7.2,
 *   "Turbidity": 5.0,
 *   "Dissolved_Oxygen": 8.5,
 *   "location": "Central Treatment Plant",
 *   "lat": 40.7128,
 *   "lng": -74.0060
 * }
 */
router.post('/predict', authMiddleware, locationGuard(), async (req, res) => {
  try {
    const {
      pH,
      Turbidity,
      Dissolved_Oxygen,
      location = 'Unknown',
      lat,
      lng,
    } = req.body;

    // Validate required water quality parameters
    if (pH === undefined || Turbidity === undefined || Dissolved_Oxygen === undefined) {
      return res.status(400).json({
        error: 'Missing required water quality parameters',
        required: ['pH', 'Turbidity', 'Dissolved_Oxygen'],
      });
    }

    // Call ML service for prediction
    const mlResult = await predictWaterQuality({
      pH,
      Turbidity,
      Dissolved_Oxygen,
    });

    if (!mlResult.success) {
      return res.status(503).json({
        error: 'ML service unavailable',
        detail: mlResult.error,
      });
    }

    // Format prediction for database storage
    const predictionData = formatPredictionForStorage(mlResult.data, {
      pH,
      Turbidity,
      Dissolved_Oxygen,
    });

    // Create prediction document
    const prediction = new Prediction({
      ...predictionData,
      location,
      lat,
      lng,
      waterQualityInput: {
        pH,
        Turbidity,
        Dissolved_Oxygen,
      },
    });

    await prediction.save();
    console.log(`✅ ML Prediction saved: ${prediction._id}`);

    // Handle HIGH risk alerts
    if (predictionData.riskLevel === 'high') {
      await handleHighRiskAlert(prediction);
    }

    // Send email notifications
    try {
      await notifyUsersOfPrediction({
        _id: prediction._id,
        predictionType: 'Water Quality',
        riskLevel: prediction.riskLevel,
        location,
        details: prediction.details,
        predictedDate: prediction.predictedDate,
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
        riskLevel: prediction.riskLevel,
        confidence: prediction.confidence,
        location: prediction.location,
        details: prediction.details,
        recommendations: prediction.recommendations,
        predictedDate: prediction.predictedDate,
      },
      mlData: mlResult.data,
    });
  } catch (error) {
    console.error('Error making prediction:', error.message);
    return res.status(500).json({
      error: 'Failed to make prediction',
      detail: error.message,
    });
  }
});

/**
 * POST /ml-predictions/batch
 * Make batch predictions for multiple water samples
 * 
 * Request body:
 * {
 *   "predictions": [
 *     {"pH": 7.2, "Turbidity": 5.0, "Dissolved_Oxygen": 8.5},
 *     {"pH": 6.8, "Turbidity": 8.0, "Dissolved_Oxygen": 7.0}
 *   ],
 *   "location": "Regional Monitoring"
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const { predictions: waterSamples, location = 'Batch Import' } = req.body;

    if (!Array.isArray(waterSamples) || waterSamples.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        detail: 'predictions must be a non-empty array',
      });
    }

    // Call ML service for batch predictions
    const mlResult = await predictWaterQualityBatch(waterSamples);

    if (!mlResult.success) {
      return res.status(503).json({
        error: 'ML service unavailable',
        detail: mlResult.error,
      });
    }

    // Save each prediction
    const savedPredictions = [];
    const alerts = [];

    for (let i = 0; i < waterSamples.length; i++) {
      const waterSample = waterSamples[i];
      const mlPrediction = mlResult.data.predictions[i];

      const predictionData = formatPredictionForStorage(mlPrediction, waterSample);

      const prediction = new Prediction({
        ...predictionData,
        location: `${location} [${i + 1}/${waterSamples.length}]`,
        waterQualityInput: waterSample,
      });

      await prediction.save();
      savedPredictions.push(prediction);

      // Track HIGH risk predictions for alerts
      if (predictionData.riskLevel === 'high') {
        alerts.push(prediction._id);
      }
    }

    console.log(`✅ Batch: saved ${savedPredictions.length} predictions, ${alerts.length} high-risk alerts`);

    return res.status(201).json({
      success: true,
      summary: {
        total: waterSamples.length,
        saved: savedPredictions.length,
        highRiskAlerts: alerts.length,
      },
      predictions: savedPredictions.map(p => ({
        id: p._id,
        riskLevel: p.riskLevel,
        confidence: p.confidence,
        details: p.details,
      })),
    });
  } catch (error) {
    console.error('Error in batch prediction:', error.message);
    return res.status(500).json({
      error: 'Batch prediction failed',
      detail: error.message,
    });
  }
});

/**
 * GET /ml-predictions
 * Retrieve predictions with filtering and pagination
 * 
 * Query parameters:
 * - riskLevel: filter by 'low', 'medium', or 'high'
 * - location: filter by location
 * - hours: get predictions from last N hours (default: 24)
 * - limit: max results (default: 50)
 * - skip: pagination offset (default: 0)
 */
router.get('/', async (req, res) => {
  try {
    const {
      riskLevel,
      location,
      hours = 24,
      limit = 50,
      skip = 0,
    } = req.query;

    const query = {};

    if (riskLevel) {
      query.riskLevel = normalizeRiskLevel(riskLevel);
    }

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    // Filter by time
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    query.predictedDate = { $gte: fromDate };

    const predictions = await Prediction.find(query)
      .sort({ predictedDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Prediction.countDocuments(query);

    return res.json({
      success: true,
      pagination: {
        total,
        returned: predictions.length,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
      filters: { riskLevel, location, hours },
      predictions,
    });
  } catch (error) {
    console.error('Error retrieving predictions:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve predictions',
      detail: error.message,
    });
  }
});

/**
 * GET /ml-predictions/:id
 * Get detailed prediction information
 */
router.get('/:id', async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id).lean();

    if (!prediction) {
      return res.status(404).json({
        error: 'Prediction not found',
      });
    }

    return res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error('Error retrieving prediction:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve prediction',
      detail: error.message,
    });
  }
});

/**
 * GET /ml-predictions/stats/summary
 * Get summary statistics of all predictions
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stats = await Prediction.aggregate([
      {
        $match: {
          predictedDate: { $gte: fromDate },
        },
      },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
        },
      },
    ]);

    const total = await Prediction.countDocuments({
      predictedDate: { $gte: fromDate },
    });

    return res.json({
      success: true,
      timeRange: { hours, from: fromDate, to: new Date() },
      total,
      byRiskLevel: Object.fromEntries(
        stats.map(s => [s._id, { count: s.count, avgConfidence: Math.round(s.avgConfidence) }])
      ),
    });
  } catch (error) {
    console.error('Error getting stats:', error.message);
    return res.status(500).json({
      error: 'Failed to get statistics',
      detail: error.message,
    });
  }
});

/**
 * Internal: Handle high-risk alerts (consecutive predictions)
 * Tracks consecutive HIGH predictions and creates escalation alerts
 */
async function handleHighRiskAlert(prediction) {
  try {
    // Get the most recent prediction from same location
    const previousHighRisk = await Prediction.findOne({
      location: prediction.location,
      riskLevel: 'high',
      _id: { $ne: prediction._id },
      predictedDate: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    }).sort({ predictedDate: -1 });

    if (!previousHighRisk) {
      // First high-risk alert for this location in 24h
      const alert = new Alert({
        alertType: 'consecutive_high_predictions',
        severity: 'medium',
        status: 'active',
        consecutiveCount: 1,
        predictions: [prediction._id],
        description: `High-risk water quality prediction at ${prediction.location}`,
      });
      await alert.save();
      console.log(`⚠️ Alert created: ${alert._id}`);
    } else {
      // Consecutive high-risk alert
      const alert = new Alert({
        alertType: 'consecutive_high_predictions',
        severity: 'high',
        status: 'active',
        consecutiveCount: 2,
        predictions: [previousHighRisk._id, prediction._id],
        description: `CONSECUTIVE high-risk predictions at ${prediction.location}! Previous: ${previousHighRisk.predictedDate.toISOString()}, Current: ${prediction.predictedDate.toISOString()}`,
      });
      await alert.save();
      console.log(`🚨 ESCALATION ALERT: ${alert._id}`);
    }
  } catch (error) {
    console.error('Error handling high-risk alert:', error.message);
  }
}

module.exports = router;
