# SmartHealth - Water-Borne Disease Surveillance & Outbreak Prediction System

**Production Ready v1.0** | ML-Powered | Real-Time Email Alerts | Role-Based Geofencing

---

## 📋 Overview

**SmartHealth** is a comprehensive digital health surveillance and outbreak prediction system. Designed for health administrators, operators, and public users, it provides real-time surveillance of water-borne diseases, automated outbreak risk prediction, and localized alert management.

The system integrates an **ML prediction pipeline** (Random Forest Classifier) with a robust **Node.js/Express backend** and an interactive **React + TypeScript frontend dashboard**. By capturing patient case reports directly from clinical staff and field operators (both manually and in bulk), SmartHealth predicts potential outbreaks, triggers localized alerts, and automatically emails warnings to registered users.

---

## 🎯 Key Features

### 1. Water-Borne Disease Case Surveillance
*   **Manual Case Reporting**: Clinical staff and field operators can submit patient case reports capturing age, sex, location (district), village/area, symptoms, severity, and clinical remarks.
*   **Bulk CSV Upload**: Ingest case reports in bulk. Uploads are strictly authenticated, sandboxed per user, and automatically geofenced to the operator's assigned district to prevent geographic data mismatch.

### 2. Machine Learning & Outbreak Prediction
*   **Predictive ML Pipeline**: Powered by a Python Flask REST service, utilising a trained Random Forest Classifier.
*   **Feature Engineering**: Prediction models incorporate features like pH, Turbidity, Dissolved Oxygen, contamination flags (water indices), case density, and seasonality.
*   **Confidence Metrics**: Generates risk level predictions (`LOW`, `MEDIUM`, `HIGH`) with confidence scoring (0-100%) and automated recommendations.
*   **Symptom Analyzer**: Parses report symptoms for critical indicators (such as severe diarrhea, cholera, typhoid, and dehydration) to trigger immediate outbreak risk evaluation.

### 3. Intelligent Alert Lifecycle & Escalation
*   **Escalation Logic**: Checks for consecutive high-risk outbreaks. If exactly **TWO consecutive HIGH risk predictions** occur at the same location within **48 hours**, an active Alert is created.
*   **Auto-Resolution**: If subsequent risk analysis drops below `HIGH`, the active alert is automatically resolved, logging the resolution reason.
*   **Acknowledge & Resolve**: Operators and administrators can manually review, acknowledge, and resolve active alerts via the control panel.

### 4. Role-Based Access Control (RBAC) & Location Geofencing
*   **ADMIN**: Global oversight. Views all alerts/reports across all locations, registers and manages District Operators, resolves alerts, and triggers notification resends.
*   **OPERATOR**: Location-geofenced access. Dashboard, reports, and alert views are filtered strictly to their assigned district. Operators can only ingest data (manually or via CSV) for their own district.
*   **USER (Public Viewer)**: Accesses only active alerts in their assigned geographic area in a simplified view (location, time, and warning reasons) to protect patient privacy.

### 5. Interactive Analytics Dashboard
*   **Surveillance Metrics**: Tracks total case reports, critical cases (3+ concurrent symptoms), and active alerts.
*   **Demographic Splits**: Charts age groups and gender distribution of reported cases.
*   **Symptom Mapping**: Heatmap of symptom frequencies (e.g. Diarrhea, Vomiting, Fever).
*   **Geospatial Clusters**: Identifies geographic hotspots and clusters based on coordinates.
*   **Surveillance History**: Dynamic time-series plotting predictions and reported cases per day.

---

## 🏗️ System Architecture

```
                 ┌────────────────────────────────┐
                 │  React + TypeScript Frontend   │
                 │   Vite Dev Server (Port 5173)  │
                 └───────────────┬────────────────┘
                                 │ HTTP / JSON / JWT
                                 ▼
                 ┌────────────────────────────────┐
                 │       Node.js Express API      │
                 │      Ingestion (Port 5000)     │
                 └──────┬────────┬────────┬───────┘
                        │        │        │
             HTTP/JSON  │        │        │ MongoDB Connection
       ┌────────────────┘        │        └──────────────┐
       ▼                         ▼                       ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Python Flask│         │  Nodemailer  │         │   MongoDB    │
│  ML Service  │         │  Email SMTP  │         │  Surveillance│
│ (Port 5001)  │         │ Notifications│         │ (Port 27017) │
└──────────────┘         └──────────────┘         └──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
*   **Python 3.8+** (with pip)
*   **Node.js 16+** (with npm)
*   **MongoDB** (running locally or cloud URI)

### 1. Setup & Installation

**Express Backend:**
```bash
cd backend2
npm install
```
Configure environment variables by copying `.env.example` to `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_health
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET=your-jwt-secret-key
EMAIL_HOST=smtp.mailtrap.io # for dev alerts
EMAIL_PORT=2525
EMAIL_USER=your-smtp-user
EMAIL_PASS=your-smtp-pass
```

**Python ML Service:**
```bash
cd ml_model
pip install -r requirements.txt
```
Train the initial model using sample dataset:
```bash
python train.py
```

**React Frontend:**
```bash
cd frontend
npm install
```

### 2. Running the System

Start the services in separate terminal windows:

*   **Terminal 1 (ML Service):**
    ```bash
    cd ml_model
    python ml_service.py
    ```
    *Starts the Flask API on http://localhost:5001*

*   **Terminal 2 (Express Backend):**
    ```bash
    cd backend2
    npm run dev
    ```
    *Starts the ingestion server on http://localhost:5000*

*   **Terminal 3 (Vite Frontend):**
    ```bash
    cd frontend
    npm run dev
    ```
    *Access the dashboard at http://localhost:5173*

---

## 📊 API Surface

### Authentication
```
POST   /auth/register            - Register new user
POST   /auth/login               - Login and receive JWT
```

### Case Reports
```
POST   /report                   - Ingest a case report (maps to /reports)
GET    /reports                  - Query / list case reports (filtered by user context)
```

### Outbreak Predictions
```
POST   /predictions              - Save prediction & check alerts
GET    /predictions              - Query predictions history
GET    /predictions/landing-stats - Public landing page summary statistics
```

### CSV Uploads
```
POST   /upload/case-reports      - Upload case reports CSV (authenticated)
GET    /upload/stats             - Ingested statistics summary
```

### Alerts API
```
GET    /api/alerts               - List active / resolved alerts (filtered by role/district)
GET    /api/alerts/stats/summary - Aggregate alert statistics
POST   /api/alerts/:id/resolve   - Manually resolve active alert (Operator/Admin)
POST   /api/alerts/:id/notify    - Resend alert email notification (Admin only)
```

---

## 🧪 Testing

### Run Integration Tests
SmartHealth includes a complete automated test suite verifying auth, report submission, ML prediction generation, alert creation, escalation, and geofencing.
```bash
# In project root
python test_integration.py
```

---

## 📁 Repository Structure

```
SmartHealth/
│
├── backend2/                    # Node.js Express API Service
│   ├── models/                  # MongoDB Mongoose Schemas (User, Alert, AuditLog)
│   ├── routes/                  # API Routers (auth, reports, predictions, uploads, alerts)
│   ├── services/                # Services (alertChecker, alertNotifier)
│   ├── utils/                   # Utilities (auth, mailer, auditLogger)
│   └── index.js                 # Backend Server Entrypoint
│
├── ml_model/                    # Python Flask ML Service
│   ├── models/                  # Trained joblib files (disease_model, scaler)
│   ├── ml_pipeline.py           # Classifier pipeline & feature engineering
│   ├── ml_service.py            # Flask REST Endpoint (predict, health, info)
│   └── train.py                 # Training script
│
├── frontend/                    # Vite + React + TypeScript App
│   ├── src/
│   │   ├── components/          # React Components (Dashboard, CSVUpload, Analytics, etc.)
│   │   └── App.tsx              # Main UI Controller
│
└── test_integration.py          # End-to-End Integration Verification Script
```
