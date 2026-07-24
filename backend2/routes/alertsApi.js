const express = require('express');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { sendAlertNotification } = require('../services/alertNotifier');
const { authMiddleware, requireRole, buildDistrictFilter, operatorMatchesDistrict } = require('../utils/auth');
const { getManualNotificationRecipients } = require('../utils/notificationRecipients');
const { getDistrictCoordinates } = require('../utils/districtCoordinates');
const { CaseReport, Prediction } = require('../models');
const { logAudit } = require('../utils/auditLogger');

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

    const limitVal = parseInt(limit, 10) || 50;
    const skipVal = parseInt(skip, 10) || 0;

    // Build base filter from query parameters
    const filter = buildDistrictFilter(req.user);
    if (location) {
      // Substring (contains) match, case-insensitive — lets ADMIN/USER search
      // by a partial district name instead of requiring the exact value.
      // (OPERATOR requests are still locked to their own district below.)
      const trimmedLocation = location.trim();
      if (trimmedLocation) {
        filter.location = new RegExp(trimmedLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
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
      .limit(limitVal)
      .skip(skipVal);

    return res.json({
      success: true,
      total,
      count: alerts.length,
      skip: skipVal,
      limit: limitVal,
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
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
 * Role-based access AND recipients:
 * - ADMIN:    can notify any alert -> recipients = operator of that alert's district
 * - OPERATOR: only alerts in their own assigned district -> recipients = all admins
 * - Regular USERS are forbidden from sending, and are never a recipient.
 */
router.post('/alerts/:id/notify', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
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

    // 🔒 Recipients are derived from WHO is sending — never from client input:
    //   - OPERATOR sends -> notify ALL admins
    //   - ADMIN sends    -> notify ONLY the operator of the affected district
    // Regular USERS are blocked above and are never notified.
    const recipients = await getManualNotificationRecipients(req.user, alert.location);

    if (recipients.length === 0) {
      return res.json({
        success: true,
        message:
          userRole === 'ADMIN'
            ? 'No operator assigned to this district — nothing to notify'
            : 'No admins found to notify',
        alert,
      });
    }

    // Send notification
    const result = await sendAlertNotification(alert, recipients);

    // Re-fetch: sendAlertNotification just persisted notificationSent/
    // notificationTimestamp/notificationError on this doc, but `alert`
    // above is a pre-notification snapshot. Without this, the UI's
    // "already notified" state never updates until a full page refresh.
    const updatedAlert = await Alert.findById(req.params.id);

    await logAudit({
      action: 'NOTIFY_ALERT',
      req,
      village: updatedAlert.location,
      entityId: updatedAlert._id,
      metadata: {
        riskLevel: updatedAlert.riskLevel,
        location: updatedAlert.location,
        recipientCount: recipients.length,
        notificationSuccess: result.success,
      },
    });

    return res.json({
      success: result.success,
      message: result.message,
      alert: updatedAlert,
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
 * POST /api/alerts/:id/acknowledge
 * Mark an alert as reviewed/acknowledged (does not resolve it).
 *
 * Role-based access (same district scoping as resolve/notify above):
 * - ADMIN:    can acknowledge any alert
 * - OPERATOR: only alerts in their own assigned district
 * - Regular USERS are forbidden.
 *
 * Ported from the legacy /alerts router, which previously fetched the
 * alert but never persisted the acknowledgment — see acknowledgedAt/
 * acknowledgedBy on the Alert model.
 */
router.post('/alerts/:id/acknowledge', authMiddleware, requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
    const userRole = req.user.role || 'USER';

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
        message: 'Operators can only acknowledge alerts in their assigned district'
      });
    }

    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user.username,
      },
      { new: true }
    );

    await logAudit({
      action: 'ACKNOWLEDGE_ALERT',
      req,
      village: updatedAlert.location,
      entityId: updatedAlert._id,
      metadata: {
        riskLevel: updatedAlert.riskLevel,
        location: updatedAlert.location,
      },
    });

    return res.json({
      success: true,
      message: 'Alert acknowledged',
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error acknowledging alert:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
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

    await logAudit({
      action: 'RESOLVE_ALERT',
      req,
      village: updatedAlert.location,
      entityId: updatedAlert._id,
      metadata: {
        riskLevel: updatedAlert.riskLevel,
        location: updatedAlert.location,
        resolutionNotes: req.body.reason || 'Manually resolved',
      },
    });

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
 *
 * Query parameters:
 * - location: optional substring (contains) match, case-insensitive, same
 *   semantics as GET /api/alerts, so the summary cards on the Alerts tab
 *   can reflect the same "Search by district" filter as the list below
 *   them instead of always showing system-wide totals.
 */
router.get('/alerts/stats/summary', authMiddleware, async (req, res) => {
  try {
    let query = buildDistrictFilter(req.user);

    const { location } = req.query;
    if (location) {
      const trimmedLocation = location.trim();
      if (trimmedLocation) {
        if (req.user.role === 'OPERATOR' && !operatorMatchesDistrict(req.user, trimmedLocation)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Operators can only view statistics for their assigned district',
          });
        }
        query.location = new RegExp(trimmedLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
    }

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

/**
 * GET /api/alerts/map/locations
 * Outbreak locations for the interactive map.
 *
 * Role-based access control (same district scoping as GET /api/alerts):
 * - USER:     all PUBLIC outbreak locations, active only, minimal fields
 * - OPERATOR: only locations within their assigned district
 * - ADMIN:    all locations; may pass ?status=all to include resolved ones
 *
 * Privacy: markers are placed at DISTRICT-LEVEL coordinates only. This
 * endpoint never returns individual case reports, patient age/sex/symptoms,
 * reporter identity, or exact case coordinates — only an aggregated
 * outbreak status per district.
 */
router.get('/alerts/map/locations', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role || 'USER';

    // District scoping — identical rule used everywhere else in this file:
    // {} for USER/ADMIN (no restriction), locked to own district for OPERATOR.
    const filter = buildDistrictFilter(req.user);

    // The public only ever sees CURRENT outbreaks. ADMIN/OPERATOR may opt
    // into seeing resolved ones too via ?status=all.
    const requestedStatus = (req.query.status || 'active').toLowerCase();
    if (userRole === 'USER') {
      filter.status = 'active';
    } else if (requestedStatus !== 'all') {
      filter.status = requestedStatus;
    }

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).lean();

    // Group by district — a district can have more than one alert record
    // (e.g. one resolved, one currently active).
    const byLocation = new Map();
    const riskRank = { LOW: 0, MEDIUM: 1, HIGH: 2 };

    for (const alert of alerts) {
      const key = (alert.location || '').trim().toLowerCase();
      if (!key) continue;

      if (!byLocation.has(key)) {
        byLocation.set(key, {
          location: alert.location,
          riskLevel: alert.riskLevel || 'LOW',
          status: alert.status,
          alertCount: 0,
          activeCount: 0,
          resolvedCount: 0,
          lastUpdated: alert.createdAt,
          reasons: [],
        });
      }

      const entry = byLocation.get(key);
      entry.alertCount += 1;
      if (alert.status === 'active') entry.activeCount += 1;
      if (alert.status === 'resolved') entry.resolvedCount += 1;

      // Worst risk level wins for the marker
      if ((riskRank[alert.riskLevel] ?? 0) > (riskRank[entry.riskLevel] ?? 0)) {
        entry.riskLevel = alert.riskLevel;
      }
      // If any alert for this district is active, the district reads as active
      if (alert.status === 'active') entry.status = 'active';

      if (alert.createdAt && new Date(alert.createdAt) > new Date(entry.lastUpdated)) {
        entry.lastUpdated = alert.createdAt;
      }

      if (alert.reason) entry.reasons.push(alert.reason);
    }

    // Resolve coordinates for each district, then build the final payload.
    const locations = [];
    for (const entry of byLocation.values()) {
      let coords = getDistrictCoordinates(entry.location);

      // Fallback: average of the underlying case reports' coordinates for
      // this district. Only an aggregate number is computed/returned —
      // no individual report is ever read out here.
      if (!coords) {
        const districtRegex = new RegExp(
          `^${entry.location.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        );
        const agg = await CaseReport.aggregate([
          { $match: { location: districtRegex, lat: { $exists: true, $ne: null }, lng: { $exists: true, $ne: null } } },
          { $group: { _id: null, lat: { $avg: '$lat' }, lng: { $avg: '$lng' } } },
        ]);
        if (agg.length > 0 && agg[0].lat != null && agg[0].lng != null) {
          coords = { lat: agg[0].lat, lng: agg[0].lng };
        }
      }

      // Skip districts we truly can't place on the map rather than guessing
      if (!coords) continue;

      const base = {
        location: entry.location,
        riskLevel: entry.riskLevel,
        status: entry.status,
        alertCount: entry.alertCount,
        lastUpdated: entry.lastUpdated,
        lat: coords.lat,
        lng: coords.lng,
      };

      // Extra operational detail only for management roles — never for USER
      if (userRole === 'ADMIN' || userRole === 'OPERATOR') {
        base.activeCount = entry.activeCount;
        base.resolvedCount = entry.resolvedCount;
        base.reasons = entry.reasons.slice(0, 5);
      }

      locations.push(base);
    }

    return res.json({
      success: true,
      userRole,
      count: locations.length,
      locations,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error getting map locations:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to get outbreak map locations',
      detail: error.message,
    });
  }
});

/**
 * Ported from the legacy /alerts router's check-consecutive helpers.
 * Used only by POST /api/alerts/check-consecutive/:location below.
 */
async function getRecentHighRiskPredictions(location) {
  const fromDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return await Prediction.find({
    location,
    riskLevel: { $in: ['high', 'HIGH'] },
    predictedDate: { $gte: fromDate },
  }).sort({ predictedDate: -1 });
}

async function createHighRiskAlert(predictions, location) {
  const newAlert = new Alert({
    location: location,
    riskLevel: 'HIGH',
    reason: `${predictions.length} consecutive HIGH risk assessments at ${location}`,
    triggeringPredictions: predictions.map((pred) => ({
      predictionId: pred._id,
      risk: pred.risk || pred.riskLevel,
      confidence: pred.confidence,
      predictedAt: pred.predictedAt || pred.predictedDate,
    })),
    status: 'active',
    notificationSent: false,
  });
  await newAlert.save();
  return newAlert;
}

/**
 * POST /api/alerts/check-consecutive/:location
 * Check for consecutive high-risk predictions at a location and create an
 * alert if needed.
 *
 * Internal maintenance endpoint — ADMIN only, same as the legacy router.
 * This can create alerts and trigger outbreak emails to every admin/
 * operator, so it must never be reachable without authentication. There is
 * no OPERATOR access at all here (unlike resolve/notify/acknowledge above),
 * so no per-district scoping is needed — only ADMIN can call this.
 */
router.post('/alerts/check-consecutive/:location', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { location } = req.params;

    const recentHighRisk = await getRecentHighRiskPredictions(location);

    if (recentHighRisk.length >= 2) {
      const alert = await createHighRiskAlert(recentHighRisk, location);

      return res.json({
        success: true,
        message: `Alert created for ${recentHighRisk.length} consecutive high-risk assessments`,
        alert,
        predictions: recentHighRisk,
      });
    }

    return res.json({
      success: true,
      message: 'No consecutive high-risk assessments found',
      count: recentHighRisk.length,
      predictions: recentHighRisk,
    });
  } catch (error) {
    console.error('[AlertsAPI] Error checking consecutive predictions:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check consecutive predictions',
      detail: error.message,
    });
  }
});

module.exports = router;