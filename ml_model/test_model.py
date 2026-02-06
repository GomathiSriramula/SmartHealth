"""
Comprehensive test suite for the Disease Outbreak Prediction Model.

Tests verify:
1. Model loads correctly from disk
2. predict() returns valid risk labels (Low, Medium, High)
3. Confidence scores are within valid range (0-100)
4. Batch predictions work correctly
5. Edge cases and error handling
"""

import unittest
import logging
import sys
import os
from model import DiseaseOutbreakModel

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TestModelLoading(unittest.TestCase):
    """Test suite for model loading functionality."""
    
    def setUp(self):
        """Initialize model for each test."""
        self.model = DiseaseOutbreakModel()
    
    def test_model_initialization(self):
        """Test that model initializes correctly."""
        self.assertIsNone(self.model.model)
        self.assertIsNone(self.model.scaler)
        self.assertIsInstance(self.model.feature_names, list)
        self.assertEqual(len(self.model.feature_names), 3)
        logger.info("✓ Model initialization test PASSED")
    
    def test_model_loads_from_disk(self):
        """Test that model can be loaded from disk."""
        try:
            self.model.load_model()
            self.assertIsNotNone(self.model.model)
            self.assertIsNotNone(self.model.scaler)
            logger.info("✓ Model loading test PASSED")
        except FileNotFoundError:
            logger.warning("⚠️  Model file not found - skipping load test")
            self.skipTest("Trained model not available")
    
    def test_model_has_required_attributes(self):
        """Test that loaded model has required attributes."""
        try:
            self.model.load_model()
            self.assertTrue(hasattr(self.model.model, 'predict'))
            self.assertTrue(hasattr(self.model.model, 'predict_proba'))
            self.assertTrue(hasattr(self.model.model, 'n_estimators'))
            logger.info("✓ Model attributes test PASSED")
        except FileNotFoundError:
            self.skipTest("Trained model not available")
    
    def test_scaler_is_standard_scaler(self):
        """Test that scaler is a StandardScaler instance."""
        try:
            self.model.load_model()
            from sklearn.preprocessing import StandardScaler
            self.assertIsInstance(self.model.scaler, StandardScaler)
            logger.info("✓ Scaler type test PASSED")
        except FileNotFoundError:
            self.skipTest("Trained model not available")


class TestPredictions(unittest.TestCase):
    """Test suite for prediction functionality."""
    
    @classmethod
    def setUpClass(cls):
        """Load model once for all prediction tests."""
        cls.model = DiseaseOutbreakModel()
        try:
            cls.model.load_model()
            cls.model_available = True
        except FileNotFoundError:
            cls.model_available = False
            logger.warning("⚠️  Model file not found - prediction tests will be skipped")
    
    def setUp(self):
        """Check if model is available before each test."""
        if not self.model_available:
            self.skipTest("Trained model not available")
    
    def test_predict_returns_dict(self):
        """Test that predict() returns a dictionary."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        self.assertIsInstance(result, dict)
        logger.info("✓ Prediction returns dict test PASSED")
    
    def test_predict_has_required_keys(self):
        """Test that prediction result has required keys."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        required_keys = {'risk_label', 'confidence', 'probabilities', 'timestamp'}
        self.assertTrue(required_keys.issubset(result.keys()))
        logger.info("✓ Prediction keys test PASSED")
    
    def test_risk_label_is_valid(self):
        """Test that risk_label is one of the valid categories."""
        valid_labels = {'Low', 'Medium', 'High'}
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        self.assertIn(result['risk_label'], valid_labels)
        logger.info(f"✓ Risk label validation test PASSED (label={result['risk_label']})")
    
    def test_confidence_in_valid_range(self):
        """Test that confidence score is between 0 and 100."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        confidence = result['confidence']
        self.assertIsInstance(confidence, (int, float))
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 100)
        logger.info(f"✓ Confidence range test PASSED (confidence={confidence:.2f}%)")
    
    def test_probabilities_dict_format(self):
        """Test that probabilities dict has correct format."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        probs = result['probabilities']
        
        # Check it's a dict
        self.assertIsInstance(probs, dict)
        
        # Check all keys are valid labels
        for key in probs.keys():
            self.assertIn(key, {'Low', 'Medium', 'High'})
        
        # Check all values are floats between 0 and 100
        for value in probs.values():
            self.assertIsInstance(value, (int, float))
            self.assertGreaterEqual(value, 0)
            self.assertLessEqual(value, 100)
        
        logger.info(f"✓ Probabilities format test PASSED")
    
    def test_probabilities_sum_to_100(self):
        """Test that probabilities sum to approximately 100."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        total = sum(result['probabilities'].values())
        # Allow small floating point error
        self.assertAlmostEqual(total, 100.0, places=1)
        logger.info(f"✓ Probabilities sum test PASSED (sum={total:.1f}%)")
    
    def test_timestamp_is_valid(self):
        """Test that timestamp is in valid ISO format."""
        result = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        timestamp = result['timestamp']
        self.assertIsInstance(timestamp, str)
        # Try parsing as ISO format
        from datetime import datetime
        try:
            datetime.fromisoformat(timestamp)
            self.assertTrue(True)
        except ValueError:
            self.fail(f"Timestamp {timestamp} is not valid ISO format")
        logger.info(f"✓ Timestamp format test PASSED")


class TestMultiplePredictions(unittest.TestCase):
    """Test suite for edge cases and multiple predictions."""
    
    @classmethod
    def setUpClass(cls):
        """Load model once for all tests."""
        cls.model = DiseaseOutbreakModel()
        try:
            cls.model.load_model()
            cls.model_available = True
        except FileNotFoundError:
            cls.model_available = False
    
    def setUp(self):
        """Check if model is available."""
        if not self.model_available:
            self.skipTest("Trained model not available")
    
    def test_consistent_predictions(self):
        """Test that same input produces same output."""
        result1 = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        result2 = self.model.predict(pH=7.0, turbidity=5.0, dissolved_oxygen=6.0)
        
        self.assertEqual(result1['risk_label'], result2['risk_label'])
        self.assertEqual(result1['confidence'], result2['confidence'])
        logger.info("✓ Prediction consistency test PASSED")
    
    def test_different_inputs_produce_predictions(self):
        """Test predictions with various input values."""
        test_cases = [
            {'pH': 6.5, 'turbidity': 8.0, 'dissolved_oxygen': 5.0},
            {'pH': 7.5, 'turbidity': 2.0, 'dissolved_oxygen': 8.0},
            {'pH': 5.0, 'turbidity': 15.0, 'dissolved_oxygen': 2.0},
            {'pH': 8.5, 'turbidity': 1.0, 'dissolved_oxygen': 10.0},
        ]
        
        for i, test_case in enumerate(test_cases):
            result = self.model.predict(**test_case)
            self.assertIn(result['risk_label'], {'Low', 'Medium', 'High'})
            self.assertGreaterEqual(result['confidence'], 0)
            self.assertLessEqual(result['confidence'], 100)
            logger.info(f"✓ Test case {i+1}/4 PASSED: {test_case} → {result['risk_label']}")
    
    def test_batch_prediction(self):
        """Test batch prediction with multiple readings."""
        sensor_readings = [
            {'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0, 'sensor_id': 'sensor-001'},
            {'pH': 6.5, 'turbidity': 8.0, 'dissolved_oxygen': 5.0, 'sensor_id': 'sensor-002'},
            {'pH': 7.5, 'turbidity': 2.0, 'dissolved_oxygen': 8.0, 'sensor_id': 'sensor-003'},
        ]
        
        results = self.model.predict_batch(sensor_readings)
        
        # Check results is a list
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 3)
        
        # Check each result
        for i, result in enumerate(results):
            self.assertIn('risk_label', result)
            self.assertIn('confidence', result)
            self.assertIn('probabilities', result)
            self.assertIn(result['risk_label'], {'Low', 'Medium', 'High'})
            self.assertGreaterEqual(result['confidence'], 0)
            self.assertLessEqual(result['confidence'], 100)
        
        logger.info(f"✓ Batch prediction test PASSED ({len(results)} readings processed)")
    
    def test_extreme_values(self):
        """Test predictions with extreme but valid values."""
        extreme_cases = [
            {'pH': 3.0, 'turbidity': 50.0, 'dissolved_oxygen': 0.5},  # Highly contaminated
            {'pH': 9.0, 'turbidity': 0.1, 'dissolved_oxygen': 12.0},  # Clean water
        ]
        
        for test_case in extreme_cases:
            result = self.model.predict(**test_case)
            self.assertIn(result['risk_label'], {'Low', 'Medium', 'High'})
            self.assertGreaterEqual(result['confidence'], 0)
            self.assertLessEqual(result['confidence'], 100)
            logger.info(f"✓ Extreme case PASSED: {test_case} → {result['risk_label']} ({result['confidence']}%)")


class TestFeatureImportance(unittest.TestCase):
    """Test suite for feature importance functionality."""
    
    @classmethod
    def setUpClass(cls):
        """Load model once."""
        cls.model = DiseaseOutbreakModel()
        try:
            cls.model.load_model()
            cls.model_available = True
        except FileNotFoundError:
            cls.model_available = False
    
    def setUp(self):
        """Check if model is available."""
        if not self.model_available:
            self.skipTest("Trained model not available")
    
    def test_get_feature_importance(self):
        """Test that feature importance can be extracted."""
        importances = self.model.get_feature_importance()
        
        # Should return a list of tuples
        self.assertIsInstance(importances, list)
        self.assertGreater(len(importances), 0)
        
        # Each tuple should have (feature_name, importance_score)
        for feat, importance in importances:
            self.assertIsInstance(feat, str)
            self.assertIsInstance(importance, (int, float))
            self.assertGreaterEqual(importance, 0)
        
        logger.info(f"✓ Feature importance extraction test PASSED ({len(importances)} features)")
    
    def test_features_sorted_by_importance(self):
        """Test that features are sorted in descending order."""
        importances = self.model.get_feature_importance()
        
        # Check they're sorted
        importance_values = [imp for _, imp in importances]
        self.assertEqual(importance_values, sorted(importance_values, reverse=True))
        
        logger.info("✓ Feature importance sorting test PASSED")


def run_all_tests():
    """Run all test suites."""
    logger.info("\n" + "="*80)
    logger.info("🧪 RUNNING COMPREHENSIVE MODEL TEST SUITE")
    logger.info("="*80 + "\n")
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestModelLoading))
    suite.addTests(loader.loadTestsFromTestCase(TestPredictions))
    suite.addTests(loader.loadTestsFromTestCase(TestMultiplePredictions))
    suite.addTests(loader.loadTestsFromTestCase(TestFeatureImportance))
    
    # Run tests with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    logger.info("\n" + "="*80)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*80)
    logger.info(f"Tests run: {result.testsRun}")
    logger.info(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    logger.info(f"Failures: {len(result.failures)}")
    logger.info(f"Errors: {len(result.errors)}")
    logger.info(f"Skipped: {len(result.skipped)}")
    
    if result.wasSuccessful():
        logger.info("\n✅ ALL TESTS PASSED!")
    else:
        logger.warning("\n⚠️  SOME TESTS FAILED - Review output above")
    
    logger.info("="*80 + "\n")
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
