/**
 * Water Quality Predictions API
 * 
 * Endpoints:
 * - POST /predictions - Create prediction from water quality data
 * - GET /predictions - List recent predictions
 * - GET /predictions/:id - Get prediction details
 */

const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const mlClient = require('../services/mlClient');
const { checkForAlerts } = require('../services/alertChecker');
const { sendAlertNotification } = require('../services/alertNotifier');

/**
 * POST /predictions
 * Create a prediction for water quality data
 */
router.post('/predictions', async (req, res) => {
  try {
    const { pH, Turbidity, Dissolved_Oxygen, location, source } = req.body;

    // Validate required fields
    if (pH === undefined || Turbidity === undefined || Dissolved_Oxygen === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: pH, Turbidity, Dissolved_Oxygen'
      });
    }

    // Call ML service
    const waterQuality = { pH, Turbidity, Dissolved_Oxygen };
    const mlResult = await mlClient.predict(waterQuality);

    if (!mlResult.success) {
      console.error('[Predictions] ML service error:', mlResult.error);
      return res.status(503).json({
        error: 'ML service unavailable',
        detail: mlResult.error
      });
    }

    // Store prediction in database
    const prediction = new Prediction({
      waterQuality,
      risk: mlResult.risk,
      confidence: mlResult.confidence,
      probabilities: mlResult.probabilities,
      location: location || 'unknown',
      source: source || 'manual'
    });

    await prediction.save();

    // Check for alerts (non-blocking)
    let alertResult = null;
    try {
      alertResult = await checkForAlerts(prediction);
      
      if (alertResult.action === 'created' && alertResult.alert) {
        console.log(`[Predictions] Alert created: ${alertResult.message}`);
        
        // Send notification for new alert
        const notifyResult = await sendAlertNotification(alertResult.alert);
        console.log(`[Predictions] Notification result: ${notifyResult.message}`);
      } else if (alertResult.action === 'resolved' && alertResult.alert) {
        console.log(`[Predictions] Alert resolved: ${alertResult.message}`);
      }
    } catch (alertError) {
      console.error('[Predictions] Alert processing error (non-blocking):', alertError.message);
      // Don't fail the prediction creation
    }

    return res.status(201).json({
      success: true,
      prediction: {
        id: prediction._id,
        waterQuality: prediction.waterQuality,
        risk: prediction.risk,
        confidence: prediction.confidence,
        location: prediction.location,
        predictedAt: prediction.predictedAt
      },
      alert: alertResult ? {
        action: alertResult.action,
        message: alertResult.message,
        alertId: alertResult.alert?._id
      } : null
    });

  } catch (error) {
    console.error('[Predictions] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to create prediction',
      detail: error.message
    });
  }
});

/**
 * GET /predictions
 * List recent predictions with optional filtering
 */
router.get('/predictions', async (req, res) => {
  try {
    const { risk, limit = 50, skip = 0 } = req.query;

    const query = {};
    if (risk) {
      query.risk = risk.toUpperCase();
    }

    const predictions = await Prediction.find(query)
      .sort({ predictedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Prediction.countDocuments(query);

    return res.json({
      success: true,
      total,
      returned: predictions.length,
      predictions
    });

  } catch (error) {
    console.error('[Predictions] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve predictions',
      detail: error.message
    });
  }
});

/**
 * GET /predictions/:id
 * Get details of a specific prediction
 */
router.get('/predictions/:id', async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id).lean();

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    return res.json({
      success: true,
      prediction
    });

  } catch (error) {
    console.error('[Predictions] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve prediction',
      detail: error.message
    });
  }
});

/**
 * GET /predictions/stats/summary
 * Get summary statistics
 */
router.get('/predictions/stats/summary', async (req, res) => {
  try {
    const total = await Prediction.countDocuments();
    
    const byCertainty = await Prediction.aggregate([
      {
        $group: {
          _id: '$risk',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' }
        }
      }
    ]);

    return res.json({
      success: true,
      total,
      byRisk: Object.fromEntries(
        byCertainty.map(item => [
          item._id,
          { count: item.count, avgConfidence: Math.round(item.avgConfidence) }
        ])
      )
    });

  } catch (error) {
    console.error('[Predictions] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve statistics',
      detail: error.message
    });
  }
});

module.exports = router;
