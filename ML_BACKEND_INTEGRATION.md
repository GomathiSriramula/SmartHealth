# ML Module Backend Integration Guide

This document explains how the ML module is integrated with the Node.js backend and how to use the API endpoints.

## Overview

The ML predictions module is integrated via a Python subprocess that communicates using JSON over stdin/stdout. This approach allows Python ML models to be used seamlessly with a Node.js backend.

### Architecture

```
Frontend (React)
    ↓ (HTTP POST)
Express Routes (/api/ml/*)
    ↓ (subprocess call)
ml_wrapper.py
    ↓ (import)
ml_module.py
    ↓ (load + predict)
Trained Model (joblib)
```

## API Endpoints

### 1. Single Prediction

**Endpoint:** `POST /api/ml/predict`

**Purpose:** Get outbreak risk prediction for a single water quality measurement.

**Request Body:**
```json
{
  "pH": 7.0,
  "turbidity": 5.0,
  "dissolved_oxygen": 6.0,
  "sensorId": "sensor-123"
}
```

**Parameters:**
| Field | Type | Required | Range | Description |
|-------|------|----------|-------|-------------|
| pH | number | Yes | 0-14 | Water pH level |
| turbidity | number | Yes | 0-100 | Water turbidity (NTU) |
| dissolved_oxygen | number | Yes | 0-15 | Dissolved oxygen (mg/L) |
| sensorId | string | No | - | Optional sensor identifier |

**Response on Success (200):**
```json
{
  "success": true,
  "risk_label": "Low",
  "confidence": 95,
  "probabilities": {
    "Low": 0.92,
    "Medium": 0.06,
    "High": 0.02
  },
  "sensorId": "sensor-123"
}
```

**Response on Error (400):**
```json
{
  "success": false,
  "error": "pH must be between 0 and 14",
  "error_code": "VALIDATION_ERROR",
  "details": {
    "field": "pH",
    "received": 20,
    "constraint": "0-14"
  }
}
```

**Example Request (curl):**
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 7.0,
    "turbidity": 5.0,
    "dissolved_oxygen": 6.0,
    "sensorId": "sensor-123"
  }'
```

**Example Request (JavaScript):**
```javascript
fetch('/api/ml/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pH: 7.0,
    turbidity: 5.0,
    dissolved_oxygen: 6.0,
    sensorId: 'sensor-123'
  })
})
.then(res => res.json())
.then(result => {
  if (result.success) {
    console.log(`Risk: ${result.risk_label} (${result.confidence}%)`);
  } else {
    console.error(`Error: ${result.error}`);
  }
});
```

### 2. Batch Predictions

**Endpoint:** `POST /api/ml/batch`

**Purpose:** Get predictions for multiple sensors in a single request.

**Request Body:**
```json
[
  {
    "pH": 7.0,
    "turbidity": 5.0,
    "dissolved_oxygen": 6.0,
    "sensorId": "sensor-1"
  },
  {
    "pH": 6.5,
    "turbidity": 8.0,
    "dissolved_oxygen": 5.0,
    "sensorId": "sensor-2"
  },
  {
    "pH": 7.5,
    "turbidity": 2.0,
    "dissolved_oxygen": 8.0,
    "sensorId": "sensor-3"
  }
]
```

**Constraints:**
- Maximum 1000 predictions per request
- Each item must have pH, turbidity, dissolved_oxygen
- sensorId is optional

**Response on Success (200):**
```json
{
  "success": true,
  "count": 3,
  "successful": 3,
  "failed": 0,
  "predictions": [
    {
      "sensorId": "sensor-1",
      "risk_label": "Low",
      "confidence": 95,
      "probabilities": {
        "Low": 0.92,
        "Medium": 0.06,
        "High": 0.02
      },
      "success": true
    },
    {
      "sensorId": "sensor-2",
      "risk_label": "Medium",
      "confidence": 78,
      "probabilities": {
        "Low": 0.15,
        "Medium": 0.68,
        "High": 0.17
      },
      "success": true
    },
    {
      "sensorId": "sensor-3",
      "risk_label": "Low",
      "confidence": 91,
      "probabilities": {
        "Low": 0.88,
        "Medium": 0.10,
        "High": 0.02
      },
      "success": true
    }
  ]
}
```

**Response with Partial Failures (200):**
```json
{
  "success": true,
  "count": 3,
  "successful": 2,
  "failed": 1,
  "predictions": [
    {
      "sensorId": "sensor-1",
      "risk_label": "Low",
      "confidence": 95,
      "success": true,
      "probabilities": {...}
    },
    {
      "sensorId": "sensor-2",
      "success": false,
      "error": "pH must be between 0 and 14",
      "error_code": "VALIDATION_ERROR",
      "details": {"field": "pH", "received": 20}
    },
    {
      "sensorId": "sensor-3",
      "risk_label": "Low",
      "confidence": 91,
      "success": true,
      "probabilities": {...}
    }
  ]
}
```

### 3. Validate Input

**Endpoint:** `POST /api/ml/validate`

**Purpose:** Validate water quality data without making a prediction (useful for pre-submission validation).

**Request Body:**
```json
{
  "pH": 7.0,
  "turbidity": 5.0,
  "dissolved_oxygen": 6.0
}
```

**Response on Valid (200):**
```json
{
  "valid": true,
  "fields": {
    "pH": {
      "valid": true,
      "value": 7.0
    },
    "turbidity": {
      "valid": true,
      "value": 5.0
    },
    "dissolved_oxygen": {
      "valid": true,
      "value": 6.0
    }
  }
}
```

**Response on Invalid (400):**
```json
{
  "valid": false,
  "error": "turbidity must be between 0 and 100",
  "error_code": "VALIDATION_ERROR",
  "details": {
    "field": "turbidity",
    "received": 150,
    "constraint": "0-100"
  }
}
```

### 4. Get Model Information

**Endpoint:** `GET /api/ml/info`

**Purpose:** Get metadata about the trained ML model.

**Response (200):**
```json
{
  "available": true,
  "model_name": "RandomForestClassifier",
  "version": "1.0.0",
  "trained_on": "2024-01-15",
  "features_count": 6,
  "classes": ["Low", "Medium", "High"],
  "required_fields": ["pH", "turbidity", "dissolved_oxygen"],
  "field_constraints": {
    "pH": {"min": 0, "max": 14},
    "turbidity": {"min": 0, "max": 100},
    "dissolved_oxygen": {"min": 0, "max": 15}
  },
  "field_aliases": {
    "ph": "pH",
    "do": "dissolved_oxygen",
    "turb": "turbidity"
  },
  "feature_importance": {
    "turbidity": 0.35,
    "pH": 0.28,
    "dissolved_oxygen": 0.25,
    "seasonality": 0.08,
    "case_density": 0.03,
    "contamination_flag": 0.01
  }
}
```

### 5. Health Check

**Endpoint:** `GET /api/ml/health`

**Purpose:** Check if the ML module is available and healthy.

**Response on Healthy (200):**
```json
{
  "status": "healthy",
  "model_available": true
}
```

**Response on Unhealthy (503):**
```json
{
  "status": "unhealthy",
  "error": "Model not found at /path/to/model.pkl"
}
```

## Integration Examples

### Example 1: Frontend Form Submission

```typescript
// React component example
async function submitWaterQualityForm(formData: {
  pH: number;
  turbidity: number;
  dissolved_oxygen: number;
  sensorId: string;
}) {
  try {
    const response = await fetch('/api/ml/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.success) {
      // Display prediction
      displayPrediction({
        risk: result.risk_label,
        confidence: result.confidence,
        probabilities: result.probabilities
      });
    } else {
      // Show error
      showError(result.error, result.details);
    }
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

### Example 2: Batch Processing

```javascript
// Process multiple sensor readings
async function processAllSensors(readings) {
  const response = await fetch('/api/ml/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readings)
  });

  const result = await response.json();

  if (result.success) {
    // Update dashboard with predictions
    result.predictions.forEach(pred => {
      if (pred.success) {
        updateSensorCard(pred.sensorId, {
          risk: pred.risk_label,
          confidence: pred.confidence
        });
      } else {
        showSensorError(pred.sensorId, pred.error);
      }
    });

    console.log(`Processed: ${result.successful}/${result.count}`);
  }
}
```

### Example 3: Pre-validation

```javascript
// Validate before submission
async function validateBeforeSubmit(formData) {
  const response = await fetch('/api/ml/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  const result = await response.json();

  if (!result.valid) {
    // Show validation error in UI
    showFieldError(result.details.field, result.error);
    return false;
  }

  return true;
}
```

### Example 4: Display Model Info

```javascript
// Show model information in settings/about section
async function loadModelInfo() {
  const response = await fetch('/api/ml/info');
  const info = await response.json();

  if (info.available) {
    displayInfo({
      model: info.model_name,
      trained: info.trained_on,
      version: info.version,
      features: info.feature_importance
    });
  }
}
```

## Error Codes

| Error Code | Status | Meaning | Solution |
|-----------|--------|---------|----------|
| MISSING_FIELDS | 400 | Required field is missing | Check request includes pH, turbidity, dissolved_oxygen |
| VALIDATION_ERROR | 400 | Field value outside valid range | Check field constraints (see model info) |
| INVALID_REQUEST | 400 | Request format is wrong | Ensure request is valid JSON with correct structure |
| EMPTY_REQUEST | 400 | Empty array provided | Provide at least one prediction |
| REQUEST_TOO_LARGE | 400 | More than 1000 items | Split into multiple requests |
| SPAWN_ERROR | 500 | Failed to start Python process | Check Python executable path in environment |
| PYTHON_ERROR | 500 | Python script error | Check error message for details |
| EXECUTION_ERROR | 500 | Failed to execute prediction | Check ML module logs |
| SERVER_ERROR | 500 | Backend server error | Check backend logs |

## Performance Considerations

### Single Predictions
- **Latency:** ~200-500ms (includes Python startup overhead on first call)
- **Throughput:** ~2-5 predictions/second per backend instance
- **Memory:** ~150-200MB per process

### Batch Predictions
- **Latency:** ~500ms-2s for up to 1000 predictions
- **Throughput:** ~500-1000 predictions/second
- **Memory:** ~200-300MB per process

### Optimization Tips

1. **Use batch endpoint for multiple predictions** instead of multiple single requests
2. **Implement prediction caching** for frequently requested combinations
3. **Use health check endpoint** to verify model availability before critical operations
4. **Implement request queuing** for high-volume scenarios using Bull/RabbitMQ
5. **Monitor error rates** to catch model or data quality issues early

## Environment Configuration

Required environment variables in `.env`:

```env
# ML Module Configuration
PYTHON_PATH=python3.9              # Path to Python executable
ML_MODEL_DIR=./ml_model            # ML model directory
ML_BATCH_SIZE=100                  # Max batch size per request
```

Optional environment variables:

```env
ML_TIMEOUT=10000                   # Subprocess timeout in ms
ML_MAX_MEMORY=500                  # Max memory in MB
```

## Troubleshooting

### Python Module Not Found

**Error:** `ModuleNotFoundError: No module named 'sklearn'`

**Solution:**
```bash
cd ml_model
pip install -r requirements.txt
```

### Model File Not Found

**Error:** `FileNotFoundError: model.pkl not found`

**Solution:**
```bash
cd ml_model
python train.py  # Train the model
python predict.py  # Verify model works
```

### Subprocess Timeout

**Error:** `Timeout waiting for Python process`

**Solution:**
- Check if model file is corrupted
- Check system resource usage
- Increase timeout value in ml.js: `timeout: 15000`

### Invalid Field Values

**Error:** `pH must be between 0 and 14`

**Solution:**
- Use `/api/ml/validate` endpoint to check data before prediction
- Ensure sensors are calibrated correctly
- Check data type (should be numeric)

### Health Check Fails

**Error:** `status: "unhealthy"`

**Solution:**
1. Check ML model file exists: `ls -la ml_model/*.pkl`
2. Verify Python installation: `python --version`
3. Check dependencies: `pip list | grep sklearn`
4. Test ML module directly: `cd ml_model && python ml_wrapper.py`

## Integration Checklist

- [ ] ML module files present (ml_module.py, ml_wrapper.py, model.pkl, scaler.pkl)
- [ ] Python 3.8+ installed with required packages
- [ ] Backend routes registered in index.js
- [ ] Environment variables configured
- [ ] Health check passes: `GET /api/ml/health`
- [ ] Single prediction works: `POST /api/ml/predict`
- [ ] Batch prediction works: `POST /api/ml/batch`
- [ ] Frontend displays predictions correctly
- [ ] Error handling implemented in frontend
- [ ] Monitoring and logging configured

## Next Steps

1. **Test the endpoints** using the provided curl/JavaScript examples
2. **Integrate into Dashboard** to display risk predictions
3. **Add to Reports** to include predictions in case reports
4. **Configure Alerts** to notify when Medium/High risk detected
5. **Monitor Performance** to track prediction latency and accuracy
