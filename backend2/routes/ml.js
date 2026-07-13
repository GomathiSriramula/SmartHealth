/**
 * ML Predictions Route
 * 
 * This route handles outbreak risk predictions using the Python ML module.
 * 
 * Endpoints:
 * - POST /api/ml/predict - Single water quality prediction
 * - POST /api/ml/batch - Batch predictions for multiple samples
 * - GET /api/ml/info - Get model information
 * - POST /api/ml/validate - Validate input without prediction
 */

const express = require('express');
const { spawnSync } = require('child_process');
const path = require('path');
const router = express.Router();

// ML Module configuration
const ML_MODEL_DIR = path.join(__dirname, '..', 'ml_model');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || 'python';

/**
 * Helper function: Call Python ML module via subprocess
 */
function callMLModule(command, input) {
    try {
        const result = spawnSync(
            PYTHON_EXECUTABLE,
            [path.join(ML_MODEL_DIR, 'ml_wrapper.py'), command],
            {
                input: JSON.stringify(input),
                encoding: 'utf-8',
                cwd: ML_MODEL_DIR,
                timeout: command === 'batch_predict' ? 10000 : 5000,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            }
        );

        if (result.error) {
            console.error(`[ML Module] Spawn error for ${command}:`, result.error);
            return {
                success: false,
                error: result.error.message,
                error_code: 'SPAWN_ERROR',
                command
            };
        }

        if (result.status !== 0) {
            console.error(`[ML Module] Python error for ${command}:`, result.stderr);
            return {
                success: false,
                error: result.stderr || `Python process exited with status ${result.status}`,
                error_code: 'PYTHON_ERROR',
                command
            };
        }

        return JSON.parse(result.stdout);
    } catch (error) {
        console.error(`[ML Module] Exception in ${command}:`, error);
        return {
            success: false,
            error: error.message,
            error_code: 'EXECUTION_ERROR',
            command
        };
    }
}

/**
 * POST /api/ml/predict
 * 
 * Make a single prediction for water quality
 * 
 * Request body:
 * {
 *   "pH": 7.0,
 *   "turbidity": 5.0,
 *   "dissolved_oxygen": 6.0
 * }
 * 
 * Response on success:
 * {
 *   "success": true,
 *   "risk_label": "Low" | "Medium" | "High",
 *   "confidence": 95,
 *   "probabilities": {
 *     "Low": 0.92,
 *     "Medium": 0.06,
 *     "High": 0.02
 *   }
 * }
 * 
 * Response on error:
 * {
 *   "success": false,
 *   "error": "Error message",
 *   "error_code": "ERROR_TYPE",
 *   "details": "Additional information"
 * }
 */
router.post('/api/ml/predict', (req, res) => {
    try {
        const { pH, turbidity, dissolved_oxygen } = req.body;

        // Validate required fields
        const requiredFields = { pH, turbidity, dissolved_oxygen };
        const missingFields = [];
        
        for (const [field, value] of Object.entries(requiredFields)) {
            if (value === undefined || value === null) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                error_code: 'MISSING_FIELDS',
                details: {
                    required: ['pH', 'turbidity', 'dissolved_oxygen'],
                    received: Object.keys(req.body)
                }
            });
        }

        // Call ML module
        const prediction = callMLModule('predict', {
            pH,
            turbidity,
            dissolved_oxygen
        });

        const statusCode = prediction.success ? 200 : 400;
        res.status(statusCode).json(prediction);
    } catch (error) {
        console.error('[ML Predict] Unhandled error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            error_code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/ml/batch
 * 
 * Make batch predictions for multiple samples
 * 
 * Request body: Array of water quality readings
 * [
 *   {
 *     "pH": 7.0,
 *     "turbidity": 5.0,
 *     "dissolved_oxygen": 6.0
 *   },
 *   ...
 * ]
 * 
 * Response on success:
 * {
 *   "success": true,
 *   "count": 3,
 *   "successful": 3,
 *   "failed": 0,
 *   "predictions": [
 *     {
 *       "risk_label": "Low",
 *       "confidence": 95,
 *       "probabilities": {...},
 *       "success": true
 *     },
 *     ...
 *   ]
 * }
 */
router.post('/api/ml/batch', (req, res) => {
    try {
        const inputs = req.body;

        // Validate request format
        if (!Array.isArray(inputs)) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be an array',
                error_code: 'INVALID_REQUEST'
            });
        }

        if (inputs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Array cannot be empty',
                error_code: 'EMPTY_REQUEST'
            });
        }

        if (inputs.length > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 1000 predictions per request',
                error_code: 'REQUEST_TOO_LARGE'
            });
        }

        // Call ML module
        const result = callMLModule('batch_predict', inputs);

        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('[ML Batch] Unhandled error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            error_code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/ml/validate
 * 
 * Validate water quality data without making a prediction
 * 
 * Request body: Same as /predict
 * {
 *   "pH": 7.0,
 *   "turbidity": 5.0,
 *   "dissolved_oxygen": 6.0
 * }
 * 
 * Response:
 * {
 *   "valid": true,
 *   "fields": {
 *     "pH": { "valid": true, "value": 7.0 },
 *     "turbidity": { "valid": true, "value": 5.0 },
 *     "dissolved_oxygen": { "valid": true, "value": 6.0 }
 *   }
 * }
 * 
 * Or if invalid:
 * {
 *   "valid": false,
 *   "error": "pH must be between 0 and 14",
 *   "details": {...}
 * }
 */
router.post('/api/ml/validate', (req, res) => {
    try {
        const input = req.body;

        if (!input || typeof input !== 'object') {
            return res.status(400).json({
                valid: false,
                error: 'Request body must be a JSON object'
            });
        }

        // Call ML module validation
        const result = callMLModule('validate', input);

        const statusCode = result.valid ? 200 : 400;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('[ML Validate] Unhandled error:', error);
        res.status(500).json({
            valid: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/ml/info
 * 
 * Get model information
 * 
 * Response:
 * {
 *   "available": true,
 *   "model_name": "RandomForestClassifier",
 *   "version": "1.0.0",
 *   "trained_on": "2024-01-15",
 *   "required_fields": ["pH", "turbidity", "dissolved_oxygen"],
 *   "field_constraints": {
 *     "pH": {"min": 0, "max": 14},
 *     "turbidity": {"min": 0, "max": 100},
 *     "dissolved_oxygen": {"min": 0, "max": 15}
 *   },
 *   "risk_labels": ["Low", "Medium", "High"],
 *   "feature_importance": {...}
 * }
 */
router.get('/api/ml/info', (req, res) => {
    try {
        const info = callMLModule('info', {});

        if (info.available === false) {
            return res.status(503).json(info);
        }

        res.status(200).json(info);
    } catch (error) {
        console.error('[ML Info] Unhandled error:', error);
        res.status(500).json({
            available: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Health check endpoint for ML module
 * GET /api/ml/health
 */
router.get('/api/ml/health', (req, res) => {
    try {
        const info = callMLModule('info', {});

        if (info.available === false) {
            return res.status(503).json({
                status: 'unhealthy',
                error: info.error
            });
        }

        res.status(200).json({
            status: 'healthy',
            model_available: true
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: 'Failed to check ML module'
        });
    }
});

module.exports = router;
