/**
 * ML Service Client
 * 
 * Simple HTTP client for communicating with the Flask ML prediction service.
 * Handles prediction requests and error handling.
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_TIMEOUT = 10000; // 10 seconds

// Create axios instance for ML service
const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: ML_TIMEOUT,
  headers: { 'Content-Type': 'application/json' }
});

/**
 * Check if ML service is available
 */
async function checkHealth() {
  try {
    const response = await mlClient.get('/health');
    return {
      healthy: response.status === 200,
      data: response.data
    };
  } catch (error) {
    console.error('[ML Client] Health check failed:', error.message);
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Make a single prediction
 * 
 * @param {Object} waterQuality - Water quality data
 *   - pH: number
 *   - Turbidity: number
 *   - Dissolved_Oxygen: number
 * @returns {Promise<Object>} Prediction result {risk, confidence}
 */
async function predict(waterQuality) {
  try {
    // Validate required fields
    const required = ['pH', 'Turbidity', 'Dissolved_Oxygen'];
    const missing = required.filter(f => waterQuality[f] === undefined);
    
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        risk: null,
        confidence: 0
      };
    }

    const response = await mlClient.post('/predict', waterQuality);
    
    return {
      success: true,
      risk: response.data.risk,
      confidence: response.data.confidence,
      probabilities: response.data.probabilities,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[ML Client] Prediction error:', error.message);
    return {
      success: false,
      error: error.message,
      risk: null,
      confidence: 0
    };
  }
}

/**
 * Make batch predictions
 * 
 * @param {Array<Object>} dataList - Array of water quality data
 * @returns {Promise<Object>} Batch predictions
 */
async function predictBatch(dataList) {
  try {
    const response = await mlClient.post('/predict-batch', dataList);
    
    return {
      success: true,
      predictions: response.data.predictions,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[ML Client] Batch prediction error:', error.message);
    return {
      success: false,
      error: error.message,
      predictions: []
    };
  }
}

module.exports = {
  checkHealth,
  predict,
  predictBatch
};
