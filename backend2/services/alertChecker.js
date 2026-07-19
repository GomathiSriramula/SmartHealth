const Alert = require('../models/Alert');
const { Prediction } = require('../models'); // Use the same Prediction model as predictions route
const { notifyAlertCreation } = require('../utils/mailer');

/**
 * Alert Checker Service
 * 
 * Implements the alert logic:
 * - Trigger alert on TWO consecutive HIGH risks at same location
 * - Resolve alert when risk drops below HIGH
 * - Prevent duplicate alerts for same ongoing outbreak
 * 
 * Alert Rules:
 * 1. Need exactly TWO consecutive HIGH predictions at same location
 *    (set ALERT_THRESHOLD = 1 below if a single HIGH should trigger instead)
 * 2. Predictions must be recent (configurable, default 48 hours)
 * 3. No new alert if one already exists for this location
 * 4. Resolve previous alert if current prediction is not HIGH
 * 5. A single HIGH must NOT trigger alert (at ALERT_THRESHOLD = 2)
 */

const ALERT_THRESHOLD = 2; // Need exactly 2 consecutive HIGH risks
const DEFAULT_TIME_WINDOW = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const TIME_WINDOW = process.env.ALERT_TIME_WINDOW_MS || DEFAULT_TIME_WINDOW;

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
    // Support both 'risk' and 'riskLevel' field names (from different prediction sources)
    const currentRisk = (prediction.risk || prediction.riskLevel || 'unknown').toLowerCase();
    const currentTime = new Date();

    console.log(`[Alert Checker] Checking location: ${location}, current risk: ${currentRisk}`);

    // Step 1: Check if there's an active alert for this location
    const activeAlert = await Alert.findOne({
      location: location,
      status: 'active',
    });

    // Step 2: If current prediction is not HIGH, resolve any active alert
    if (currentRisk !== 'high') {
      if (activeAlert) {
        activeAlert.status = 'resolved';
        activeAlert.resolvedAt = currentTime;
        activeAlert.resolvedReason = `Risk dropped to ${currentRisk}`;
        await activeAlert.save();

        console.log(`✅ [Alert Resolver] Alert resolved for ${location} - Risk: ${currentRisk}`);

        return {
          alert: activeAlert,
          action: 'resolved',
          message: `Alert resolved for ${location}: Risk dropped to ${currentRisk}`,
        };
      }

      console.log(`📊 [Alert Checker] Risk is ${currentRisk} (not HIGH) - no alert needed`);
      return {
        alert: null,
        action: 'none',
        message: 'No active alert to resolve',
      };
    }

    // Step 3: Current prediction IS HIGH
    console.log(`🔴 [Alert Checker] Current prediction is HIGH (risk: ${currentRisk}) at ${location}`);

    // If there's already an active alert, keep it (don't create duplicate)
    if (activeAlert) {
      // Update the triggering predictions list
      if (!activeAlert.triggeringPredictions) {
        activeAlert.triggeringPredictions = [];
      }

      activeAlert.triggeringPredictions.push({
        predictionId: prediction._id,
        risk: prediction.risk || prediction.riskLevel,
        confidence: prediction.confidence,
        predictedAt: prediction.predictedAt || prediction.predictedDate,
      });

      // Keep only last 5 triggering predictions
      if (activeAlert.triggeringPredictions.length > 5) {
        activeAlert.triggeringPredictions = activeAlert.triggeringPredictions.slice(-5);
      }

      await activeAlert.save();

      console.log(`📌 [Alert Checker] Active alert already exists - not creating duplicate. Updated with latest prediction.`);

      return {
        alert: activeAlert,
        action: 'none',
        message: `Active alert exists for ${location}, not creating duplicate`,
      };
    }

    // Step 4: NO active alert exists yet.

    // Step 4a: Threshold is 1 (default) — a single HIGH is enough. Create the
    // alert immediately, no need to look for previous HIGH predictions.
    if (ALERT_THRESHOLD <= 1) {
      console.log(`✅ [Alert Creator] THRESHOLD MET: single HIGH risk detected at ${location} — creating alert immediately.`);

      const newAlert = new Alert({
        location: location,
        riskLevel: 'HIGH',
        reason: `HIGH risk assessment recorded at ${location}`,
        triggeringPredictions: [
          {
            predictionId: prediction._id,
            risk: prediction.risk || prediction.riskLevel,
            confidence: prediction.confidence,
            predictedAt: prediction.predictedAt || prediction.predictedDate,
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

      console.log(`🚨 [Alert Creator] NEW ALERT CREATED: ${newAlert._id} for location: ${location}`);

      // 🔑 This is the ONLY place that emails about a newly-created alert.
      // Callers (predictions.js, reports.js, uploads.js) must NOT send their
      // own follow-up email when action === 'created' — they should read
      // the `notification` field on this return value instead. Sending
      // again in the caller used to cause every auto-created alert to email
      // admins/operator 2-3 times (once here, once per caller).
      let notificationResult;
      try {
        notificationResult = await notifyAlertCreation(newAlert);
        if (notificationResult.success) {
          console.log(`✅ [Alert Notification] ${notificationResult.message}`);
        } else {
          console.warn(`⚠️  [Alert Notification] Failed but continuing: ${notificationResult.message}`);
        }
      } catch (notificationError) {
        console.error(`⚠️  [Alert Notification] Error (non-blocking): ${notificationError.message}`);
        notificationResult = { success: false, message: notificationError.message };
      }

      // Persist the outcome — mailer.js's notifyAlertCreation only READS
      // alert.notificationSent for its own idempotency guard, it never WRITES
      // it, so without this the flag stays false in the DB forever and the
      // guard never actually blocks anything (this was the root cause of the
      // duplicate sends). This also lets the manual "Notify" button correctly
      // see the alert as already-notified once this succeeds.
      await markAlertNotified(
        newAlert._id,
        notificationResult.success,
        notificationResult.success ? null : (notificationResult.message || notificationResult.error || 'Unknown error')
      );
      newAlert.notificationSent = notificationResult.success;

      return {
        alert: newAlert,
        action: 'created',
        message: `Alert created for ${location}: HIGH risk assessment recorded`,
        notification: notificationResult,
      };
    }

    // Step 4b: Threshold > 1 — look for enough previous consecutive HIGH
    // predictions at this location within the time window before creating
    // an alert. (Kept for cases where ALERT_THRESHOLD is raised back above 1.)
    console.log(`🔍 [Alert Checker] No active alert. Looking for previous HIGH predictions in ${location}...`);

    const timeWindowStart = new Date(currentTime.getTime() - TIME_WINDOW);

    const recentHighRisks = await Prediction.find({
      location: location,
      $and: [
        {
          $or: [
            { risk: { $in: ['HIGH', 'high'] } },
            { riskLevel: { $in: ['HIGH', 'high'] } } // Support alternate field name
          ]
        },
        {
          $or: [
            { predictedAt: { $gte: timeWindowStart } },
            { predictedDate: { $gte: timeWindowStart } } // Support alternate field name
          ]
        }
      ],
      _id: { $ne: prediction._id }, // Exclude current prediction
    })
      .sort({ predictedAt: -1, predictedDate: -1 })
      .limit(ALERT_THRESHOLD - 1); // Get up to (threshold - 1) previous HIGHs

    console.log(`   Found ${recentHighRisks.length} previous HIGH predictions in time window`);

    // We need ALERT_THRESHOLD total HIGH predictions (including current)
    if (recentHighRisks.length >= ALERT_THRESHOLD - 1) {
      console.log(`✅ [Alert Creator] THRESHOLD MET: ${ALERT_THRESHOLD} total consecutive HIGHs detected!`);

      // Create new alert
      const newAlert = new Alert({
        location: location,
        riskLevel: 'HIGH',
        reason: `${ALERT_THRESHOLD} consecutive HIGH risk assessments at ${location}`,
        triggeringPredictions: [
          // Add the previous HIGH predictions
          ...recentHighRisks.slice(0, ALERT_THRESHOLD - 1).map((pred) => ({
            predictionId: pred._id,
            risk: pred.risk || pred.riskLevel,
            confidence: pred.confidence,
            predictedAt: pred.predictedAt || pred.predictedDate,
          })),
          // Add the current prediction
          {
            predictionId: prediction._id,
            risk: prediction.risk || prediction.riskLevel,
            confidence: prediction.confidence,
            predictedAt: prediction.predictedAt || prediction.predictedDate,
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

      console.log(`🚨 [Alert Creator] NEW ALERT CREATED: ${newAlert._id} for location: ${location}`);

      // 🔑 This is the ONLY place that emails about a newly-created alert.
      // Callers (predictions.js, reports.js, uploads.js) must NOT send their
      // own follow-up email when action === 'created' — they should read
      // the `notification` field on this return value instead. Sending
      // again in the caller used to cause every auto-created alert to email
      // admins/operator 2-3 times (once here, once per caller).
      let notificationResult;
      try {
        notificationResult = await notifyAlertCreation(newAlert);
        if (notificationResult.success) {
          console.log(
            `✅ [Alert Notification] ${notificationResult.message}`
          );
        } else {
          console.warn(
            `⚠️  [Alert Notification] Failed but continuing: ${notificationResult.message}`
          );
        }
      } catch (notificationError) {
        // Don't fail alert creation if notification fails (safety)
        console.error(
          `⚠️  [Alert Notification] Error (non-blocking): ${notificationError.message}`
        );
        notificationResult = { success: false, message: notificationError.message };
      }

      // Persist the outcome — see comment in the threshold<=1 branch above
      // for why this write is required (mailer.js never does it itself).
      await markAlertNotified(
        newAlert._id,
        notificationResult.success,
        notificationResult.success ? null : (notificationResult.message || notificationResult.error || 'Unknown error')
      );
      newAlert.notificationSent = notificationResult.success;

      return {
        alert: newAlert,
        action: 'created',
        message: `Alert created for ${location}: ${ALERT_THRESHOLD} consecutive HIGH risk assessments`,
        notification: notificationResult,
      };
    }

    console.log(`⏳ [Alert Checker] Only ${recentHighRisks.length + 1} HIGH prediction(s) so far - need ${ALERT_THRESHOLD} consecutive. Waiting for next prediction.`);

    return {
      alert: null,
      action: 'none',
      message: `Insufficient consecutive HIGH risks at ${location} (have ${recentHighRisks.length + 1}, need ${ALERT_THRESHOLD})`,
    };
  } catch (error) {
    console.error('[Alert Checker] Error checking for alerts:', error.message);
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