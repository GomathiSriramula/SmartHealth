# ML Integration Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SmartHealth Application                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Frontend (React/TypeScript)                    │   │
│  │                       Port 5173 (localhost)                        │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │   │
│  │  │   Dashboard  │  │   Analytics  │  │   Sensors    │             │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │   │
│  │         │                 │                 │                     │   │
│  │         └─────────────────┼─────────────────┘                     │   │
│  │                           │                                       │   │
│  │                    [ML Prediction API]                           │   │
│  │                                                                     │   │
│  └─────────────────────────┬───────────────────────────────────────┬─┘   │
│                            │ HTTP JSON                             │      │
│                            │                                       │      │
├───────────────────────────┼───────────────────────────────────────┼──────┤
│                           ▼                                       ▼      │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                   Backend (Express/Node.js)                          │ │
│  │                    Port 5000 (localhost)                            │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  API Routes (/api/*)                                        │  │ │
│  │  │                                                              │  │ │
│  │  │  ┌─────────────────────────────────────────────────────┐   │  │ │
│  │  │  │ ML Routes (/api/ml/*)  [NEW]                        │   │  │ │
│  │  │  │                                                     │   │  │ │
│  │  │  │  POST   /api/ml/predict      ──┐                  │   │  │ │
│  │  │  │  POST   /api/ml/batch         ──┤─ callMLModule() │   │  │ │
│  │  │  │  POST   /api/ml/validate      ──┤                │   │  │ │
│  │  │  │  GET    /api/ml/info          ──┤                │   │  │ │
│  │  │  │  GET    /api/ml/health        ──┘                │   │  │ │
│  │  │  │                                                     │   │  │ │
│  │  │  └─────────────────────────────────────────────────────┘   │  │ │
│  │  │                                                              │  │ │
│  │  │  ┌─────────────────────────────────────────────────────┐   │  │ │
│  │  │  │ Other Routes (/api/*)                              │   │  │ │
│  │  │  │ - /api/auth/*     (authentication)                 │   │  │ │
│  │  │  │ - /api/reports/*  (case reports)                   │   │  │ │
│  │  │  │ - /api/sensors/*  (sensor data)                    │   │  │ │
│  │  │  │ - /api/uploads/*  (CSV upload)                     │   │  │ │
│  │  │  └─────────────────────────────────────────────────────┘   │  │ │
│  │  │                                                              │  │ │
│  │  └──────────┬───────────────────────────────────────────────────┘  │ │
│  │             │                                                      │ │
│  └─────────────┼──────────────────────────────────────────────────┬──┘ │
│                │ Subprocess Call                                  │    │
│                │ (spawnSync)                                      │    │
│                │                                                  │    │
└────────────────┼──────────────────────────────────────────────────┼────┘
                 │                                                  │
                 ▼                                                  ▼
        ┌─────────────────────────┐                      ┌──────────────────┐
        │   Python Subprocess     │                      │   MongoDB        │
        │                         │                      │                  │
        │ ml_wrapper.py           │                      │  Collections:    │
        │                         │                      │  - users         │
        │ Accepts:                │                      │  - reports       │
        │ - JSON stdin            │                      │  - sensors       │
        │ - Command arg           │                      │  - predictions   │
        │                         │                      │                  │
        │ Returns:                │                      └──────────────────┘
        │ - JSON stdout           │
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │    ML Module            │
        │  ml_module.py           │
        │                         │
        │ Classes:                │
        │ - MLModule              │
        │ - InvalidInputError     │
        │                         │
        │ Methods:                │
        │ - predict_from_json()   │
        │ - batch_predict_...()   │
        │ - validate_json()       │
        │ - get_model_info()      │
        │                         │
        └────────────┬────────────┘
                     │ Load & Use
                     │
                     ▼
        ┌─────────────────────────┐
        │   Model Artifacts       │
        │   (joblib files)        │
        │                         │
        │ - model.pkl             │
        │ - scaler.pkl            │
        │ - metrics.pkl           │
        │ - features.pkl          │
        │                         │
        │ RandomForestClassifier  │
        │ (Trained)               │
        │                         │
        └─────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────┐
│ User enters  │
│ sensor data  │
│ in Dashboard │
└──────┬───────┘
       │
       │ React Component
       │ {pH, turbidity, DO}
       │
       ▼
┌──────────────────────────┐
│ Frontend sends HTTP POST │
│ to /api/ml/predict       │
└──────┬───────────────────┘
       │ fetch({method: 'POST', body: JSON})
       │
       ▼
┌──────────────────────────────────┐
│ Backend Route Handler            │
│ (backend2/routes/ml.js)          │
│                                  │
│ 1. Validate request              │
│ 2. Check required fields         │
│ 3. Call callMLModule()           │
└──────┬───────────────────────────┘
       │ subprocess input
       │
       ▼
┌──────────────────────────────────┐
│ Python ml_wrapper.py             │
│                                  │
│ 1. Read JSON from stdin          │
│ 2. Parse arguments               │
│ 3. Call MLModule                 │
└──────┬───────────────────────────┘
       │ import & method call
       │
       ▼
┌──────────────────────────────────┐
│ MLModule.predict_from_json()     │
│ (ml_module.py)                   │
│                                  │
│ 1. Validate inputs               │
│ 2. Normalize field names         │
│ 3. Load model from disk          │
│ 4. Create feature array          │
│ 5. Get prediction                │
│ 6. Calculate confidence          │
│ 7. Return JSON                   │
└──────┬───────────────────────────┘
       │ JSON to stdout
       │
       ▼
┌──────────────────────────────────┐
│ Backend processes response       │
│                                  │
│ 1. Parse JSON                    │
│ 2. Check success flag            │
│ 3. Format HTTP response          │
│ 4. Return to client              │
└──────┬───────────────────────────┘
       │ HTTP JSON response
       │
       ▼
┌──────────────────────────────────┐
│ Frontend displays prediction     │
│                                  │
│ Risk Card:                       │
│ ┌──────────────────────────┐    │
│ │ Risk Level: Low          │    │
│ │ Confidence: 95%          │    │
│ │                          │    │
│ │ Low: 92%                 │    │
│ │ Medium: 6%               │    │
│ │ High: 2%                 │    │
│ └──────────────────────────┘    │
│                                  │
└──────────────────────────────────┘
```

## Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP REQUEST (200 bytes)                     │
│                                                                 │
│  POST /api/ml/predict                                           │
│  Content-Type: application/json                                │
│  Content-Length: 68                                             │
│                                                                 │
│  {                                                              │
│    "pH": 7.0,                                                   │
│    "turbidity": 5.0,                                            │
│    "dissolved_oxygen": 6.0,                                     │
│    "sensorId": "sensor-123"                                     │
│  }                                                              │
│                                                                 │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ Processing Time: ~300ms
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HTTP RESPONSE (400 bytes)                     │
│                                                                 │
│  HTTP/1.1 200 OK                                               │
│  Content-Type: application/json                                │
│  Content-Length: 387                                            │
│                                                                 │
│  {                                                              │
│    "success": true,                                             │
│    "risk_label": "Low",                                         │
│    "confidence": 95,                                            │
│    "probabilities": {                                           │
│      "Low": 0.92,                                               │
│      "Medium": 0.06,                                            │
│      "High": 0.02                                               │
│    },                                                           │
│    "sensorId": "sensor-123"                                     │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Batch Processing Flow

```
┌──────────────────────────────┐
│ Frontend has 100 sensors     │
│ with water quality readings  │
└──────────────┬───────────────┘
               │
               │ Create batch array
               │ [reading1, reading2, ... reading100]
               │
               ▼
┌──────────────────────────────┐
│ POST /api/ml/batch           │
│ Max 1000 items per request   │
│ ~10KB JSON payload           │
└──────────────┬───────────────┘
               │
               │ Processing Time: ~800ms for 100 items
               │
               ▼
┌──────────────────────────────────────┐
│ Response: 100 predictions            │
│ {                                    │
│   "success": true,                   │
│   "count": 100,                      │
│   "successful": 98,                  │
│   "failed": 2,                       │
│   "predictions": [                   │
│     {success: true, risk_label...},  │
│     {success: true, risk_label...},  │
│     {success: false, error: ...},    │
│     ...                              │
│   ]                                  │
│ }                                    │
└──────────────────────────────────────┘
               │
               │ Update all sensor cards
               │ with predictions
               │
               ▼
┌──────────────────────────────┐
│ Dashboard displays           │
│ - Green cards (Low risk)     │
│ - Yellow cards (Medium)      │
│ - Red cards (High risk)      │
│                              │
│ Risk distribution summary    │
│ Alerts for high-risk sensors │
└──────────────────────────────┘
```

## Error Handling Flow

```
┌──────────────────────────────┐
│ User submits request         │
│ with invalid pH (20)         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Backend validates:           │
│ - Is pH a number? ✓          │
│ - Is pH in range 0-14? ✗     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Return HTTP 400 with error           │
│ {                                    │
│   "success": false,                  │
│   "error": "pH must be 0-14",        │
│   "error_code": "VALIDATION_ERROR",  │
│   "details": {                       │
│     "field": "pH",                   │
│     "received": 20,                  │
│     "constraint": "0-14"             │
│   }                                  │
│ }                                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Frontend shows error message │
│ "pH must be between 0 and 14"│
│                              │
│ Highlights field in red      │
│ Suggests valid range         │
└──────────────────────────────┘
```

## Endpoint Call Frequency

```
Time     Frontend           Backend             Python ML
 ↓       Activity           Activity            Activity
 │
 │  GET /api/ml/info       Load model info    Load metadata
 │  (once on startup)      ──────────────────>    ~100ms
 │
 │  ...dashboard usage...
 │
 │  POST /api/ml/predict   Make prediction    Run inference
 │  (user submits form)    ──────────────────>    ~300ms
 │
 │  ...polling every 30s...
 │
 │  POST /api/ml/batch     Process all        Multiple inferences
 │  (refresh all sensors)  ──────────────────>    ~1000ms
 │
 │  GET /api/ml/health     Health check       Quick validation
 │  (every 5 minutes)      ──────────────────>    ~50ms
 │
```

## Storage & Persistence

```
┌─────────────────────────────────────────────┐
│          Persistent Storage                 │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Disk (/ml_model/)                    │   │
│  │                                      │   │
│  │ Files:                               │   │
│  │ - model.pkl (20MB)                   │   │
│  │ - scaler.pkl (5KB)                   │   │
│  │ - features.pkl (2KB)                 │   │
│  │ - metrics.pkl (3KB)                  │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ MongoDB (Predictions Log)            │   │
│  │                                      │   │
│  │ Collections:                         │   │
│  │ - predictions                        │   │
│  │   {timestamp, sensorId, pH,          │   │
│  │    turbidity, do, risk_label,        │   │
│  │    confidence, actual_outbreak?}     │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## Component Interaction

```
┌──────────────┐
│   Frontend   │ Component Display
│  Dashboard   │ Risk Cards, Charts
└──────┬───────┘
       │
       │ Uses: fetch API
       │
       ▼
┌──────────────────────┐
│  Express Routes      │ Request Handling
│  (/api/ml/*)         │ Validation, Routing
└──────┬───────────────┘
       │
       │ Uses: spawnSync
       │
       ▼
┌──────────────────────┐
│ Python Subprocess    │ Subprocess Management
│ ml_wrapper.py        │ JSON I/O
└──────┬───────────────┘
       │
       │ Uses: import
       │
       ▼
┌──────────────────────┐
│ ML Module            │ Prediction Engine
│ ml_module.py         │ Validation, ML Logic
└──────┬───────────────┘
       │
       │ Uses: joblib.load
       │
       ▼
┌──────────────────────┐
│ Trained Model        │ Model Artifacts
│ model.pkl            │ Feature Scaling
│ scaler.pkl           │ Evaluation Metrics
└──────────────────────┘
```

---

This architecture diagram shows:
- **System components** and their relationships
- **Data flow** from user input to displayed prediction
- **Request/response** format and processing time
- **Batch processing** capabilities
- **Error handling** mechanisms
- **Storage** and persistence layers
- **Component interactions** with technologies used

The design emphasizes:
- ✅ Separation of concerns
- ✅ Scalability (batch processing)
- ✅ Reliability (error handling)
- ✅ Performance (subprocess isolation)
- ✅ Maintainability (clear interfaces)
