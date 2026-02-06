/**
 * ML Service Client
 * 
 * Handles communication with the Flask ML prediction service
 * Provides methods to:
 * - Get model health status
 * - Get model info and feature importance
 * - Make single predictions
 * - Make batch predictions
 * - Handle service failures gracefully
 */

const axios = require('axios');

// Configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '10000', 10);

// Create axios instance for ML service with timeout
const mlServiceClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: ML_SERVICE_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Check ML service health
 * @returns {Promise<Object>} Health status {status, model_loaded, timestamp}
 */
async function checkHealth() {
  try {
    const response = await mlServiceClient.get('/health');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[ML Client] Health check failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: {
        status: 'unavailable',
        model_loaded: false,
      },
    };
  }
}

/**
 * Get model information and feature importance
 * @returns {Promise<Object>} Model info {model_type, features, metrics, feature_importance, risk_levels}
 */
async function getModelInfo() {
  try {
    const response = await mlServiceClient.get('/info');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[ML Client] Model info request failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Get feature importance from model
 * @returns {Promise<Object>} Feature importance rankings
 */
async function getFeatureImportance() {
  try {
    const response = await mlServiceClient.get('/feature-importance');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[ML Client] Feature importance request failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Make a single water quality prediction
 * @param {Object} waterQualityData - Water quality measurements
 *   - pH: number (0-14)
 *   - Turbidity: number (0-40, NTU)
 *   - Dissolved_Oxygen: number (0-20, mg/L)
 * @returns {Promise<Object>} Prediction result {risk, confidence, probabilities}
 */
async function predictWaterQuality(waterQualityData) {
  try {
    // Validate required fields
    if (!waterQualityData.pH && waterQualityData.pH !== 0) {
      throw new Error('pH is required');
    }
    if (!waterQualityData.Turbidity && waterQualityData.Turbidity !== 0) {
      throw new Error('Turbidity is required');
    }
    if (!waterQualityData.Dissolved_Oxygen && waterQualityData.Dissolved_Oxygen !== 0) {
      throw new Error('Dissolved_Oxygen is required');
    }

    const response = await mlServiceClient.post('/predict', waterQualityData);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[ML Client] Prediction failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Make batch predictions for multiple water quality samples
 * @param {Array<Object>} waterQualityDataArray - Array of water quality measurements
 * @param {Object} options - Optional settings
 *   - maxBatchSize: number (default: 1000)
 * @returns {Promise<Object>} Batch prediction results
 */
async function predictWaterQualityBatch(waterQualityDataArray, options = {}) {
  try {
    const { maxBatchSize = 1000 } = options;

    if (!Array.isArray(waterQualityDataArray)) {
      throw new Error('Input must be an array');
    }

    if (waterQualityDataArray.length === 0) {
      throw new Error('Array cannot be empty');
    }

    if (waterQualityDataArray.length > maxBatchSize) {
      throw new Error(`Batch size cannot exceed ${maxBatchSize}`);
    }

    // Validate each item
    waterQualityDataArray.forEach((item, index) => {
      if (item.pH === undefined) throw new Error(`Item ${index}: pH is required`);
      if (item.Turbidity === undefined) throw new Error(`Item ${index}: Turbidity is required`);
      if (item.Dissolved_Oxygen === undefined) throw new Error(`Item ${index}: Dissolved_Oxygen is required`);
    });

    const response = await mlServiceClient.post('/predict-batch', {
      data: waterQualityDataArray,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[ML Client] Batch prediction failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Auto-generate recommendations based on risk level and water quality data
 * @param {string} riskLevel - Risk level (LOW, MEDIUM, HIGH)
 * @param {Object} waterQualityData - Water quality data
 * @returns {Array<string>} Recommendations
 */
function generateRecommendations(riskLevel, waterQualityData) {
  const recommendations = [];

  if (!riskLevel || !waterQualityData) {
    return ['Monitor water quality regularly', 'Conduct regular testing'];
  }

  // Generic recommendations
  if (riskLevel === 'HIGH' || riskLevel === 'high') {
    recommendations.push('⚠️ URGENT: Issue boil water advisory immediately');
    recommendations.push('Notify health department and residents');
    recommendations.push('Increase water quality testing frequency');
    recommendations.push('Implement emergency treatment measures');
  } else if (riskLevel === 'MEDIUM' || riskLevel === 'medium') {
    recommendations.push('Enhance water quality monitoring');
    recommendations.push('Increase treatment plant operation intensity');
    recommendations.push('Prepare contingency plans');
  } else {
    recommendations.push('Continue regular monitoring');
    recommendations.push('Maintain current treatment levels');
  }

  // Water quality-specific recommendations
  if (waterQualityData.Turbidity && waterQualityData.Turbidity > 10) {
    recommendations.push('Turbidity elevated: Increase filtration');
  }

  if (waterQualityData.Dissolved_Oxygen && waterQualityData.Dissolved_Oxygen < 5) {
    recommendations.push('Low oxygen levels: Check for anaerobic conditions');
  }

  if (waterQualityData.pH && (waterQualityData.pH < 6.5 || waterQualityData.pH > 8.5)) {
    recommendations.push('pH out of range: Adjust chemical treatment');
  }

  return [...new Set(recommendations)]; // Remove duplicates
}

/**
 * Map ML model risk levels to application risk levels
 * Ensures consistent formatting across the system
 * @param {string} mlRiskLevel - Risk from ML model (LOW, MEDIUM, HIGH)
 * @returns {string} Normalized risk level
 */
function normalizeRiskLevel(mlRiskLevel) {
  if (!mlRiskLevel) return 'unknown';
  
  const normalized = mlRiskLevel.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized;
  }
  
  return 'unknown';
}

/**
 * Format prediction result for database storage
 * @param {Object} predictionData - Raw prediction from ML service
 * @param {Object} waterQualityData - Original water quality input
 * @returns {Object} Formatted prediction for storage
 */
function formatPredictionForStorage(predictionData, waterQualityData) {
  if (!predictionData || !predictionData.risk) {
    return null;
  }

  const riskLevel = normalizeRiskLevel(predictionData.risk);
  const recommendations = generateRecommendations(
    predictionData.risk,
    waterQualityData
  );

  return {
    predictionType: 'Water Quality',
    riskLevel,
    details: `pH: ${waterQualityData.pH.toFixed(2)}, Turbidity: ${waterQualityData.Turbidity.toFixed(2)}, Dissolved Oxygen: ${waterQualityData.Dissolved_Oxygen.toFixed(2)}`,
    recommendations,
    modelVersion: 'ml-pipeline-v1.0',
    confidence: predictionData.confidence ? Math.round(predictionData.confidence * 100) : 75,
    rawPrediction: {
      risk: predictionData.risk,
      confidence: predictionData.confidence,
      probabilities: predictionData.probabilities,
    },
  };
}

module.exports = {
  // Direct ML service calls
  checkHealth,
  getModelInfo,
  getFeatureImportance,
  predictWaterQuality,
  predictWaterQualityBatch,

  // Helper functions
  generateRecommendations,
  normalizeRiskLevel,
  formatPredictionForStorage,
};
