const express = require('express');
const Alert = require('../models/Alert');
const { sendAlertNotification } = require('../services/alertNotifier');
const { authMiddleware, buildDistrictFilter, operatorMatchesDistrict } = require('../utils/auth');

const router = express.Router();

/**
 * GET /api/alerts
 * List alerts with optional filtering and role-based access control
 * 
 * Role-based behavior:
 * - ADMIN/OPERATOR/USER: Returns alerts from all locations
 */
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { location, status = 'all', limit = 50, skip = 0 } = req.query;
    const userRole = req.user.role || 'USER';

    // Build base filter from query parameters
    const filter = buildDistrictFilter(req.user);
    if (location) {
      filter.location = new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (status !== 'all') filter.status = status;

    if (req.user.role === 'OPERATOR' && location && !operatorMatchesDistrict(req.user, location)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Operators can only access alerts for their assigned district'
      });
    }

    // Get total count with applied filters
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
      userRole,
      alerts: alerts,
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
 * 
 * Role-based access control:
 * - ADMIN/OPERATOR/USER: Can access any alert
 */
router.get('/alerts/:id', authMiddleware, async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, ...buildDistrictFilter(req.user) });

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
 *
 * Role-based access:
 * - ADMIN: any alert
 * - OPERATOR: only alerts in their own assigned district
 */
router.post('/alerts/:id/notify', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role || 'USER';
    if (userRole !== 'ADMIN' && userRole !== 'OPERATOR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only ADMIN or OPERATOR can send notifications'
      });
    }

    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    // Operators may only act on alerts within their own district
    if (userRole === 'OPERATOR' && !operatorMatchesDistrict(req.user, alert.location)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Operators can only send notifications for alerts in their assigned district'
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
 *
 * Role-based access:
 * - ADMIN: any alert
 * - OPERATOR: only alerts in their own assigned district
 */
router.post('/alerts/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role || 'USER';
    if (userRole !== 'ADMIN' && userRole !== 'OPERATOR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only ADMIN or OPERATOR can resolve alerts'
      });
    }

    // Fetch alert to check its location
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    // Operators may only act on alerts within their own district
    if (userRole === 'OPERATOR' && !operatorMatchesDistrict(req.user, alert.location)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Operators can only resolve alerts in their assigned district'
      });
    }

    // Update alert status
    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedReason: req.body.reason || 'Manually resolved',
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: 'Alert resolved',
      alert: updatedAlert,
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
 * 
 * Role-based statistics:
 * - ADMIN/OPERATOR/USER: Returns statistics for all alerts
 */
router.get('/alerts/stats/summary', authMiddleware, async (req, res) => {
  try {
    let query = buildDistrictFilter(req.user);

    // Total alerts
    const totalAlerts = await Alert.countDocuments(query);

    // Active alerts
    const activeAlerts = await Alert.countDocuments({ ...query, status: 'active' });

    // Resolved alerts
    const resolvedAlerts = await Alert.countDocuments({ ...query, status: 'resolved' });

    // Alerts by location
    const alertsByLocation = await Alert.aggregate([
      { $match: query },
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
      { $match: query },
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