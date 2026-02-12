const express = require('express');
const Alert = require('../models/Alert');
const { sendAlertNotification } = require('../services/alertNotifier');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

/**
 * GET /api/alerts
 * List alerts with optional filtering and role-based access control
 * 
 * Role-based behavior:
 * - ADMIN: Returns alerts only from their assigned village
 * - OPERATOR: Returns alerts from all locations (no restrictions)
 * - USER: Returns alerts from all locations (no restrictions)
 */
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { location, status = 'all', limit = 50, skip = 0 } = req.query;
    const userRole = req.user.role || 'USER';
    const adminLocation = req.user.adminLocation;

    // Build base filter from query parameters
    const filter = {};
    if (location) filter.location = location;
    if (status !== 'all') filter.status = status;

    // Apply role-based filtering
    if (userRole === 'ADMIN') {
      // ADMIN: Filter to their assigned village
      if (!adminLocation || !adminLocation.village) {
        return res.status(500).json({
          error: 'Admin location not configured',
          detail: 'Admin user is missing location assignment'
        });
      }
      filter.location = new RegExp(`^${adminLocation.village}$`, 'i');
      console.log(`🔐 ADMIN access: filtering alerts to village '${adminLocation.village}'`);
    } else if (userRole === 'OPERATOR') {
      // OPERATOR: No location filtering - see all alerts
      console.log('🔓 OPERATOR access: returning all alerts');
    } else {
      // USER: No location filtering - see all alerts
      console.log('🔓 USER access: returning all alerts');
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
 * - ADMIN: Can only access alerts from their assigned village (403 if different village)
 * - OPERATOR/USER: Can access any alert
 */
router.get('/alerts/:id', authMiddleware, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
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
      // Check if alert's location matches admin's village (case-insensitive)
      const adminVillage = adminLocation.village.toLowerCase().trim();
      const alertLocation = (alert.location || '').toLowerCase().trim();
      if (adminVillage !== alertLocation) {
        return res.status(403).json({
          error: 'Forbidden',
          detail: `You can only access alerts from your assigned village (${adminLocation.village})`
        });
      }
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
router.post('/alerts/:id/notify', authMiddleware, async (req, res) => {
  try {
    // Authorization: Only ADMIN can send notifications
    const userRole = req.user.role || 'USER';
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
 * 
 * Security Rules:
 * - Only ADMIN users can resolve alerts
 * - ADMIN must have location configured
 * - Alert location must match admin's assigned village (case-insensitive)
 * - USER and OPERATOR roles receive 403 Forbidden
 * - Returns 403 if ADMIN tries to resolve alert outside their village
 */
router.post('/alerts/:id/resolve', authMiddleware, async (req, res) => {
  try {
    // Authorization: Only ADMIN can resolve alerts
    const userRole = req.user.role || 'USER';
    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only admins can resolve alerts'
      });
    }

    // ADMIN must have location configured
    const adminLocation = req.user.adminLocation;
    if (!adminLocation || !adminLocation.village) {
      return res.status(500).json({
        success: false,
        error: 'Admin location not configured',
        detail: 'Admin user is missing location assignment'
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

    // Validate ADMIN can only resolve alerts from their assigned village
    const adminVillage = adminLocation.village.toLowerCase().trim();
    const alertLocation = (alert.location || '').toLowerCase().trim();
    
    if (adminVillage !== alertLocation) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        detail: `You can only resolve alerts from your assigned village (${adminLocation.village})`,
        expectedVillage: adminLocation.village,
        receivedVillage: alert.location,
        alertId: alert._id
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
 * - ADMIN: Returns statistics only for alerts in their assigned village
 * - OPERATOR/USER: Returns statistics for all alerts
 */
router.get('/alerts/stats/summary', authMiddleware, async (req, res) => {
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
    // OPERATOR and USER: No location filter (see statistics for all records)
    
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
