# ML Model Test Suite

Comprehensive automated tests for the Disease Outbreak Prediction Model.

## Overview

The test suite validates:

### 1. **Model Loading Tests** (`TestModelLoading`)
- ✓ Model initializes correctly with default values
- ✓ Model loads from disk successfully
- ✓ Model has all required attributes (predict, predict_proba, n_estimators)
- ✓ Scaler is a valid StandardScaler instance

### 2. **Prediction Tests** (`TestPredictions`)
- ✓ `predict()` returns a dictionary
- ✓ Result has all required keys (risk_label, confidence, probabilities, timestamp)
- ✓ **Risk label is valid** - only returns 'Low', 'Medium', or 'High'
- ✓ **Confidence score in range** - between 0 and 100
- ✓ Probabilities dict has correct format
- ✓ **Probabilities sum to ~100%**
- ✓ Timestamp is in valid ISO format

### 3. **Multiple Predictions & Edge Cases** (`TestMultiplePredictions`)
- ✓ Same input produces same output (deterministic predictions)
- ✓ Different inputs produce valid predictions
- ✓ Batch prediction works for multiple sensor readings
- ✓ Extreme values (highly contaminated/clean water) are handled correctly

### 4. **Feature Importance Tests** (`TestFeatureImportance`)
- ✓ Feature importances can be extracted
- ✓ Features are sorted by importance in descending order

## Running Tests

### Run all tests:
```bash
python test_model.py
```

### Run specific test class:
```bash
python -m unittest test_model.TestPredictions -v
```

### Run specific test:
```bash
python -m unittest test_model.TestPredictions.test_risk_label_is_valid -v
```

## Test Results Interpretation

**✅ PASSED**: Test succeeded, model functionality is correct

**⚠️ SKIPPED**: Test skipped because trained model not found
- Solution: Train a model first with `python train.py <csv_file>`

**❌ FAILED**: Test failed, model has an issue
- Check error message for details
- Review model training and saving process

## Key Validations

### Risk Label Validation
```
Valid Labels: {'Low', 'Medium', 'High'}
Ensures: Model only predicts one of three categories
```

### Confidence Score Validation
```
Valid Range: 0 - 100 (percentage)
Ensures: Scores are normalized probabilities
```

### Probability Validation
```
Sum: ~100% (within 0.1% tolerance)
Ensures: Probabilities are properly calibrated
```

## Example Test Output

```
test_risk_label_is_valid (__main__.TestPredictions) ... ok ✓ Risk label validation test PASSED (label=Low)
test_confidence_in_valid_range (__main__.TestPredictions) ... ok ✓ Confidence range test PASSED (confidence=87.45%)
test_probabilities_sum_to_100 (__main__.TestPredictions) ... ok ✓ Probabilities sum test PASSED (sum=100.0%)

======================== TEST SUMMARY ========================
Tests run: 20
Successes: 20
Failures: 0
Errors: 0
Skipped: 0

✅ ALL TESTS PASSED!
==============================================================
```

## Test Coverage

| Component | Test Cases | Status |
|-----------|-----------|--------|
| Model Loading | 4 | ✓ Covered |
| Single Predictions | 7 | ✓ Covered |
| Batch Predictions | 4 | ✓ Covered |
| Feature Importance | 2 | ✓ Covered |
| **Total** | **17** | ✓ Complete |

## Prerequisites

Before running tests:

1. **Train a model**:
   ```bash
   python train.py sample_sensor_readings.csv
   ```

2. **Install dependencies** (if needed):
   ```bash
   pip install -r requirements.txt
   ```

3. **Run tests**:
   ```bash
   python test_model.py
   ```

## Troubleshooting

### "Model file not found" warning
- **Cause**: No trained model exists
- **Solution**: `python train.py <csv_file>`

### Confidence score out of range
- **Cause**: Model prediction issue
- **Solution**: Retrain model with clean data

### Probabilities don't sum to 100%
- **Cause**: Floating point precision issue or model corruption
- **Solution**: Reload model or retrain

## Continuous Testing

For CI/CD pipelines:

```bash
# Run tests and get exit code
python test_model.py
echo "Exit code: $?"  # 0 = all passed, 1 = failures
```

## Development Notes

- Tests auto-skip if trained model not available
- All predictions are deterministic (random_state=42)
- Batch tests process real sensor data structures
- Tests validate both happy paths and edge cases
