const Alert = require('../models/Alert');
const Prediction = require('../models/Prediction');

/**
 * Alert Checker Service
 * 
 * Implements the alert logic:
 * - Trigger alert on consecutive HIGH risks at same location
 * - Resolve alert when risk drops below HIGH
 * - Prevent duplicate alerts for same ongoing outbreak
 * 
 * Alert Rules:
 * 1. Need 2 consecutive HIGH predictions at same location
 * 2. Predictions must be recent (within 24 hours)
 * 3. No new alert if one already exists for this location
 * 4. Resolve previous alert if current prediction is not HIGH
 */

const ALERT_THRESHOLD = 2; // Need 2 consecutive HIGH risks
const TIME_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if current prediction should trigger or resolve an alert
 * 
 * @param {Object} prediction - The new prediction object from MongoDB
 * @returns {Promise<Object>} { alert: null|Alert, action: 'created'|'resolved'|'none', message: string }
 */
async function checkForAlerts(prediction) {
  try {
    if (!prediction || !prediction.location) {
      return {
        alert: null,
        action: 'none',
        message: 'Invalid prediction or missing location',
      };
    }

    const location = prediction.location;
    const currentRisk = prediction.risk;
    const currentTime = new Date();

    // Step 1: Check if there's an active alert for this location
    const activeAlert = await Alert.findOne({
      location: location,
      status: 'active',
    });

    // Step 2: If current prediction is not HIGH, resolve any active alert
    if (currentRisk !== 'HIGH') {
      if (activeAlert) {
        activeAlert.status = 'resolved';
        activeAlert.resolvedAt = currentTime;
        activeAlert.resolvedReason = `Risk dropped to ${currentRisk}`;
        await activeAlert.save();

        return {
          alert: activeAlert,
          action: 'resolved',
          message: `Alert resolved for ${location}: Risk dropped to ${currentRisk}`,
        };
      }

      return {
        alert: null,
        action: 'none',
        message: 'No active alert to resolve',
      };
    }

    // Step 3: If current prediction IS HIGH and there's an active alert, keep it
    if (activeAlert) {
      // Update the triggering predictions list
      if (!activeAlert.triggeringPredictions) {
        activeAlert.triggeringPredictions = [];
      }

      activeAlert.triggeringPredictions.push({
        predictionId: prediction._id,
        risk: prediction.risk,
        confidence: prediction.confidence,
        pH: prediction.waterQuality?.pH,
        Turbidity: prediction.waterQuality?.Turbidity,
        Dissolved_Oxygen: prediction.waterQuality?.Dissolved_Oxygen,
        predictedAt: prediction.predictedAt,
      });

      // Keep only last 5 triggering predictions
      if (activeAlert.triggeringPredictions.length > 5) {
        activeAlert.triggeringPredictions = activeAlert.triggeringPredictions.slice(-5);
      }

      await activeAlert.save();

      return {
        alert: activeAlert,
        action: 'none',
        message: `Active alert exists for ${location}, not creating duplicate`,
      };
    }

    // Step 4: Current is HIGH and no active alert - check for consecutive HIGH risks
    const recentHighRisks = await Prediction.find({
      location: location,
      risk: 'HIGH',
      predictedAt: {
        $gte: new Date(currentTime.getTime() - TIME_WINDOW),
      },
    })
      .sort({ predictedAt: -1 })
      .limit(ALERT_THRESHOLD);

    // We need at least 2 predictions (including current one)
    // The query above won't include the current one yet, so we need to check if we have 1+ previous HIGH
    if (recentHighRisks.length >= ALERT_THRESHOLD - 1) {
      // Create new alert
      const newAlert = new Alert({
        location: location,
        riskLevel: 'HIGH',
        reason: `Consecutive ${ALERT_THRESHOLD} HIGH risk predictions at ${location}`,
        triggeringPredictions: [
          // Add the previous HIGH predictions
          ...recentHighRisks.slice(0, ALERT_THRESHOLD - 1).map((pred) => ({
            predictionId: pred._id,
            risk: pred.risk,
            confidence: pred.confidence,
            pH: pred.waterQuality?.pH,
            Turbidity: pred.waterQuality?.Turbidity,
            Dissolved_Oxygen: pred.waterQuality?.Dissolved_Oxygen,
            predictedAt: pred.predictedAt,
          })),
          // Add the current prediction
          {
            predictionId: prediction._id,
            risk: prediction.risk,
            confidence: prediction.confidence,
            pH: prediction.waterQuality?.pH,
            Turbidity: prediction.waterQuality?.Turbidity,
            Dissolved_Oxygen: prediction.waterQuality?.Dissolved_Oxygen,
            predictedAt: prediction.predictedAt,
          },
        ],
        status: 'active',
        notificationSent: false,
        metadata: {
          sourceRequest: 'auto-detection',
          triggeredBy: 'prediction-check',
          escalationLevel: 1,
        },
      });

      await newAlert.save();

      return {
        alert: newAlert,
        action: 'created',
        message: `Alert created for ${location}: ${ALERT_THRESHOLD} consecutive HIGH predictions`,
      };
    }

    return {
      alert: null,
      action: 'none',
      message: `Insufficient consecutive HIGH risks at ${location} (need ${ALERT_THRESHOLD})`,
    };
  } catch (error) {
    console.error('[AlertChecker] Error checking for alerts:', error.message);
    return {
      alert: null,
      action: 'error',
      message: `Alert check failed: ${error.message}`,
    };
  }
}

/**
 * Get active alerts for a location
 * 
 * @param {string} location - Location to check
 * @returns {Promise<Array>} Array of active alerts
 */
async function getActiveAlerts(location) {
  try {
    return await Alert.find({
      location: location,
      status: 'active',
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[AlertChecker] Error getting active alerts:', error.message);
    return [];
  }
}

/**
 * Mark alert as notified
 * 
 * @param {string} alertId - Alert ID
 * @param {boolean} success - Notification success status
 * @param {string} error - Error message if failed
 * @returns {Promise<Object>} Updated alert
 */
async function markAlertNotified(alertId, success, error = null) {
  try {
    const alert = await Alert.findByIdAndUpdate(
      alertId,
      {
        notificationSent: success,
        notificationTimestamp: new Date(),
        notificationError: error,
      },
      { new: true }
    );

    return alert;
  } catch (err) {
    console.error('[AlertChecker] Error marking alert notified:', err.message);
    return null;
  }
}

module.exports = {
  checkForAlerts,
  getActiveAlerts,
  markAlertNotified,
};
