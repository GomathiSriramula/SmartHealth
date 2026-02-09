/**
 * Alerts API Route
 * 
 * Endpoints for managing and monitoring alerts triggered by
 * consecutive HIGH-risk predictions or system events
 */

const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const {
  getAlertModel,
  createHighRiskAlert,
  getRecentHighRiskPredictions,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertStats,
} = require('../utils/alertManager');

/**
 * GET /alerts/active
 * Get all active and escalated alerts
 */
router.get('/active', async (req, res) => {
  try {
    const alerts = await getActiveAlerts();

    return res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Error retrieving active alerts:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve alerts',
      detail: error.message,
    });
  }
});

/**
 * GET /alerts/stats
 * Get alert statistics (counts by status, severity, type)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAlertStats();

    return res.json(stats);
  } catch (error) {
    console.error('Error retrieving alert stats:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve statistics',
      detail: error.message,
    });
  }
});

/**
 * GET /alerts
 * Retrieve alerts with filtering and pagination
 * 
 * Query parameters:
 * - status: filter by 'active', 'acknowledged', 'resolved', 'escalated'
 * - severity: filter by 'low', 'medium', 'high', 'critical'
 * - type: filter by alert type
 * - limit: max results (default: 50)
 * - skip: pagination offset (default: 0)
 */
router.get('/', async (req, res) => {
  try {
    const { status, severity, type, limit = 50, skip = 0 } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    if (type) {
      query.alertType = type;
    }

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Alert.countDocuments(query);

    return res.json({
      success: true,
      pagination: {
        total,
        returned: alerts.length,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
      filters: { status, severity, type },
      alerts,
    });
  } catch (error) {
    console.error('Error retrieving alerts:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve alerts',
      detail: error.message,
    });
  }
});

/**
 * GET /alerts/:id
 * Get detailed alert information
 */
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('predictions')
      .lean();

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    return res.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error retrieving alert:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve alert',
      detail: error.message,
    });
  }
});

/**
 * POST /alerts/:id/acknowledge
 * Acknowledge an alert (mark as reviewed)
 * 
 * Request body:
 * {
 *   "userId": "user@example.com"
 * }
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'system' } = req.body;

    const alert = await acknowledgeAlert(id, userId);

    return res.json({
      success: true,
      message: 'Alert acknowledged',
      alert,
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error.message);

    if (error.message === 'Alert not found') {
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    return res.status(500).json({
      error: 'Failed to acknowledge alert',
      detail: error.message,
    });
  }
});

/**
 * POST /alerts/:id/resolve
 * Resolve an alert with optional resolution notes
 * 
 * Request body:
 * {
 *   "userId": "user@example.com",
 *   "resolutionNotes": "Issue resolved, water quality returned to normal"
 * }
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'system', resolutionNotes = '' } = req.body;

    const alert = await resolveAlert(id, userId, resolutionNotes);

    return res.json({
      success: true,
      message: 'Alert resolved',
      alert,
    });
  } catch (error) {
    console.error('Error resolving alert:', error.message);

    if (error.message === 'Alert not found') {
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    return res.status(500).json({
      error: 'Failed to resolve alert',
      detail: error.message,
    });
  }
});

/**
 * POST /alerts/check-consecutive/:location
 * Check for consecutive high-risk predictions at a location
 * and create alert if needed
 * 
 * Internal endpoint for backend use
 */
router.post('/check-consecutive/:location', async (req, res) => {
  try {
    const { location } = req.params;

    const recentHighRisk = await getRecentHighRiskPredictions(location);

    if (recentHighRisk.length >= 2) {
      // Create escalation alert for 2+ consecutive high-risk predictions
      const alert = await createHighRiskAlert(recentHighRisk, location);

      return res.json({
        success: true,
        message: `Alert created for ${recentHighRisk.length} consecutive high-risk predictions`,
        alert,
        predictions: recentHighRisk,
      });
    }

    return res.json({
      success: true,
      message: 'No consecutive high-risk predictions found',
      count: recentHighRisk.length,
      predictions: recentHighRisk,
    });
  } catch (error) {
    console.error('Error checking consecutive predictions:', error.message);
    return res.status(500).json({
      error: 'Failed to check consecutive predictions',
      detail: error.message,
    });
  }
});

module.exports = router;
