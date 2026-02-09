const express = require('express');
const Alert = require('../models/Alert');
const { sendAlertNotification } = require('../services/alertNotifier');

const router = express.Router();

/**
 * GET /api/alerts
 * List alerts with optional filtering
 */
router.get('/alerts', async (req, res) => {
  try {
    const { location, status = 'all', limit = 50, skip = 0 } = req.query;

    // Build filter
    const filter = {};
    if (location) filter.location = location;
    if (status !== 'all') filter.status = status;

    // Get total count
    const total = await Alert.countDocuments(filter);

    // Get paginated results
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    return res.json({
      success: true,
      total,
      count: alerts.length,
      skip: parseInt(skip),
      limit: parseInt(limit),
      alerts,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error listing alerts:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to list alerts',
      detail: error.message,
    });
  }
});

/**
 * GET /api/alerts/:id
 * Get alert details
 */
router.get('/alerts/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    return res.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error getting alert:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to get alert',
      detail: error.message,
    });
  }
});

/**
 * POST /api/alerts/:id/notify
 * Manually send notification for an alert
 * Idempotent - safe to call multiple times
 */
router.post('/alerts/:id/notify', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    // Get recipients from request or use defaults
    const recipients = req.body.recipients || [process.env.ADMIN_EMAIL || 'admin@smarthealthwatersystem.com'];

    // Send notification
    const result = await sendAlertNotification(alert, recipients);

    return res.json({
      success: result.success,
      message: result.message,
      alert,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error sending notification:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      detail: error.message,
    });
  }
});

/**
 * POST /api/alerts/:id/resolve
 * Manually resolve an alert
 */
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedReason: req.body.reason || 'Manually resolved',
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    return res.json({
      success: true,
      message: 'Alert resolved',
      alert,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error resolving alert:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      detail: error.message,
    });
  }
});

/**
 * GET /api/alerts/stats/summary
 * Get alert statistics
 */
router.get('/alerts/stats/summary', async (req, res) => {
  try {
    // Total alerts
    const totalAlerts = await Alert.countDocuments();

    // Active alerts
    const activeAlerts = await Alert.countDocuments({ status: 'active' });

    // Resolved alerts
    const resolvedAlerts = await Alert.countDocuments({ status: 'resolved' });

    // Alerts by location
    const alertsByLocation = await Alert.aggregate([
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
            },
          },
          resolvedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Notifications sent vs failed
    const notificationStats = await Alert.aggregate([
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          notificationsSent: {
            $sum: { $cond: [{ $eq: ['$notificationSent', true] }, 1, 0] },
          },
          notificationsFailed: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$notificationSent', false] }, { $ne: ['$notificationError', null] }] }, 1, 0],
            },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      stats: {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        alertsByLocation,
        notificationStats: notificationStats[0] || {
          totalAlerts: 0,
          notificationsSent: 0,
          notificationsFailed: 0,
        },
      },
    });
  } catch (error) {
    console.error('[AlertsAPI] Error getting statistics:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      detail: error.message,
    });
  }
});

module.exports = router;
