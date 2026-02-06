# ML Module Integration Guide

## Overview

The `ml_module.py` provides a clean, production-ready JSON interface for the ML model with:
- ✓ Comprehensive input validation
- ✓ Graceful error handling
- ✓ Field name normalization (aliases)
- ✓ Batch prediction support
- ✓ Clear error messages
- ✓ Reusable global instance

## Quick Start

### Python Usage

```python
from ml_module import MLModule, initialize_module, predict

# Option 1: Create instance
ml = MLModule()
result = ml.predict_from_json({
    'pH': 7.0,
    'turbidity': 5.0,
    'dissolved_oxygen': 6.0
})

# Option 2: Use global instance
initialize_module()
result = predict({
    'pH': 7.0,
    'turbidity': 5.0,
    'dissolved_oxygen': 6.0
})
```

### Success Response
```json
{
    "success": true,
    "risk_label": "Medium",
    "confidence": 78.45,
    "probabilities": {
        "Low": 15.23,
        "Medium": 78.45,
        "High": 6.32
    },
    "timestamp": "2026-02-06T12:34:56.123456",
    "input": {
        "pH": 7.0,
        "turbidity": 5.0,
        "dissolved_oxygen": 6.0
    }
}
```

### Error Response
```json
{
    "success": false,
    "error": "Missing required fields: dissolved_oxygen",
    "error_code": "INVALID_INPUT",
    "message": "Input validation failed: Missing required fields: dissolved_oxygen",
    "required_fields": ["pH", "turbidity", "dissolved_oxygen"],
    "field_constraints": {
        "pH": {"min": 0, "max": 14, "description": "pH level (0-14)"},
        "turbidity": {"min": 0, "max": 100, "description": "Turbidity in NTU (0-100)"},
        "dissolved_oxygen": {"min": 0, "max": 15, "description": "Dissolved oxygen in mg/L (0-15)"}
    }
}
```

## API Reference

### Class: MLModule

#### Methods

##### `predict_from_json(input_dict)`
Make a single prediction from JSON input.

**Parameters**:
- `input_dict` (dict): Contains pH, turbidity, dissolved_oxygen

**Returns** (dict):
- `success` (bool): Prediction successful
- `risk_label` (str): 'Low', 'Medium', or 'High'
- `confidence` (float): 0-100%
- `probabilities` (dict): Per-class probabilities
- `timestamp` (str): ISO format timestamp
- `error` (str): Error message if failed
- `error_code` (str): Error category

**Example**:
```python
result = ml.predict_from_json({
    'pH': 7.0,
    'turbidity': 5.0,
    'dissolved_oxygen': 6.0
})

if result['success']:
    print(f"Risk: {result['risk_label']}")
    print(f"Confidence: {result['confidence']}%")
else:
    print(f"Error: {result['error']}")
```

---

##### `batch_predict_from_json(input_list)`
Make batch predictions.

**Parameters**:
- `input_list` (list): List of input dictionaries

**Returns** (dict):
- `success` (bool): Batch processing successful
- `predictions` (list): List of prediction results
- `count` (int): Number of predictions
- `errors` (list): Any validation errors (partial results)

**Example**:
```python
result = ml.batch_predict_from_json([
    {'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0},
    {'pH': 6.5, 'turbidity': 8.0, 'dissolved_oxygen': 5.0},
    {'pH': 7.5, 'turbidity': 2.0, 'dissolved_oxygen': 8.0},
])

for prediction in result['predictions']:
    print(f"Sensor {prediction['sensor_id']}: {prediction['risk_label']}")
```

---

##### `validate_json(input_dict)`
Validate input without making prediction (useful for frontend validation).

**Parameters**:
- `input_dict` (dict): Input to validate

**Returns** (dict):
- `valid` (bool): Is input valid
- `error` (str): Error message if invalid
- `normalized_input` (dict): Normalized values if valid

**Example**:
```python
validation = ml.validate_json(user_input)
if validation['valid']:
    # Proceed with prediction
    prediction = ml.predict_from_json(user_input)
else:
    # Show validation error
    print(f"Invalid: {validation['error']}")
```

---

##### `get_model_info()`
Get model configuration and constraints.

**Returns** (dict):
- `model_loaded` (bool): Is model loaded
- `required_fields` (list): Required input fields
- `field_constraints` (dict): Min/max values for each field
- `valid_risk_labels` (list): Possible risk levels
- `confidence_range` (list): Confidence bounds

**Example**:
```python
info = ml.get_model_info()
print(f"Required fields: {info['required_fields']}")
print(f"pH range: {info['field_constraints']['pH']}")
```

---

### Module-Level Functions

#### `initialize_module(model_path)`
Initialize the global module instance.

```python
from ml_module import initialize_module
ml = initialize_module('./models/disease_model.pkl')
```

---

#### `predict(input_dict)`
Make prediction using global instance.

```python
from ml_module import predict
result = predict({'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0})
```

---

#### `batch_predict(input_list)`
Make batch predictions using global instance.

```python
from ml_module import batch_predict
result = batch_predict([...])
```

---

## Input Validation

### Required Fields
```python
REQUIRED_FIELDS = {'pH', 'turbidity', 'dissolved_oxygen'}
```

### Field Aliases
The module automatically normalizes field names:
```python
'ph' → 'pH'
'Turbidity' → 'turbidity'
'Dissolved_Oxygen' → 'dissolved_oxygen'
'dissolved oxygen' → 'dissolved_oxygen'
'do' → 'dissolved_oxygen'
```

### Field Constraints
```
pH:                  0-14
Turbidity:           0-100 (NTU)
Dissolved Oxygen:    0-15 (mg/L)
```

### Error Handling
The module gracefully handles:
- ✓ Missing required fields
- ✓ Invalid field names (with aliases)
- ✓ Wrong data types
- ✓ Out-of-range values
- ✓ NaN/Infinity values
- ✓ Unknown fields (ignored with warning)
- ✓ Model not loaded
- ✓ Prediction errors

## Integration Examples

### With Flask
```python
from flask import Flask, request, jsonify
from ml_module import initialize_module, predict

app = Flask(__name__)
initialize_module()

@app.route('/api/predict', methods=['POST'])
def predict_endpoint():
    data = request.get_json()
    result = predict(data)
    return jsonify(result)

if __name__ == '__main__':
    app.run()
```

### With FastAPI
```python
from fastapi import FastAPI
from ml_module import initialize_module, predict

app = FastAPI()
initialize_module()

@app.post('/api/predict')
def predict_endpoint(data: dict):
    return predict(data)
```

### With Django
```python
from django.http import JsonResponse
from ml_module import initialize_module, predict

# In settings.py
initialize_module()

# In views.py
def predict_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        result = predict(data)
        return JsonResponse(result)
```

---

## Testing

### Run Module Tests
```bash
python ml_module.py
```

### Test Cases
The module includes 6 built-in tests:
1. Valid prediction
2. Missing field
3. Out of range value
4. Field name alias
5. Batch prediction
6. Model information

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| MODEL_NOT_LOADED | Model file not found | Train model first |
| MODULE_NOT_INITIALIZED | Module not initialized | Call initialize_module() |
| INVALID_INPUT | Input validation failed | Fix input according to error message |
| PREDICTION_ERROR | Model prediction failed | Check model and data |

## Performance

| Operation | Time |
|-----------|------|
| predict_from_json() | 50-100ms |
| batch_predict_from_json(100) | 1-2s |
| validate_json() | <1ms |
| get_model_info() | <1ms |

## Best Practices

1. **Initialize Once**
   ```python
   # Good: Initialize once at startup
   from ml_module import initialize_module
   initialize_module()  # In app startup
   ```

2. **Check Success Flag**
   ```python
   # Good: Always check success
   result = predict(data)
   if result['success']:
       risk = result['risk_label']
   else:
       error = result['error']
   ```

3. **Use Validation First**
   ```python
   # Good: Validate before prediction
   validation = ml.validate_json(user_input)
   if validation['valid']:
       prediction = ml.predict_from_json(user_input)
   ```

4. **Handle Errors Gracefully**
   ```python
   # Good: Catch all error cases
   try:
       result = predict(data)
       if result['success']:
           # Use prediction
       else:
           # Handle validation error
           print(result['error'])
   except Exception as e:
       # Handle unexpected error
       print(f"Unexpected error: {e}")
   ```

## Troubleshooting

### Module not initialized
```python
# Solution: Initialize before use
from ml_module import initialize_module, predict
initialize_module()
result = predict(data)
```

### Model file not found
```
Error: Model file not found: ./models/disease_model.pkl
Solution: Train model first
$ python train.py sample_sensor_readings.csv
```

### Field not recognized
```
Error: Missing required fields: ...
Solution: Use correct field names or aliases
Correct: {'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0}
Also works: {'ph': 7.0, 'Turbidity': 5.0, 'do': 6.0}
```

### Value out of range
```
Error: Field 'pH' out of range: pH level (0-14) (got 20.0)
Solution: Use values within constraints
- pH: 0-14
- Turbidity: 0-100 NTU
- Dissolved Oxygen: 0-15 mg/L
```

---

**Status**: ✅ Production Ready

**Last Updated**: February 6, 2026
