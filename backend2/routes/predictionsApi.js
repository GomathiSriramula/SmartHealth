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
const { authMiddleware } = require('../utils/auth');
const locationGuard = require('../utils/locationGuard');

/**
 * Helper function: Apply role-based location filtering
 * ADMIN users can only see records from their assigned village
 * USER and OPERATOR users can see all records
 */
function applyLocationFilter(userRole, adminLocation) {
  const filter = {};
  if (userRole === 'ADMIN') {
    if (!adminLocation || !adminLocation.village) {
      throw new Error('Admin location not configured');
    }
    filter.location = new RegExp(`^${adminLocation.village}$`, 'i');
  }
  return filter;
}

/**
 * POST /predictions
 * Create a prediction for water quality data
 * 
 * SECURITY NOTE:
 * - Requires authentication (Bearer token or x-api-key)
 * - ADMIN users restricted to their assigned village location
 * - USER and OPERATOR roles have no location restrictions
 * - Location field validated against user's role and assignment
 * - Returns 401 if unauthenticated, 403 if location unauthorized
 */
router.post('/predictions', authMiddleware, locationGuard(), async (req, res) => {
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
        console.log(`🚨 [Water Quality Alert] Alert CREATED: ${alertResult.message}`);
        
        // Send notification for new alert
        const notifyResult = await sendAlertNotification(alertResult.alert);
        console.log(`📧 [Water Quality Alert] Notification result: ${notifyResult.message}`);
      } else if (alertResult.action === 'resolved' && alertResult.alert) {
        console.log(`✅ [Water Quality Alert] Alert RESOLVED: ${alertResult.message}`);
      } else if (alertResult.action !== 'error') {
        console.log(`⏳ [Water Quality Alert] Alert check: ${alertResult.message}`);
      }
    } catch (alertError) {
      console.error('[Water Quality Alert] Alert processing error (non-blocking):', alertError.message);
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
 * 
 * Role-based filtering:
 * - ADMIN: Returns only predictions from their assigned village
 * - USER/OPERATOR: Returns predictions from all villages
 */
router.get('/predictions', authMiddleware, async (req, res) => {
  try {
    const { risk, limit = 50, skip = 0 } = req.query;
    const userRole = req.user.role || 'USER';
    const adminLocation = req.user.adminLocation;

    const query = {};
    
    // Apply role-based location filtering
    if (userRole === 'ADMIN') {
      if (!adminLocation || !adminLocation.village) {
        return res.status(500).json({
          error: 'Admin location not configured',
          detail: 'Admin user is missing location assignment'
        });
      }
      query.location = new RegExp(`^${adminLocation.village}$`, 'i');
    }
    // USER and OPERATOR: No location filter (see all records)
    
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
 * 
 * Role-based access control:
 * - ADMIN: Can only access predictions from their assigned village (403 if different village)
 * - USER/OPERATOR: Can access any prediction
 */
router.get('/predictions/:id', authMiddleware, async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id).lean();

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Apply role-based access control
    const userRole = req.user.role || 'USER';
    if (userRole === 'ADMIN') {
      const adminLocation = req.user.adminLocation;
      if (!adminLocation || !adminLocation.village) {
        return res.status(500).json({
          error: 'Admin location not configured',
          detail: 'Admin user is missing location assignment'
        });
      }
      // Check if prediction's location matches admin's village (case-insensitive)
      const adminVillage = adminLocation.village.toLowerCase().trim();
      const predictionLocation = (prediction.location || '').toLowerCase().trim();
      if (adminVillage !== predictionLocation) {
        return res.status(403).json({
          error: 'Forbidden',
          detail: `You can only access predictions from your assigned village (${adminLocation.village})`
        });
      }
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
 * 
 * Role-based statistics:
 * - ADMIN: Returns statistics only for predictions in their assigned village
 * - USER/OPERATOR: Returns statistics for all predictions
 */
router.get('/predictions/stats/summary', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role || 'USER';
    const adminLocation = req.user.adminLocation;
    
    let query = {};
    
    // Apply role-based location filtering
    if (userRole === 'ADMIN') {
      if (!adminLocation || !adminLocation.village) {
        return res.status(500).json({
          error: 'Admin location not configured',
          detail: 'Admin user is missing location assignment'
        });
      }
      query.location = new RegExp(`^${adminLocation.village}$`, 'i');
    }
    // USER and OPERATOR: No location filter (see statistics for all records)
    
    const total = await Prediction.countDocuments(query);
    
    const byCertainty = await Prediction.aggregate([
      { $match: query },
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
