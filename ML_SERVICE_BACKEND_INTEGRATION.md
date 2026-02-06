# ML Service & Backend Integration Guide

## Overview

The ML prediction service is now integrated with the backend:

1. **Flask ML Service** (port 5001) - Loads trained model and handles predictions
2. **Backend ML Client** (mlClient.js) - Makes HTTP calls to ML service
3. **Predictions API** (/api/predictions) - Stores and retrieves predictions
4. **Auto-trigger** (predictionTrigger.js) - Automatically predicts on data insertion

---

## Architecture

```
Water Quality Data
    ↓
Backend API (port 5000)
    ↓
ML Client (mlClient.js) ← HTTP ← Flask Service (port 5001)
    ↓
Store Prediction (MongoDB)
    ↓
Response to client
```

---

## Setup

### 1. Install ML Dependencies

```bash
cd ml_model
pip install -r requirements.txt
```

### 2. Train the Model (One-time)

```bash
python ml_pipeline.py
```

This creates:
- `models/disease_model.pkl` - Trained model
- `models/scaler.pkl` - Feature scaler
- `models/metadata.json` - Model metadata

### 3. Start Flask ML Service

```bash
cd ml_model
python ml_service.py
```

Output should show:
```
[INFO] ✓ ML model loaded successfully
[INFO] Flask app running on http://localhost:5001
```

### 4. Configure Backend

Create `backend2/.env`:
```
MONGODB_URI=mongodb://localhost:27017/smart_health
ML_SERVICE_URL=http://localhost:5001
```

### 5. Install Backend Dependencies

```bash
cd backend2
npm install
```

### 6. Start Backend

```bash
npm start
```

---

## API Endpoints

### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "mongodb": "connected",
    "ml_service": "connected"
  },
  "ml_service_details": {
    "status": "healthy",
    "model_loaded": true
  }
}
```

### Create Prediction
```bash
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 7.2,
    "Turbidity": 5.0,
    "Dissolved_Oxygen": 8.5,
    "location": "Main Plant"
  }'
```

Response:
```json
{
  "success": true,
  "prediction": {
    "id": "507f1f77bcf86cd799439011",
    "waterQuality": {
      "pH": 7.2,
      "Turbidity": 5.0,
      "Dissolved_Oxygen": 8.5
    },
    "risk": "LOW",
    "confidence": 92.5,
    "location": "Main Plant",
    "predictedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Predictions
```bash
curl "http://localhost:5000/api/predictions?risk=HIGH&limit=10"
```

### Get Prediction Details
```bash
curl http://localhost:5000/api/predictions/{id}
```

### Get Statistics
```bash
curl http://localhost:5000/api/predictions/stats/summary
```

Response:
```json
{
  "success": true,
  "total": 150,
  "byRisk": {
    "LOW": { "count": 100, "avgConfidence": 89 },
    "MEDIUM": { "count": 40, "avgConfidence": 75 },
    "HIGH": { "count": 10, "avgConfidence": 85 }
  }
}
```

---

## Using Auto-Prediction Trigger

To automatically predict when water quality data is inserted:

```javascript
// In any route handler where you receive water quality data
const { triggerPrediction } = require('../services/predictionTrigger');

// After inserting water quality data
const prediction = await triggerPrediction({
  pH: 7.2,
  Turbidity: 5.0,
  Dissolved_Oxygen: 8.5
}, {
  location: 'Sensor A',
  source: 'sensor'
});

// prediction will be null if ML service fails, but code continues
if (prediction) {
  console.log(`Prediction: ${prediction.risk}`);
}
```

The trigger is safe - if the ML service fails, it:
- Logs the error
- Does NOT crash the backend
- Returns null silently
- Allows the main request to complete

---

## Error Handling

### If ML Service is Down

The backend will:
1. Log error in `/api/predictions` endpoint
2. Return 503 status: "ML service unavailable"
3. Auto-triggers will fail silently and log error
4. Other backend endpoints continue working

### If MongoDB is Down

The backend will:
1. Log connection error on startup
2. Health check shows "degraded" status
3. Predictions cannot be stored
4. Returns 500 error with detail

### Input Validation

Missing required fields:
```
POST /api/predictions
{ "pH": 7.2 }  // Missing Turbidity and Dissolved_Oxygen

Response: 400
{
  "error": "Missing required fields: Turbidity, Dissolved_Oxygen"
}
```

---

## Testing

### Test ML Service Directly

```bash
# Health
curl http://localhost:5001/health

# Single prediction
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d '{"pH": 7.0, "Turbidity": 5.0, "Dissolved_Oxygen": 8.0}'

# Batch
curl -X POST http://localhost:5001/predict-batch \
  -H "Content-Type: application/json" \
  -d '[
    {"pH": 7.0, "Turbidity": 5.0, "Dissolved_Oxygen": 8.0},
    {"pH": 6.5, "Turbidity": 8.0, "Dissolved_Oxygen": 6.0}
  ]'
```

### Test Backend Integration

```bash
# Check health
curl http://localhost:5000/health

# Create prediction
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{"pH": 7.2, "Turbidity": 5.0, "Dissolved_Oxygen": 8.5}'

# List predictions
curl http://localhost:5000/api/predictions

# Check stats
curl http://localhost:5000/api/predictions/stats/summary
```

---

## Troubleshooting

### ML Service won't start
```bash
# Check if model exists
ls ml_model/models/

# If missing, train it
cd ml_model
python ml_pipeline.py

# Try starting again
python ml_service.py
```

### "ML service unavailable" error
```bash
# Check if Flask is running
curl http://localhost:5001/health

# If not, start it
python ml_model/ml_service.py

# Check backend ML_SERVICE_URL config
# Default: http://localhost:5001
```

### Predictions not saving
```bash
# Check MongoDB is running
mongo smart_health

# Check backend can connect
curl http://localhost:5000/health
# Should show mongodb: "connected"
```

### Port conflicts
```bash
# Find what's using port 5000 or 5001
netstat -ano | findstr ":5000"
netstat -ano | findstr ":5001"

# Kill if needed (Windows)
taskkill /F /PID <PID>

# Restart services
```

---

## Production Notes

1. **Model Loading**: Model loads once on startup. No retrain needed.
2. **Timeouts**: ML service has 10s timeout. Adjust in mlClient.js if needed.
3. **Error Safety**: All prediction failures are logged and non-blocking.
4. **Database**: Predictions indexed on `predictedAt` and `risk` for fast queries.
5. **Scaling**: To handle more requests, increase Flask workers or add load balancer.

---

## Files Created

**ML Service:**
- `ml_model/ml_pipeline.py` - Model training (already exists)
- `ml_model/ml_service.py` - Flask service (already exists)

**Backend:**
- `backend2/services/mlClient.js` - HTTP client for ML
- `backend2/services/predictionTrigger.js` - Auto-trigger helper
- `backend2/models/Prediction.js` - MongoDB schema
- `backend2/routes/predictionsApi.js` - REST API endpoints

**Modified:**
- `backend2/index.js` - Added health check and new router

---

## Next Steps

1. ✅ ML service is stable and trained
2. ✅ Backend can call ML service
3. ✅ Predictions are stored in MongoDB
4. ✅ Error handling is safe

Ready for:
- Adding prediction triggers to sensor/report endpoints
- Building frontend dashboard to display predictions
- Adding alert logic for HIGH risk predictions
