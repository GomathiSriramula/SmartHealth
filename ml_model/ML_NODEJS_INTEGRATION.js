/**
 * ML Module Integration for Node.js Backend
 * 
 * This file shows how to integrate the Python ML module with Node.js Express backend.
 * 
 * Two integration approaches:
 * 1. Subprocess-based (synchronous) - Good for small requests
 * 2. REST API wrapper - Good for scalable deployments
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

/**
 * Approach 1: Direct Subprocess Integration
 * 
 * Pros:
 * - Simple implementation
 * - No additional dependencies
 * - Direct Python execution
 * 
 * Cons:
 * - Synchronous (blocks)
 * - Slow for high volume
 * - Model loaded each time
 */

class MLPythonSubprocess {
    constructor(mlModelDir = './ml_model') {
        this.mlModelDir = mlModelDir;
        this.pythonPath = 'python'; // or full path to Python executable
    }

    /**
     * Make a prediction via Python subprocess
     * @param {Object} input - {pH, turbidity, dissolved_oxygen}
     * @returns {Object} Prediction result
     */
    predict(input) {
        try {
            const inputJson = JSON.stringify(input);
            
            const result = spawnSync(
                this.pythonPath,
                [path.join(this.mlModelDir, 'ml_wrapper.py'), 'predict'],
                {
                    input: inputJson,
                    encoding: 'utf-8',
                    cwd: this.mlModelDir,
                    timeout: 5000 // 5 second timeout
                }
            );

            if (result.error) {
                return {
                    success: false,
                    error: result.error.message,
                    error_code: 'SPAWN_ERROR'
                };
            }

            if (result.status !== 0) {
                return {
                    success: false,
                    error: result.stderr || 'Python process failed',
                    error_code: 'PYTHON_ERROR'
                };
            }

            return JSON.parse(result.stdout);
        } catch (error) {
            return {
                success: false,
                error: error.message,
                error_code: 'EXECUTION_ERROR'
            };
        }
    }

    /**
     * Batch predictions via Python subprocess
     * @param {Array} inputs - Array of input objects
     * @returns {Object} Batch prediction results
     */
    batchPredict(inputs) {
        try {
            const inputJson = JSON.stringify(inputs);
            
            const result = spawnSync(
                this.pythonPath,
                [path.join(this.mlModelDir, 'ml_wrapper.py'), 'batch_predict'],
                {
                    input: inputJson,
                    encoding: 'utf-8',
                    cwd: this.mlModelDir,
                    timeout: 10000 // 10 second timeout
                }
            );

            if (result.error || result.status !== 0) {
                return {
                    success: false,
                    error: result.stderr || 'Batch prediction failed',
                    error_code: 'BATCH_ERROR'
                };
            }

            return JSON.parse(result.stdout);
        } catch (error) {
            return {
                success: false,
                error: error.message,
                error_code: 'BATCH_EXECUTION_ERROR'
            };
        }
    }

    /**
     * Validate input without making prediction
     * @param {Object} input - Input to validate
     * @returns {Object} Validation result
     */
    validate(input) {
        try {
            const inputJson = JSON.stringify(input);
            
            const result = spawnSync(
                this.pythonPath,
                [path.join(this.mlModelDir, 'ml_wrapper.py'), 'validate'],
                {
                    input: inputJson,
                    encoding: 'utf-8',
                    cwd: this.mlModelDir,
                    timeout: 2000
                }
            );

            if (result.status !== 0) {
                return {
                    valid: false,
                    error: result.stderr || 'Validation failed'
                };
            }

            return JSON.parse(result.stdout);
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get model information
     * @returns {Object} Model info
     */
    getInfo() {
        try {
            const result = spawnSync(
                this.pythonPath,
                [path.join(this.mlModelDir, 'ml_wrapper.py'), 'info'],
                {
                    encoding: 'utf-8',
                    cwd: this.mlModelDir,
                    timeout: 2000
                }
            );

            if (result.status !== 0) {
                return { available: false, error: result.stderr };
            }

            return JSON.parse(result.stdout);
        } catch (error) {
            return { available: false, error: error.message };
        }
    }
}

/**
 * Approach 2: Express Route Integration Example
 * 
 * Use this in your Express app.js or routes file
 */

function setupMLRoutes(app, mlModule) {
    /**
     * POST /api/predict
     * Make a single prediction
     */
    app.post('/api/predict', (req, res) => {
        const input = req.body;

        // Validate request
        if (!input || typeof input !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Request body must be a JSON object',
                error_code: 'INVALID_REQUEST'
            });
        }

        // Make prediction
        const result = mlModule.predict(input);

        // Return appropriate status code
        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    });

    /**
     * POST /api/predict-batch
     * Make batch predictions
     */
    app.post('/api/predict-batch', (req, res) => {
        const inputs = req.body;

        // Validate request
        if (!Array.isArray(inputs)) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be a JSON array',
                error_code: 'INVALID_REQUEST'
            });
        }

        if (inputs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request array cannot be empty',
                error_code: 'EMPTY_REQUEST'
            });
        }

        // Make predictions
        const result = mlModule.batchPredict(inputs);

        // Return appropriate status code
        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    });

    /**
     * POST /api/validate
     * Validate input without prediction
     */
    app.post('/api/validate', (req, res) => {
        const input = req.body;

        const result = mlModule.validate(input);

        const statusCode = result.valid ? 200 : 400;
        res.status(statusCode).json(result);
    });

    /**
     * GET /api/model/info
     * Get model information
     */
    app.get('/api/model/info', (req, res) => {
        const info = mlModule.getInfo();

        const statusCode = info.available ? 200 : 503;
        res.status(statusCode).json(info);
    });
}

/**
 * Usage Example
 * 
 * In your main app.js:
 */

/*
const express = require('express');
const MLPythonSubprocess = require('./ml_integration');

const app = express();
app.use(express.json());

// Initialize ML module
const ml = new MLPythonSubprocess('./ml_model');

// Setup routes
setupMLRoutes(app, ml);

// Start server
app.listen(5000, () => {
    console.log('Server running on port 5000');
    console.log('API endpoints:');
    console.log('  POST /api/predict - Single prediction');
    console.log('  POST /api/predict-batch - Batch predictions');
    console.log('  POST /api/validate - Validate input');
    console.log('  GET /api/model/info - Model information');
});
*/

/**
 * Example API Usage (from Frontend/Client)
 */

// Single prediction
/*
fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        pH: 7.0,
        turbidity: 5.0,
        dissolved_oxygen: 6.0
    })
})
.then(res => res.json())
.then(result => {
    if (result.success) {
        console.log(`Risk Level: ${result.risk_label}`);
        console.log(`Confidence: ${result.confidence}%`);
    } else {
        console.error(`Error: ${result.error}`);
    }
});
*/

// Batch predictions
/*
fetch('/api/predict-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
        { pH: 7.0, turbidity: 5.0, dissolved_oxygen: 6.0 },
        { pH: 6.5, turbidity: 8.0, dissolved_oxygen: 5.0 },
        { pH: 7.5, turbidity: 2.0, dissolved_oxygen: 8.0 }
    ])
})
.then(res => res.json())
.then(result => {
    if (result.success) {
        result.predictions.forEach(pred => {
            console.log(`${pred.sensor_id}: ${pred.risk_label}`);
        });
    }
});
*/

// Export for use in other files
module.exports = {
    MLPythonSubprocess,
    setupMLRoutes
};

/**
 * Advanced Usage: Background Queue for Large Batches
 * 
 * For large batch predictions, consider using a queue:
 */

/*
const Bull = require('bull');
const predictQueue = new Bull('predictions');

// Process predictions in background
predictQueue.process(async (job) => {
    const { inputs } = job.data;
    const ml = new MLPythonSubprocess('./ml_model');
    return ml.batchPredict(inputs);
});

// Add to queue
app.post('/api/predict-batch-async', (req, res) => {
    const job = predictQueue.add({ inputs: req.body });
    res.json({ jobId: job.id, status: 'queued' });
});

// Check job status
app.get('/api/predict-batch-status/:jobId', async (req, res) => {
    const job = await Bull.Job.getJob(predictQueue, req.params.jobId);
    const state = await job.getState();
    res.json({ jobId: req.params.jobId, state, progress: job.progress() });
});
*/
