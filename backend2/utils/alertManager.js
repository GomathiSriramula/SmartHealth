/**
 * Alert Management System
 * 
 * Handles alert creation, escalation, and lifecycle management
 * Features:
 * - Consecutive HIGH prediction detection (2+ in 24h = escalation)
 * - Alert severity levels (low, medium, high, critical)
 * - Alert acknowledgment and resolution
 * - Email notifications for critical alerts
 * - Dashboard status tracking
 */

const mongoose = require('mongoose');
const { notifyAdminAlert } = require('./mailer');

// Import Alert model from mlPredictions route to avoid duplicate model definition
let Alert;

/**
 * Initialize Alert model - called after mlPredictions route is loaded
 */
function initializeAlertModel() {
  try {
    Alert = mongoose.model('MLAlert');
  } catch (error) {
    console.warn('MLAlert model not yet defined in alertManager');
  }
}

/**
 * Get Alert model with lazy initialization
 */
function getAlertModel() {
  if (!Alert) {
    try {
      Alert = mongoose.model('MLAlert');
    } catch (error) {
      console.error('MLAlert model not available:', error.message);
      throw new Error('Alert model not initialized');
    }
  }
  return Alert;
}

/**
 * Create or update an alert for high-risk predictions
 * @param {Array} predictions - Array of prediction documents with HIGH risk level
 * @param {string} location - Location identifier
 * @returns {Promise<Object>} Alert document
 */
async function createHighRiskAlert(predictions, location) {
  try {
    if (!Array.isArray(predictions) || predictions.length === 0) {
      throw new Error('predictions must be a non-empty array');
    }

    // Calculate water quality statistics from predictions
    const waterQualityStats = {
      minPH: Infinity,
      maxPH: -Infinity,
      maxTurbidity: 0,
      minDissolvedOxygen: Infinity,
    };

    predictions.forEach(pred => {
      const wq = pred.waterQualityInput || {};
      if (wq.pH) {
        waterQualityStats.minPH = Math.min(waterQualityStats.minPH, wq.pH);
        waterQualityStats.maxPH = Math.max(waterQualityStats.maxPH, wq.pH);
      }
      if (wq.Turbidity) {
        waterQualityStats.maxTurbidity = Math.max(
          waterQualityStats.maxTurbidity,
          wq.Turbidity
        );
      }
      if (wq.Dissolved_Oxygen) {
        waterQualityStats.minDissolvedOxygen = Math.min(
          waterQualityStats.minDissolvedOxygen,
          wq.Dissolved_Oxygen
        );
      }
    });

    const consecutiveCount = predictions.length;
    let severity = 'low';
    let description = '';

    // Determine severity based on consecutive count
    if (consecutiveCount >= 3) {
      severity = 'critical';
      description = `CRITICAL: ${consecutiveCount} consecutive HIGH-risk water quality predictions at ${location}! Immediate action required.`;
    } else if (consecutiveCount === 2) {
      severity = 'high';
      description = `Escalation: 2 consecutive HIGH-risk water quality predictions at ${location}. Increased monitoring required.`;
    } else {
      severity = 'medium';
      description = `Alert: HIGH-risk water quality prediction at ${location}`;
    }

    // Create alert document
    const AlertModel = getAlertModel();
    const alert = new AlertModel({
      alertType: 'consecutive_high_predictions',
      severity,
      status: 'active',
      consecutiveCount,
      predictions: predictions.map(p => p._id),
      location,
      description,
      details: {
        firstHighRiskTime: predictions[0].predictedDate,
        lastHighRiskTime: predictions[predictions.length - 1].predictedDate,
        waterQualityRange: {
          minPH: waterQualityStats.minPH === Infinity ? null : waterQualityStats.minPH,
          maxPH: waterQualityStats.maxPH === -Infinity ? null : waterQualityStats.maxPH,
          maxTurbidity: waterQualityStats.maxTurbidity,
          minDissolvedOxygen: waterQualityStats.minDissolvedOxygen === Infinity ? null : waterQualityStats.minDissolvedOxygen,
        },
      },
    });

    await alert.save();
    console.log(`✅ Alert created: ${alert._id} (severity: ${severity})`);

    // Send critical alerts via email
    if (severity === 'critical' || severity === 'high') {
      try {
        await notifyAdminAlert(alert);
        alert.notifications.emailSent = true;
        alert.notifications.emailSentAt = new Date();
        await alert.save();
      } catch (error) {
        console.error('Failed to send alert email:', error.message);
      }
    }

    return alert;
  } catch (error) {
    console.error('Error creating high-risk alert:', error.message);
    throw error;
  }
}

/**
 * Check for consecutive high-risk predictions at a location
 * Returns predictions from last 24 hours
 * @param {string} location - Location identifier
 * @returns {Promise<Array>} Array of recent HIGH-risk predictions
 */
async function getRecentHighRiskPredictions(location) {
  try {
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const predictions = await mongoose.model('MLPrediction').find({
      location,
      riskLevel: 'high',
      predictedDate: { $gte: fromDate },
    }).sort({ predictedDate: -1 });

    return predictions;
  } catch (error) {
    console.error('Error getting high-risk predictions:', error.message);
    return [];
  }
}

/**
 * Acknowledge an alert (mark as reviewed by operator)
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID acknowledging the alert
 * @returns {Promise<Object>} Updated alert
 */
async function acknowledgeAlert(alertId, userId) {
  try {
    const AlertModel = getAlertModel();
    const alert = await AlertModel.findByIdAndUpdate(
      alertId,
      {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      { new: true }
    );

    if (!alert) {
      throw new Error('Alert not found');
    }

    console.log(`✅ Alert acknowledged: ${alertId} by ${userId}`);
    return alert;
  } catch (error) {
    console.error('Error acknowledging alert:', error.message);
    throw error;
  }
}

/**
 * Resolve an alert with resolution notes
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID resolving the alert
 * @param {string} resolutionNotes - Notes about the resolution
 * @returns {Promise<Object>} Updated alert
 */
async function resolveAlert(alertId, userId, resolutionNotes = '') {
  try {
    const AlertModel = getAlertModel();
    const alert = await AlertModel.findByIdAndUpdate(
      alertId,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes,
      },
      { new: true }
    );

    if (!alert) {
      throw new Error('Alert not found');
    }

    console.log(`✅ Alert resolved: ${alertId} by ${userId}`);
    return alert;
  } catch (error) {
    console.error('Error resolving alert:', error.message);
    throw error;
  }
}

/**
 * Get all active alerts
 * @returns {Promise<Array>} Active alerts sorted by severity
 */
async function getActiveAlerts() {
  try {
    const AlertModel = getAlertModel();
    const alerts = await AlertModel.find({
      status: { $in: ['active', 'escalated'] },
    })
      .populate('predictions', 'riskLevel confidence predictedDate location')
      .sort({ severity: -1, createdAt: -1 });

    return alerts;
  } catch (error) {
    console.error('Error getting active alerts:', error.message);
    return [];
  }
}

/**
 * Get alert statistics
 * @returns {Promise<Object>} Alert stats
 */
async function getAlertStats() {
  try {
    const stats = await Alert.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          bySeverity: [
            {
              $group: {
                _id: '$severity',
                count: { $sum: 1 },
              },
            },
          ],
          byType: [
            {
              $group: {
                _id: '$alertType',
                count: { $sum: 1 },
              },
            },
          ],
          activeCount: [
            {
              $match: { status: 'active' },
            },
            {
              $count: 'count',
            },
          ],
          criticalCount: [
            {
              $match: {
                status: 'active',
                severity: 'critical',
              },
            },
            {
              $count: 'count',
            },
          ],
        },
      },
    ]);

    return {
      success: true,
      byStatus: Object.fromEntries(
        (stats[0].byStatus || []).map(s => [s._id, s.count])
      ),
      bySeverity: Object.fromEntries(
        (stats[0].bySeverity || []).map(s => [s._id, s.count])
      ),
      byType: Object.fromEntries(
        (stats[0].byType || []).map(s => [s._id, s.count])
      ),
      activeCount: stats[0].activeCount[0]?.count || 0,
      criticalCount: stats[0].criticalCount[0]?.count || 0,
    };
  } catch (error) {
    console.error('Error getting alert stats:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeAlertModel,
  getAlertModel,
  createHighRiskAlert,
  getRecentHighRiskPredictions,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertStats,
};
