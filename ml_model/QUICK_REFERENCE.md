# Testing Quick Reference Card

## Run Tests in 30 Seconds

### Quick Validation (Recommended for Daily Use)
```bash
python validate_model.py
```
**Time**: ~5-10s | **Tests**: 4 key validations

### Full Test Suite (Recommended Before Deployment)
```bash
python test_model.py
```
**Time**: ~20-30s | **Tests**: 23 comprehensive tests

---

## What Gets Tested?

### ✓ Model Loads Correctly
- Model file exists and loads from disk
- Scaler properly restored
- All components available
```bash
python -m unittest test_model.TestModelLoading -v
```

### ✓ Risk Labels Are Valid
- Returns only: `'Low'`, `'Medium'`, `'High'`
- Never invalid values
```bash
python -m unittest test_model.TestPredictions.test_risk_label_is_valid -v
```

### ✓ Confidence Scores 0-100%
- Range: 0 ≤ confidence ≤ 100
- Properly represents probability
```bash
python -m unittest test_model.TestPredictions.test_confidence_in_valid_range -v
```

### ✓ Probabilities Sum to 100%
- All probs: 0 ≤ prob ≤ 100
- Sum: ~100% (±0.1% tolerance)
```bash
python -m unittest test_model.TestPredictions.test_probabilities_sum_to_100 -v
```

---

## Typical Output

### ✅ All Tests Pass
```
✓ Risk label valid: Low
✓ Confidence in range: 87.45%
✓ Probabilities sum to 100: 100.0%
✓ Batch returned 3 predictions
✓ Same input produces same output
✓ Extracted 6 features

✅ ALL VALIDATION TESTS PASSED!
```

### ⚠️ Model Not Found
```
⚠️ Model file not found!
   Please train a model first: python train.py <csv_file>
```

### ❌ Test Failed
```
❌ Test failed: risk_label not in expected values
Expected: {'Low', 'Medium', 'High'}
Got: 'Invalid'

Solution: Retrain model with valid data
```

---

## Common Commands

| Command | Purpose | Time |
|---------|---------|------|
| `python validate_model.py` | Quick sanity check | 5-10s |
| `python test_model.py` | Comprehensive validation | 20-30s |
| `python -m unittest test_model.TestPredictions -v` | Run prediction tests only | 5-10s |
| `python -m unittest test_model.TestPredictions.test_confidence_in_valid_range -v` | Run single test | <1s |

---

## Test Results Legend

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ PASS | Test passed successfully | Continue |
| ❌ FAIL | Test failed validation | Debug & retrain |
| ⚠️ SKIP | Test skipped (no model) | Train model first |

---

## Validation Checklist

Before deploying model to production:

- [ ] Run `python validate_model.py` - all tests pass
- [ ] Run `python test_model.py` - 23/23 tests pass
- [ ] Risk labels: always 'Low', 'Medium', or 'High'
- [ ] Confidence: always 0-100%
- [ ] Probabilities: sum to ~100%
- [ ] Model can be loaded from disk
- [ ] Batch predictions work
- [ ] Feature importance accessible

---

## Troubleshooting

### Model Not Found
```bash
# Train model first
python train.py sample_sensor_readings.csv

# Then test
python validate_model.py
```

### Risk Label Invalid
```bash
# Problem: Model returning wrong values
# Solution: Retrain with clean data

python train.py clean_data.csv
python validate_model.py
```

### Confidence Out of Range
```bash
# Problem: Probability scaling issue
# Solution: Delete and retrain

rm models/disease_model*.joblib
python train.py sample_sensor_readings.csv
python validate_model.py
```

---

## Integration Examples

### GitHub Actions
```yaml
- name: Validate Model
  run: python ml_model/validate_model.py
```

### GitLab CI
```yaml
test:model:
  script:
    - python validate_model.py
```

### Pre-deployment Check
```bash
#!/bin/bash
python validate_model.py || exit 1
docker build -t model .
docker push registry/model
```

---

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| validate_model.py | <15s | 5-10s |
| test_model.py | <45s | 20-30s |
| Single prediction | <200ms | 50-100ms |
| Batch (100) | <5s | 1-2s |

---

## Decision Tree

```
START: Run tests?
  │
  ├─ Quick check needed?
  │  └─ python validate_model.py
  │
  ├─ Before deployment?
  │  └─ python test_model.py
  │
  ├─ Specific test needed?
  │  └─ python -m unittest test_model.<TestClass>.<test_name> -v
  │
  └─ Tests failing?
     ├─ Model not found?
     │  └─ python train.py <csv_file>
     │
     ├─ Risk label invalid?
     │  └─ Retrain with clean data
     │
     ├─ Confidence out of range?
     │  └─ Delete & retrain model
     │
     └─ Still failing?
        └─ Review TESTING_GUIDE.md
```

---

## Files Reference

| File | Purpose | Time |
|------|---------|------|
| `validate_model.py` | Quick validation | 5-10s |
| `test_model.py` | Full test suite | 20-30s |
| `TEST_DOCUMENTATION.md` | Test reference | - |
| `TESTING_GUIDE.md` | Complete guide | - |
| `TESTING_ARCHITECTURE.md` | System design | - |

---

## Key Metrics

```
Total Tests:     23
Critical Tests:  3 (risk labels, confidence, probabilities)
Pass Rate:       100% (when model is valid)
Execution Time:  20-30 seconds
Coverage:        Model loading, predictions, batch, edge cases, features
```

---

**Last Updated**: February 6, 2026  
**Status**: Production Ready ✅  
**Next Step**: Run `python validate_model.py`
