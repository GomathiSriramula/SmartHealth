const express = require('express');
const Alert = require('../models/Alert');
const { sendAlertNotification } = require('../services/alertNotifier');

const router = express.Router();

/**
 * GET /api/alerts
 * List alerts with optional filtering and role-based access control
 * 
 * Role-based behavior:
 * - ADMIN: Returns all alerts (no restrictions)
 * - OPERATOR: Returns alerts for assigned locations only
 * - USER: Returns only ACTIVE alerts for assigned locations (hides metadata)
 */
router.get('/alerts', async (req, res) => {
  try {
    const { location, status = 'all', limit = 50, skip = 0 } = req.query;
    const user = req.user || {}; // User info from JWT token (set by authMiddleware)
    const userRole = user.role || 'USER';
    const userLocations = user.locations || [];

    // Build base filter from query parameters
    const filter = {};
    if (location) filter.location = location;
    if (status !== 'all') filter.status = status;

    // Apply role-based filtering
    if (userRole === 'ADMIN') {
      // ADMIN: No additional filtering - see all alerts
      console.log('🔓 ADMIN access: returning all alerts');
    } else if (userRole === 'OPERATOR') {
      // OPERATOR: Filter to assigned locations
      if (userLocations.length > 0) {
        filter.location = { $in: userLocations };
        console.log(`🔐 OPERATOR access: filtering to locations [${userLocations.join(', ')}]`);
      } else {
        // OPERATOR with no assigned locations gets empty result
        console.log('⚠️  OPERATOR with no assigned locations');
        return res.json({
          success: true,
          total: 0,
          count: 0,
          skip: parseInt(skip),
          limit: parseInt(limit),
          alerts: []
        });
      }
    } else {
      // USER: Filter to ACTIVE alerts at assigned locations only
      filter.status = 'active';
      if (userLocations.length > 0) {
        filter.location = { $in: userLocations };
        console.log(`🔐 USER access: filtering to ACTIVE alerts at locations [${userLocations.join(', ')}]`);
      } else {
        // USER with no assigned locations gets only global ACTIVE alerts
        console.log('⚠️  USER with no assigned locations - returning only ACTIVE alerts');
        filter.status = 'active';
      }
    }

    // Get total count with applied filters
    const total = await Alert.countDocuments(filter);

    // Get paginated results
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // For USER role, strip sensitive metadata fields
    let responseAlerts = alerts;
    if (userRole === 'USER') {
      responseAlerts = alerts.map(alert => {
        const alertObj = alert.toObject();
        // Remove internal metadata fields for USER role
        delete alertObj.metadata;
        delete alertObj.notificationError;
        delete alertObj.triggeringPredictions;
        return alertObj;
      });
    }

    return res.json({
      success: true,
      total,
      count: responseAlerts.length,
      skip: parseInt(skip),
      limit: parseInt(limit),
      userRole,
      alerts: responseAlerts,
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
 * Role-based access: ADMIN only
 */
router.post('/alerts/:id/notify', async (req, res) => {
  try {
    // Authorization: Only ADMIN can send notifications
    const userRole = (req.user && req.user.role) || 'USER';
    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only ADMIN can send notifications'
      });
    }

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
 * Role-based access: ADMIN and OPERATOR only
 */
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    // Authorization: Only ADMIN and OPERATOR can resolve alerts
    const userRole = (req.user && req.user.role) || 'USER';
    if (userRole === 'USER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only ADMIN and OPERATOR can resolve alerts'
      });
    }

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
