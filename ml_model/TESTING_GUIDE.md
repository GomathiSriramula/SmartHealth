# Model Testing Guide

Complete guide to testing the Disease Outbreak Prediction Model.

## Quick Start

### Validate Model in 30 Seconds
```bash
python validate_model.py
```

This runs quick checks on:
- ✓ Model loads correctly
- ✓ Risk labels are valid (Low/Medium/High)
- ✓ Confidence scores are 0-100%
- ✓ Probabilities sum to 100%
- ✓ Predictions are consistent
- ✓ Feature importance works

### Run Full Test Suite
```bash
python test_model.py
```

Comprehensive tests with:
- 20+ test cases
- Detailed validation for each component
- Edge case testing
- Batch prediction testing

## Test Files Overview

### 1. `validate_model.py` (Quick Validation - ~10 seconds)
**Purpose**: Fast sanity checks for model predictions

**What it tests**:
- Single prediction returns valid risk label
- Confidence scores are 0-100
- Probabilities sum to 100%
- Batch predictions work
- Predictions are deterministic
- Feature importance accessible

**Use when**: You want a quick check that model is working

**Example output**:
```
✓ Risk label valid: Medium
✓ Confidence in range: 78.45%
✓ Probabilities sum to 100: 100.0%
✓ Batch returned 3 predictions
✓ Same input produces same output
✓ Extracted 6 features

✅ ALL VALIDATION TESTS PASSED!
```

### 2. `test_model.py` (Comprehensive Test Suite - ~30 seconds)
**Purpose**: Full validation of all model components

**Test Classes**:

#### `TestModelLoading` (4 tests)
```
test_model_initialization
test_model_loads_from_disk
test_model_has_required_attributes
test_scaler_is_standard_scaler
```

#### `TestPredictions` (7 tests)
```
test_predict_returns_dict
test_predict_has_required_keys
test_risk_label_is_valid
test_confidence_in_valid_range         ← Key test
test_probabilities_dict_format
test_probabilities_sum_to_100          ← Key test
test_timestamp_is_valid
```

#### `TestMultiplePredictions` (4 tests)
```
test_consistent_predictions
test_different_inputs_produce_predictions
test_batch_prediction
test_extreme_values
```

#### `TestFeatureImportance` (2 tests)
```
test_get_feature_importance
test_features_sorted_by_importance
```

**Use when**: You need thorough validation before deployment

**Example output**:
```
test_risk_label_is_valid ... ok ✓ Risk label validation test PASSED (label=Low)
test_confidence_in_valid_range ... ok ✓ Confidence range test PASSED (confidence=87.45%)
test_probabilities_sum_to_100 ... ok ✓ Probabilities sum test PASSED (sum=100.0%)

================ TEST SUMMARY ================
Tests run: 20
Successes: 20
Failures: 0
Errors: 0

✅ ALL TESTS PASSED!
```

## Key Validations

### 1. Risk Label Validation
```python
Valid Values: {'Low', 'Medium', 'High'}
Test: test_risk_label_is_valid()
Ensures: Model always returns one of three categories
```

### 2. Confidence Score Validation
```python
Valid Range: 0 ≤ confidence ≤ 100 (percentage)
Test: test_confidence_in_valid_range()
Ensures: Scores represent valid probability percentages
```

### 3. Probability Validation
```python
Constraint: Sum of all probabilities ≈ 100%
Test: test_probabilities_sum_to_100()
Ensures: Probabilities are properly calibrated
Tolerance: ±0.1% (floating point error)
```

## Common Issues and Solutions

### Issue: "Model file not found"
**Cause**: No trained model exists

**Solution**:
```bash
python train.py sample_sensor_readings.csv
```

Then re-run tests.

### Issue: Test fails with "risk_label not in expected values"
**Cause**: Model returned invalid category

**Solution**:
1. Check model was trained with valid data
2. Verify data cleaning step worked
3. Retrain with `python train.py <csv_file>`

### Issue: Confidence scores out of range
**Cause**: Model's probability calibration issue

**Solution**:
1. Retrain model with more data
2. Check for data quality issues
3. Verify StandardScaler was applied

### Issue: Probabilities don't sum to 100%
**Cause**: Model or scaler corruption

**Solution**:
1. Delete model files: `models/disease_model*.joblib`
2. Retrain: `python train.py sample_sensor_readings.csv`

## Using Tests in CI/CD

### GitLab CI Example
```yaml
test:model:
  stage: test
  script:
    - python validate_model.py
  allow_failure: false
```

### GitHub Actions Example
```yaml
- name: Validate Model
  run: python ml_model/validate_model.py
  
- name: Run Test Suite
  run: python ml_model/test_model.py
```

## Test Coverage Matrix

| Component | Test Count | Critical | Status |
|-----------|-----------|----------|--------|
| Model Loading | 4 | Yes | ✓ |
| Risk Label Validation | 1 | **Yes** | ✓ |
| Confidence Validation | 1 | **Yes** | ✓ |
| Probability Validation | 1 | **Yes** | ✓ |
| Predictions | 7 | Yes | ✓ |
| Batch Predictions | 4 | No | ✓ |
| Edge Cases | 3 | No | ✓ |
| Feature Importance | 2 | No | ✓ |
| **Total** | **23** | **5 Critical** | ✓ |

## Test Execution Flow

```
User runs: python validate_model.py
    ↓
Load model from disk
    ↓
Test 1: Single Prediction
  - Verify risk_label ∈ {Low, Medium, High}
  - Verify 0 ≤ confidence ≤ 100
  - Verify probabilities sum to 100
    ↓
Test 2: Batch Prediction
  - Process 3 sensor readings
  - Validate each result format
    ↓
Test 3: Consistency
  - Same input = same output
    ↓
Test 4: Feature Importance
  - Extract and sort features
    ↓
Report: ✅ ALL TESTS PASSED
```

## Interpreting Test Results

### ✅ All Tests Pass
```
✅ ALL TESTS PASSED!

Model is production-ready:
- Predictions are valid
- Risk labels are correct
- Confidence scores properly calibrated
- Model is deterministic
- All components functional
```

### ⚠️ Tests Skipped
```
⚠️ SKIPPED: Trained model not available

Action needed:
1. Train model: python train.py <csv_file>
2. Re-run tests: python validate_model.py
```

### ❌ Tests Fail
```
❌ test_risk_label_is_valid ... FAILED

Action needed:
1. Review error message
2. Check model training data
3. Retrain model with clean data
4. Re-run tests
```

## Best Practices

1. **Run tests after every training**
   ```bash
   python train.py data.csv && python validate_model.py
   ```

2. **Include in deployment pipeline**
   - Tests must pass before deployment

3. **Monitor test performance**
   - Track execution time
   - Alert if tests slow down

4. **Use in development**
   - Run quick validation during development
   - Run full suite before commits

## Performance Benchmarks

| Test Type | Execution Time | Notes |
|-----------|---|---|
| validate_model.py | ~5-10 seconds | Quick sanity checks |
| test_model.py | ~20-30 seconds | Comprehensive validation |
| Single prediction | ~50-100ms | Fast enough for API |
| Batch (100 readings) | ~1-2 seconds | Efficient batch processing |

## Next Steps

After tests pass:

1. ✅ Model is validated
2. → Deploy to production
3. → Integrate with backend API
4. → Monitor prediction quality in production

For issues or questions, review the detailed error messages in test output.
