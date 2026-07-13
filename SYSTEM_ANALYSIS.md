# Smart Health Monitoring System - Complete Analysis

**Date:** February 9, 2026  
**Purpose:** Document current system behavior for reference before modifications  
**Status:** ANALYSIS ONLY - No Changes Made

---

## 1. Authentication & Login System

### User Model
**File:** [backend2/models.js](backend2/models.js)

User document structure:
```javascript
{
  username: string (required, unique),
  email: string (required, unique),
  passwordHash: string (bcrypt hashed, required),
  created_at: Date (auto-generated)
}
```

### Authentication Flow
**File:** [backend2/routes/auth.js](backend2/routes/auth.js)

#### Registration
- **Endpoint:** `POST /auth/register`
- **Input:** `{ username, password, email }`
- **Validation:**
  - All three fields required
  - Email format validation (regex check)
  - Username uniqueness check
  - Email uniqueness check
- **Output:** User object with `id`, `username`, `email`
- **Error Codes:** 400 (missing fields), 409 (username/email exists), 500 (server error)

#### Login
- **Endpoint:** `POST /auth/login`
- **Input:** `{ email, password }`
- **Process:**
  1. Find user by email
  2. Verify password with bcrypt comparison
  3. Generate JWT token if credentials valid
- **Output:** `{ token }`
- **Token Details:**
  - **Secret Key:** `process.env.JWT_SECRET` (default: "dev-secret")
  - **Expiration:** `process.env.JWT_EXPIRES_IN` (default: "7d")
  - **Payload:** `{ id: user._id, username: user.username }`
- **Error Codes:** 400 (missing fields), 401 (invalid credentials), 500 (server error)

### Frontend Authentication
**File:** [frontend/src/App.tsx](frontend/src/App.tsx)

- Token stored in `localStorage` as `smarthealth_token`
- Username stored in `localStorage` as `smarthealth_username`
- Login/Register components invoke auth endpoints
- Token passed to Dashboard component
- Token included in API requests via `Authorization: Bearer {token}` header

### Current Limitations
❌ **NO USER ROLES** - All users are treated equally (no admin/user distinction)  
❌ **NO ROLE-BASED ACCESS** - Same endpoints/data visible to all users  
❌ **NO PERMISSION CHECKS** - Backend doesn't validate user roles or permissions  

---

## 2. Alert System Architecture

### Alert Model
**File:** [backend2/models/Alert.js](backend2/models/Alert.js)

Alert document structure:
```javascript
{
  location: string (required, indexed),
  riskLevel: enum ['LOW', 'MEDIUM', 'HIGH'],
  reason: string (description of trigger),
  status: enum ['active', 'resolved'] (indexed),
  triggeringPredictions: [
    {
      predictionId: ObjectId,
      risk: string,
      confidence: number,
      pH, Turbidity, Dissolved_Oxygen: numbers,
      predictedAt: Date
    }
  ],
  resolvedAt: Date,
  resolvedReason: string,
  notificationSent: boolean,
  notificationTimestamp: Date,
  notificationError: string,
  recipients: [email],
  metadata: { sourceRequest, triggeredBy, escalationLevel, ... },
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### How Alerts Are Generated

**File:** [backend2/routes/mlPredictions.js](backend2/routes/mlPredictions.js) (lines 420-463)

**Trigger:** When a water quality prediction is made with `riskLevel: 'high'`

**Process:**
1. New HIGH-risk prediction created at a location
2. System checks for **previous HIGH-risk prediction at SAME location** within **last 24 hours**
3. **If NO previous HIGH-risk:** Create alert with severity `'medium'` and `consecutiveCount: 1`
4. **If PREVIOUS HIGH-risk exists:** Create alert with severity `'high'` and `consecutiveCount: 2`

**Key Logic:**
```javascript
// From handleHighRiskAlert() function
const previousHighRisk = await Prediction.findOne({
  location: prediction.location,          // ← LOCATION BASED
  riskLevel: 'high',
  _id: { $ne: prediction._id },
  predictedDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

// Alert created if 2 consecutive HIGH at same location
```

### Alert Lifecycle

| Stage | Status | Details |
|-------|--------|---------|
| **Creation** | `active` | Alert created when consecutive HIGH predictions detected |
| **Active** | `active` | Notification may be sent (email) |
| **Resolution** | `resolved` | Manual action via API or risk drops below HIGH |
| **Resolved** | `resolved` | `resolvedAt`, `resolvedReason` timestamps recorded |

### Alert Severity Levels
**File:** [backend2/utils/alertManager.js](backend2/utils/alertManager.js) (lines 83-100)

| Consecutive Count | Severity | Description |
|-------------------|----------|-------------|
| 1 HIGH | `low` | Initial detection |
| 2 consecutive HIGH in 24h | `medium` | Escalation detected |
| 3+ consecutive HIGH in 24h | `high` | Critical escalation |
| (System defined) | `critical` | Manual escalation possible |

---

## 3. Alert Visibility & Access Control

### Current Behavior: GLOBAL ALERTS (All Users See Everything)

**Alert Retrieval Endpoint:** `GET /api/alerts`
**File:** [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js) (lines 7-42)

```javascript
// Query parameters (optional):
// - location: filter by specific location
// - status: filter by 'active', 'resolved', or 'all'
// - limit: pagination (default 50)
// - skip: pagination offset (default 0)

const filter = {};
if (location) filter.location = location;
if (status !== 'all') filter.status = status;

const alerts = await Alert.find(filter)
  .sort({ createdAt: -1 })
  .limit(parseInt(limit))
  .skip(parseInt(skip));
```

### No User-Specific Filtering

❌ **NOT IMPLEMENTED:**
- No `reporter_id` or `user_id` field in Alert model
- No filtering by logged-in user
- No role-based alert visibility
- No per-location access control

### What Gets Filtered

✅ **Location-based filtering:** Can filter to see alerts for specific water treatment location
✅ **Status-based filtering:** Can filter active vs. resolved alerts
✅ **Pagination:** Standard limit/skip pagination

### Frontend Alert Display
**File:** [frontend/src/components/AlertsPanel.tsx](frontend/src/components/AlertsPanel.tsx) (lines 135-170)

```typescript
const fetchAlerts = useCallback(async () => {
  let url = `${API_URL}/api/alerts?status=${statusParam}&limit=100`;
  
  if (filterLocation) {
    url += `&location=${encodeURIComponent(filterLocation)}`;
  }
  
  const alertResponse = await fetch(url, { headers });
  const alertData = await alertResponse.json();
  setAlerts(alertData.alerts || []);
}, [filterStatus, filterLocation]);  // NO USERNAME PARAMETER
```

**Key Finding:** No user-specific filtering applied in frontend OR backend.

---

## 4. Backend API Endpoints

### Alert Endpoints

#### GET /alerts
- **Purpose:** Retrieve alerts with filtering
- **Query Params:** `status`, `severity`, `type`, `limit`, `skip`
- **Returns:** `{ success, pagination, alerts, total }`
- **Authentication:** Optional (works with/without token)

#### GET /alerts/active
- **Purpose:** Get all active and escalated alerts
- **Returns:** `{ success, count, alerts }`
- **Scope:** All active alerts in system

#### GET /alerts/stats
- **Purpose:** Get statistics on alerts
- **Returns:** Counts by status, severity, type
- **Scope:** Global system statistics

#### POST /alerts/{id}/resolve
- **Purpose:** Manually resolve an alert
- **Input:** `{ reason: string }`
- **Returns:** Updated alert object
- **Result:** Sets `status: 'resolved'`, `resolvedAt: Date`, `resolvedReason`

#### POST /alerts/{id}/notify
- **Purpose:** Manually send/resend alert notification
- **Input:** `{ recipients?: [string] }`
- **Returns:** `{ success, message, alert }`

### Prediction Endpoints

#### POST /ml-predictions/predict
- **Purpose:** Make single water quality prediction
- **Input:** `{ pH, Turbidity, Dissolved_Oxygen, location?, lat?, lng? }`
- **Flow:**
  1. Calls ML service
  2. Saves prediction to database
  3. If HIGH-risk, calls `handleHighRiskAlert()`
  4. Sends email notification
- **Returns:** Prediction object with ML analysis

#### GET /ml-predictions
- **Purpose:** Retrieve predictions with filtering
- **Query Params:** `riskLevel`, `location`, `hours`, `limit`, `skip`
- **Scope:** All predictions (not user-specific)

### Report Endpoints

#### GET /reports
- **Purpose:** Retrieve case reports
- **Query Params:** `reporter_id`, `limit`, `skip`
- **Filtering:** CAN filter by `reporter_id` (gets user-specific reports)
- **Result:** User-specific reports

#### POST /reports
- **Purpose:** Submit case report
- **Authentication:** Optional (accepts Bearer token or x-api-key)
- **User Association:** Uses `reporter_id` from request body (from CSV) OR authenticated username

---

## 5. Frontend Flow & Components

### Component Hierarchy
**File:** [frontend/src/components/Dashboard.tsx](frontend/src/components/Dashboard.tsx)

Main components:
1. **Dashboard** (main container)
   - Receives: `token`, `username`, `onBackToLanding`, `onLogout`
   - Manages state: reports, alerts, tab selection

2. **AlertsPanel** (alert display)
   - Fetches: `GET /api/alerts`
   - Displays: Filtered alerts with status/location filtering
   - Actions: Resolve, resend notifications
   - **Key Issue:** No username parameter in fetch

3. **PredictionsDashboard** (prediction display)
   - Shows predictions globally
   - Not user-specific



### Data Fetching Pattern

**Reports (USER-SPECIFIC):**
```typescript
const url = `${API_URL}/reports?reporter_id=${encodeURIComponent(username)}&limit=10000`;
const res = await fetch(url, { headers });
```
✅ Filters by logged-in username

**Alerts (GLOBAL):**
```typescript
let url = `${API_URL}/api/alerts?status=${statusParam}&limit=100`;
if (filterLocation) {
  url += `&location=${encodeURIComponent(filterLocation)}`;
}
const res = await fetch(url, { headers });
```
❌ No username parameter

**Predictions (GLOBAL):**
```typescript
// Similar to alerts - no user filtering
```

### Authentication State Management
- Token stored in `localStorage`
- Username stored in `localStorage`
- Passed to child components via props
- No role information passed

---

## 6. Database Structure & Relationships

### MongoDB Collections

#### `users` Collection
```javascript
{
  _id: ObjectId,
  username: string,
  email: string,
  passwordHash: string,
  created_at: Date
}
```
- **Usage:** User authentication
- **Indexed:** username, email (unique)

#### `ml_predictions` Collection
```javascript
{
  _id: ObjectId,
  predictionType: string,
  location: string,
  riskLevel: enum ['low', 'medium', 'high'],
  details: string,
  recommendations: [string],
  waterQualityInput: { pH, Turbidity, Dissolved_Oxygen },
  lat, lng: numbers,
  confidence: number,
  predictedDate: Date,
  created_at, updated_at: Date
}
```
- **Trigger:** Created via POST `/ml-predictions/predict` or `/ml-predictions/batch`
- **No user association:** Predictions are system-wide

#### `ml_alerts` Collection
```javascript
{
  _id: ObjectId,
  alertType: string,
  severity: enum ['low', 'medium', 'high', 'critical'],
  status: enum ['active', 'acknowledged', 'resolved'],
  consecutiveCount: number,
  predictions: [ObjectId], // refs to ml_predictions
  location: string,
  description: string,
  details: { firstHighRiskTime, lastHighRiskTime, waterQualityRange },
  createdAt, updatedAt: Date
}
```
- **Key Issue:** No user_id or recipient field for user-specific filtering
- **Indexed:** location, status

#### `case_reports` Collection
```javascript
{
  _id: ObjectId,
  reporter_type: string,
  reporter_id: string, // username of logged-in user
  patient_age: number,
  sex: enum ['M', 'F', 'O'],
  lat, lng: numbers,
  location: string,
  symptoms: [string],
  reported_at: Date,
  created_at: Date
}
```
- **User Association:** `reporter_id` field = username
- **Filtering:** Can filter by reporter_id to get user-specific data

#### `sensor_readings` Collection
```javascript
{
  _id: ObjectId,
  sensor_id: string,
  reading_at: Date,
  lat, lng: numbers,
  turbidity, pH, conductivity: numbers,
  created_at, updated_at: Date
}
```
- **Usage:** Raw sensor data input
- **No user association:** System-wide data

### Relationships Summary

```
User (username) ──→ CaseReport (reporter_id)     [ONE-TO-MANY, user-specific]
Prediction (HIGH) ──→ Alert (predictions array)   [MANY-TO-ONE, location-based]
SensorReading ──→ Prediction (via ML service)     [INDIRECT via ML processing]

Missing: User ──→ Alert (should exist if alerts need user-specific filtering)
```

---

## 7. Current System Behavior Summary

### What Works
✅ User registration and authentication with JWT tokens  
✅ Report submission and user-specific report storage  
✅ Water quality predictions via ML model  
✅ Alert generation from consecutive HIGH predictions  
✅ Alert lifecycle management (active → resolved)  
✅ Email notifications for high-severity alerts  
✅ Location-based alert filtering  
✅ Analytics dashboard with alert statistics  

### What's Missing
❌ **User Roles/Permissions:** All users have identical access  
❌ **User-Specific Alerts:** No way to assign alerts to specific users/roles  
❌ **Role-Based Filtering:** No role-based dashboard views  
❌ **Alert Assignment:** Alerts can't be assigned to users for action  
❌ **User Acknowledgment Tracking:** No way to track which user acknowledged an alert  

### Key Assumptions (Hard-Coded)
- Alerts are location-based, not user-based
- All logged-in users see same alerts
- No distinction between operators, admins, field staff
- Alert recipients come from environment config (admin email)
- No "on-call" roster or team assignment

---

## 8. Data Flow Diagrams

### Alert Creation Flow
```
Water Quality Sensor Data
         ↓
POST /ml-predictions/predict
         ↓
ML Service (Flask) processes
         ↓
HIGH-risk? ──NO→ Save prediction, send notification, return
         ├─YES
         ↓
Check for previous HIGH-risk at same location (24h lookback)
         ├─NONE→ Severity: 'medium', consecutiveCount: 1
         ├─FOUND→ Severity: 'high', consecutiveCount: 2
         ↓
Create Alert document with:
  - location
  - severity
  - predictions array
  - status: 'active'
         ↓
Save to ml_alerts collection
         ↓
Severity 'high' or 'critical'? ──NO→ End
         ├─YES
         ↓
Send email notification (notifyAdminAlert)
         ↓
Update alert.notifications.emailSent = true
```

### Alert Viewing Flow
```
User Logs In
         ↓
Frontend loads Dashboard
         ↓
Dashboard.fetchAlerts() calls:
  GET /api/alerts?status={filterStatus}&location={filterLocation}
         ↓
Backend returns ALL alerts matching filters
(no user-specific filtering applied)
         ↓
AlertsPanel renders alerts
  - Shows location
  - Shows status (active/resolved)
  - Shows reason/description
  - Buttons to resolve or resend notification
         ↓
User clicks "Resolve Alert"
         ↓
POST /api/alerts/{id}/resolve { reason }
         ↓
Alert status → 'resolved'
resolvedAt, resolvedReason saved
```

### Report vs. Alert Visibility

**REPORTS (User-Specific):**
```
User logs in as "john_doe"
     ↓
Dashboard.fetchReports(username="john_doe")
     ↓
GET /reports?reporter_id=john_doe&limit=10000
     ↓
Returns only reports where reporter_id = "john_doe"
```

**ALERTS (Global):**
```
User logs in as "john_doe"
     ↓
AlertsPanel.fetchAlerts()
     ↓
GET /api/alerts?status=active
     ↓
Returns ALL active alerts in system
     ↓
john_doe sees same alerts as all other users
```

---

## 9. Current Limitations & Design Constraints

### Architectural Constraints

| Constraint | Impact | Example |
|-----------|--------|---------|
| No user roles | Can't implement hierarchy | All users see critical alerts, but only some should |
| Alerts location-based | Can't filter by region/district | System-wide view of alerts, no geographic filtering |
| No alert ownership | Can't track who handles what | Multiple users see same alert, don't know who's responsible |
| Global predictions | No user-specific predictions | All users see same water quality data |
| Single admin email | Can't notify different teams | All alerts go to one email address |

### Data Model Gaps

| Missing | Would Enable | Current Workaround |
|---------|--------------|-------------------|
| User.role field | Role-based access | None - all users equal |
| Alert.assignedTo | Task assignment | Manual coordination |
| Alert.acknowledgedBy | Tracking actions | No history |
| User.region/location | Geographic filtering | Manual selection |
| User.preferences | Notification filtering | All alerts shown |

---

## 10. Testing & Verification

### How Alerts Are Tested
**Files:** `test_step3_alerts.py`, `test_step4_notifications.py`

Process:
1. Register test user
2. Login to get token
3. Submit two HIGH-risk case reports at same location
4. Verify alert is created
5. Verify email notification sent
6. Verify alert status changes from active to resolved

### Test Scenarios
- ✅ Single HIGH prediction = medium severity alert
- ✅ Two consecutive HIGH at same location = high severity alert
- ✅ Different locations = separate alerts
- ✅ Manual resolution via API
- ✅ Email notification sent
- ✅ Notification error handling

---

## 11. File Structure Reference

### Backend2 (Node.js)
```
backend2/
├── index.js                          # Main server, CORS config
├── models.js                         # User, CaseReport, SensorReading schemas
├── models/
│   └── Alert.js                      # Alert schema definition
├── routes/
│   ├── auth.js                       # Register, login endpoints
│   ├── alerts.js                     # Alert retrieval endpoints
│   ├── alertsApi.js                  # Alert management (resolve, notify)
│   ├── mlPredictions.js              # Prediction & alert creation
│   ├── reports.js                    # Case reports
│   ├── sensors.js                    # Sensor data
│   └── ml.js                         # ML model endpoints
├── utils/
│   ├── auth.js                       # JWT, password hashing
│   ├── alertManager.js               # Alert lifecycle functions
│   └── mailer.js                     # Email notifications
└── .env                              # Configuration
```

### Frontend
```
frontend/src/
├── App.tsx                           # Main app, auth routing
├── contexts/                         # (if using context API)
├── components/
│   ├── Dashboard.tsx                 # Main dashboard, state management
│   ├── Login.tsx                     # Login form
│   ├── Register.tsx                  # Registration form
│   ├── AlertsPanel.tsx               # Alert display & management
│   ├── PredictionsDashboard.tsx     # Predictions display
│  
│   └── ...other components
└── vite.config.ts                    # Build configuration
```

---

## 12. Next Steps for Safe Modifications

To make changes to this system safely, understand these dependencies:

### Before Adding User Roles
- [ ] Decide: Are alerts location-based or user-based?
- [ ] If user-based: Add `assignedTo` or `region` to Alert schema
- [ ] If location-based: Add User.location field and filter alerts by user's location
- [ ] Update all alert fetch endpoints to apply user-specific filtering

### Before Implementing Role-Based Access
- [ ] Define roles: admin, supervisor, operator, viewer?
- [ ] Add `role` field to User schema
- [ ] Create role middleware for endpoint protection
- [ ] Decide: Does role determine what alerts they see?

### Before Changing Alert Assignment
- [ ] Understand current workflow (who's responsible for resolving alerts?)
- [ ] Decide: Single owner or team assignment?
- [ ] Add `assignedTo`, `teamId`, or `assignmentHistory` to Alert schema
- [ ] Update UI to show assignment status

---

## Summary Table

| Aspect | Current State | User-Specific? | Global? | Notes |
|--------|--------------|--|--|--|
| **Users** | JWT-based | ✅ Individual accounts | ❌ | No roles |
| **Reports** | Case submissions | ✅ Filtered by reporter_id | ❌ | User-specific |
| **Predictions** | ML water quality | ❌ System-wide | ✅ | No owner |
| **Alerts** | Location-triggered | ❌ No filter | ✅ | All users see same |
| **Authentication** | Token in localStorage | ✅ Per user | ❌ | 7-day expiry |
| **Notifications** | Email on critical | ❌ Single admin | ✅ | No team routing |
| **Analytics** | Aggregated stats | ❌ System-wide | ✅ | No user breakdown |

---

**Analysis Complete.**  
This document represents the current system behavior as of February 9, 2026.  
No code has been modified - this is documentation only.

