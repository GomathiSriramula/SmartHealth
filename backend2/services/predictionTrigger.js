/**
 * Prediction Trigger Service
 * 
 * Provides functions to automatically trigger predictions when:
 * - Water quality data is inserted
 * - Disease case reports are created
 * 
 * Handles errors gracefully without crashing the main process.
 */

const mlClient = require('./mlClient');
const Prediction = require('../models/Prediction');

/**
 * Trigger prediction for water quality data
 * Safe - does not throw errors, only logs them
 * 
 * @param {Object} waterQualityData - {pH, Turbidity, Dissolved_Oxygen}
 * @param {Object} options - {location, source}
 */
async function triggerPrediction(waterQualityData, options = {}) {
  try {
    // Validate minimum required data
    if (!waterQualityData.pH || !waterQualityData.Turbidity || !waterQualityData.Dissolved_Oxygen) {
      console.warn('[Prediction Trigger] Missing water quality data, skipping prediction');
      return null;
    }

    // Call ML service
    const mlResult = await mlClient.predict(waterQualityData);

    if (!mlResult.success) {
      console.error('[Prediction Trigger] ML prediction failed:', mlResult.error);
      return null;
    }

    // Store prediction
    const prediction = new Prediction({
      waterQuality: {
        pH: waterQualityData.pH,
        Turbidity: waterQualityData.Turbidity,
        Dissolved_Oxygen: waterQualityData.Dissolved_Oxygen
      },
      risk: mlResult.risk,
      confidence: mlResult.confidence,
      probabilities: mlResult.probabilities,
      location: options.location || 'unknown',
      source: options.source || 'auto'
    });

    await prediction.save();
    console.log(`[Prediction Trigger] Prediction saved: ${prediction._id} (${mlResult.risk})`);
    
    return prediction;

  } catch (error) {
    // Log error but don't throw - prediction failure should not crash the backend
    console.error('[Prediction Trigger] Error triggering prediction:', error.message);
    return null;
  }
}

module.exports = {
  triggerPrediction
};
