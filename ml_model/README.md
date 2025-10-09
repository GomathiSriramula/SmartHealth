# SmartHealth ML Model

Machine Learning model for predicting water-borne disease outbreak risk based on water quality sensor data.

## Features

- **Disease Outbreak Prediction**: Predicts risk levels (Low/Medium/High) based on water quality parameters
- **Real-time Monitoring**: Continuously monitors sensor data for outbreak risks
- **Automated Alerts**: Sends predictions to backend which emails all registered users
- **Integration**: Seamlessly integrates with SmartHealth backend

## Setup

### 1. Install Dependencies
```bash
cd ml_model
pip install -r requirements.txt
```

### 2. Configure Environment
Edit `.env` file:
```env
BACKEND_URL=http://localhost:5000
API_KEY=secret-key
CHECK_INTERVAL_SECONDS=300
```

### 3. Train Model
```bash
python train.py path/to/your/dataset.csv
```

Expected CSV format:
```csv
pH Level,Turbidity (NTU),Dissolved Oxygen (mg/L),Diarrheal Cases per 100,000 people
7.5,5.2,6.8,45
6.2,12.5,4.2,180
```

## Usage

### Test Integration
```bash
python test_integration.py
```

### One-time Prediction
```bash
python predict.py
```

### Start Monitoring Service
```bash
python monitor.py
```
Monitors sensor data every 5 minutes and sends alerts for high-risk areas.

## How It Works

1. **Fetch Data**: Gets recent sensor readings from backend
2. **Analyze**: ML model predicts outbreak risk for each reading
3. **Detect Risk**: Identifies high-risk areas
4. **Alert**: Sends prediction to backend
5. **Notify**: Backend emails all registered users

## Model Details

- **Algorithm**: Random Forest Classifier
- **Features**: pH, Turbidity, Dissolved Oxygen
- **Output**: Risk level (Low/Medium/High) with confidence score

## Files

- `model.py` - ML model class
- `train.py` - Model training script
- `predict.py` - Prediction service
- `monitor.py` - Continuous monitoring service
- `test_integration.py` - Integration tests
- `.env` - Configuration
- `requirements.txt` - Python dependencies

## Integration with Backend

### Prediction Format
```json
{
  "predictionType": "Water-Borne Disease Outbreak Risk",
  "location": "Area coordinates",
  "riskLevel": "high",
  "details": "Analysis details",
  "recommendations": ["Action 1", "Action 2"],
  "confidence": 92.5,
  "modelVersion": "v1.0",
  "lat": 17.4530,
  "lng": 78.3950
}
```

### Email Notification
When prediction is sent to `/predictions` endpoint:
- Backend creates prediction record
- Fetches all users with emails
- Sends formatted email to all users
- Returns notification status

## Monitoring Service

Runs continuously checking for risks:
- Default: Every 5 minutes (300 seconds)
- Configurable via `CHECK_INTERVAL_SECONDS`
- Logs all activities
- Auto-retries on errors

## Quick Start

```bash
# 1. Test integration
python test_integration.py

# 2. Train model (if you have dataset)
python train.py data/water_pollution_disease.csv

# 3. Run one-time prediction
python predict.py

# 4. Start monitoring (runs continuously)
python monitor.py
```

Press Ctrl+C to stop monitoring service.
