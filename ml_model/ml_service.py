#!/usr/bin/env python3
"""
Flask-based ML prediction service for water-borne disease outbreak risk.

Provides REST API endpoints:
- POST /predict - Single prediction
- POST /predict-batch - Batch predictions
- GET /health - Health check
- GET /info - Model information
"""

import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys

# Add project directory to path
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_DIR)

from ml_pipeline import MLPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize ML pipeline
pipeline = MLPipeline()
model_loaded = False

# Load model on startup
def load_model_on_startup():
    global model_loaded
    try:
        if pipeline.load_model():
            model_loaded = True
            logger.info("✓ ML model loaded successfully")
            return True
    except Exception as e:
        logger.error(f"✗ Failed to load ML model: {e}")
        model_loaded = False
        return False


@app.before_request
def before_request():
    """Ensure model is loaded before processing requests."""
    global model_loaded
    if not model_loaded:
        load_model_on_startup()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy' if model_loaded else 'unhealthy',
        'model_loaded': model_loaded,
        'timestamp': __import__('datetime').datetime.now().isoformat()
    }), 200 if model_loaded else 503


@app.route('/info', methods=['GET'])
def info():
    """Get model information."""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 503

    return jsonify({
        'status': 'ready',
        'model_type': 'RandomForestClassifier',
        'features': pipeline.feature_names,
        'metrics': pipeline.metrics,
        'feature_importance': pipeline.get_feature_importance(),
        'risk_levels': ['LOW', 'MEDIUM', 'HIGH']
    }), 200


@app.route('/predict', methods=['POST'])
def predict():
    """
    Single prediction endpoint.

    Expected JSON:
    {
        "pH": 7.0,
        "Turbidity": 5.0,
        "Dissolved_Oxygen": 6.0,
        "contamination_flag": 0,
        "case_density": 0,
        "seasonality": 0
    }
    """
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 503

    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        # Validate required fields
        required = ['pH', 'Turbidity', 'Dissolved_Oxygen']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'error': f'Missing required fields: {missing}',
                'required': required
            }), 400

        # Make prediction
        result = pipeline.predict(data)
        
        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """
    Batch prediction endpoint.

    Expected JSON: Array of prediction objects
    [
        {"pH": 7.0, "Turbidity": 5.0, "Dissolved_Oxygen": 6.0},
        {"pH": 6.5, "Turbidity": 8.0, "Dissolved_Oxygen": 5.0},
        ...
    ]
    """
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 503

    try:
        data_list = request.get_json()
        
        if not isinstance(data_list, list):
            return jsonify({'error': 'Expected JSON array'}), 400

        if len(data_list) == 0:
            return jsonify({'error': 'Empty data list'}), 400

        if len(data_list) > 1000:
            return jsonify({'error': 'Maximum 1000 predictions per request'}), 400

        # Validate all items have required fields
        required = ['pH', 'Turbidity', 'Dissolved_Oxygen']
        for idx, item in enumerate(data_list):
            missing = [f for f in required if f not in item]
            if missing:
                return jsonify({
                    'error': f'Item {idx} missing fields: {missing}'
                }), 400

        # Make batch predictions
        results = pipeline.predict_batch(data_list)

        return jsonify({
            'status': 'success',
            'count': len(results),
            'predictions': results
        }), 200

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/feature-importance', methods=['GET'])
def feature_importance():
    """Get feature importance for model explainability."""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 503

    importance = pipeline.get_feature_importance()
    return jsonify({
        'feature_importance': importance,
        'interpretation': {
            'pH': 'Water acidity/alkalinity level',
            'Turbidity': 'Water cloudiness - high values indicate contamination',
            'Dissolved_Oxygen': 'Oxygen content in water',
            'contamination_flag': 'Binary indicator of likely contamination',
            'case_density': 'Population case load density',
            'seasonality': 'Seasonal risk factor (rainy season)'
        }
    }), 200


@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': 'Internal server error'}), 500


def main():
    """Run the Flask app."""
    logger.info("=" * 60)
    logger.info("SmartHealth ML Service (Flask)")
    logger.info("=" * 60)

    # Load model on startup
    if not load_model_on_startup():
        logger.warning("Starting without pre-loaded model")

    # Run app
    port = int(os.getenv('ML_SERVICE_PORT', 5001))
    host = os.getenv('ML_SERVICE_HOST', '127.0.0.1')
    
    logger.info(f"Starting ML service on {host}:{port}")
    logger.info(f"Endpoints available:")
    logger.info(f"  GET  /health - Health check")
    logger.info(f"  GET  /info - Model information")
    logger.info(f"  GET  /feature-importance - Feature importance")
    logger.info(f"  POST /predict - Single prediction")
    logger.info(f"  POST /predict-batch - Batch predictions")
    logger.info("=" * 60)

    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    main()
