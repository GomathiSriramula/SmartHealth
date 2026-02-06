"""
Quick validation script to check model predictions are correct.

This is a lighter-weight alternative to the full test suite for quick checks.
"""

import logging
from model import DiseaseOutbreakModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def validate_model():
    """Quick validation of model predictions."""
    logger.info("\n" + "="*80)
    logger.info("🔍 QUICK MODEL VALIDATION")
    logger.info("="*80 + "\n")
    
    try:
        # Initialize and load model
        logger.info("Loading model...")
        model = DiseaseOutbreakModel()
        model.load_model()
        
        # Test 1: Single prediction with valid inputs
        logger.info("\n" + "-"*80)
        logger.info("TEST 1: Single Prediction with Valid Inputs")
        logger.info("-"*80)
        result = model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        
        # Validate risk label
        assert result['risk_label'] in {'Low', 'Medium', 'High'}, \
            f"❌ Invalid risk label: {result['risk_label']}"
        logger.info(f"✓ Risk label valid: {result['risk_label']}")
        
        # Validate confidence
        assert 0 <= result['confidence'] <= 100, \
            f"❌ Confidence out of range: {result['confidence']}"
        logger.info(f"✓ Confidence in range: {result['confidence']:.2f}%")
        
        # Validate probabilities
        total_prob = sum(result['probabilities'].values())
        assert 99.9 <= total_prob <= 100.1, \
            f"❌ Probabilities don't sum to 100: {total_prob}"
        logger.info(f"✓ Probabilities sum to 100: {total_prob:.1f}%")
        
        logger.info(f"✓ TEST 1 PASSED\n")
        
        # Test 2: Batch prediction
        logger.info("-"*80)
        logger.info("TEST 2: Batch Prediction")
        logger.info("-"*80)
        sensor_readings = [
            {'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0, 'sensor_id': 'sensor-001'},
            {'pH': 6.5, 'turbidity': 8.0, 'dissolved_oxygen': 5.0, 'sensor_id': 'sensor-002'},
            {'pH': 7.5, 'turbidity': 2.0, 'dissolved_oxygen': 8.0, 'sensor_id': 'sensor-003'},
        ]
        
        results = model.predict_batch(sensor_readings)
        
        assert len(results) == 3, f"❌ Expected 3 results, got {len(results)}"
        logger.info(f"✓ Batch returned {len(results)} predictions")
        
        for i, result in enumerate(results):
            assert result['risk_label'] in {'Low', 'Medium', 'High'}, \
                f"❌ Result {i}: Invalid risk label"
            assert 0 <= result['confidence'] <= 100, \
                f"❌ Result {i}: Confidence out of range"
            logger.info(f"  ✓ Result {i+1}: {result['sensor_id']} → {result['risk_label']} ({result['confidence']:.1f}%)")
        
        logger.info(f"✓ TEST 2 PASSED\n")
        
        # Test 3: Consistency
        logger.info("-"*80)
        logger.info("TEST 3: Prediction Consistency")
        logger.info("-"*80)
        result1 = model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        result2 = model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        
        assert result1['risk_label'] == result2['risk_label'], \
            f"❌ Predictions not consistent"
        assert result1['confidence'] == result2['confidence'], \
            f"❌ Confidence not consistent"
        logger.info(f"✓ Same input produces same output")
        logger.info(f"✓ TEST 3 PASSED\n")
        
        # Test 4: Feature importance
        logger.info("-"*80)
        logger.info("TEST 4: Feature Importance")
        logger.info("-"*80)
        importances = model.get_feature_importance()
        
        assert len(importances) > 0, "❌ No features found"
        logger.info(f"✓ Extracted {len(importances)} features")
        
        # Check sorting
        imp_values = [imp for _, imp in importances]
        assert imp_values == sorted(imp_values, reverse=True), \
            "❌ Features not sorted by importance"
        logger.info(f"✓ Features sorted by importance")
        
        for rank, (feature, importance) in enumerate(importances[:3], 1):
            logger.info(f"  {rank}. {feature}: {importance:.6f}")
        
        logger.info(f"✓ TEST 4 PASSED\n")
        
        # Summary
        logger.info("="*80)
        logger.info("✅ ALL VALIDATION TESTS PASSED!")
        logger.info("="*80)
        logger.info("\nModel Status:")
        logger.info(f"  • Predictions: ✓ Valid")
        logger.info(f"  • Risk Labels: ✓ Valid (Low/Medium/High)")
        logger.info(f"  • Confidence: ✓ Valid (0-100%)")
        logger.info(f"  • Probabilities: ✓ Valid (sum to 100%)")
        logger.info(f"  • Consistency: ✓ Deterministic")
        logger.info(f"  • Feature Importance: ✓ Available\n")
        
        return True
        
    except FileNotFoundError:
        logger.error("❌ Model file not found!")
        logger.error("   Please train a model first: python train.py <csv_file>")
        return False
    except AssertionError as e:
        logger.error(f"❌ VALIDATION FAILED: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"❌ UNEXPECTED ERROR: {str(e)}")
        raise


if __name__ == "__main__":
    import sys
    success = validate_model()
    sys.exit(0 if success else 1)
