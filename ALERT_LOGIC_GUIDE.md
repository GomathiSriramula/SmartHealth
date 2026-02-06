# Outbreak Alert & Escalation Logic

## Overview

SmartHealth now detects and alerts on water quality outbreaks based on **consecutive HIGH risk predictions** at the same location. This prevents false alarms from single spikes while catching sustained threats.

### Alert Lifecycle

```
1. Prediction created (HIGH risk)
   ↓
2. System checks for previous HIGH risks at same location
   ↓
3. If 2+ consecutive HIGH risks → Alert Created → Email Sent
   ↓
4. Subsequent HIGH risks → Alert Status Updated (prevents duplicates)
   ↓
5. Risk drops to MEDIUM/LOW → Alert Resolved
```

---

## Architecture

### Alert Rules

| Condition | Action |
|-----------|--------|
| Single HIGH risk | No alert (wait for confirmation) |
| 2+ consecutive HIGH risks at same location | Alert created + Email sent |
| Risk drops below HIGH at location | Alert resolved |
| HIGH risk while alert active | Update alert (no duplicate) |
| Alert already active for location | Prevent duplicate alerts |

### Components

**1. Alert Schema** (`backend2/models/Alert.js`)
- Stores: location, risk level, timestamp, reason
- Tracks: notification status, email errors
- Indexes: location, status, createdAt for fast queries

**2. Alert Checker Service** (`backend2/services/alertChecker.js`)
- `checkForAlerts(prediction)` - Core logic
  - Checks for consecutive HIGH predictions
  - Creates alert on threshold met
  - Resolves alert when risk drops
- Non-blocking - errors logged, not thrown
- Idempotent - safe to call multiple times

**3. Alert Notifier Service** (`backend2/services/alertNotifier.js`)
- `sendAlertNotification(alert, recipients)` - Email handler
  - Minimal HTML email with location, risk, timestamp
  - Idempotent - checks if already notified
  - Safe error handling - logs but doesn't crash
- `testEmailConfiguration()` - Verify email setup

**4. Alerts REST API** (`backend2/routes/alertsApi.js`)
- `GET /api/alerts` - List with filtering
- `GET /api/alerts/:id` - Get details
- `POST /api/alerts/:id/notify` - Manual notification
- `POST /api/alerts/:id/resolve` - Manual resolution
- `GET /api/alerts/stats/summary` - Statistics

**5. Integration** (`backend2/routes/predictionsApi.js`)
- Alert checking on every prediction
- Non-blocking (errors don't affect prediction creation)
- Returns alert info in prediction response

---

## Setup

### 1. Install Dependencies

```bash
cd backend2

# Install nodemailer if not already present
npm install nodemailer

# Verify installed
npm list nodemailer
```

### 2. Configure Email (Optional)

Create `.env` in `backend2/`:

```
# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@smarthealthwatersystem.com
ADMIN_EMAIL=admin@company.com
```

**Note:** For Gmail:
1. Enable 2FA on your Gmail account
2. Create an "App Password" (16 characters)
3. Use the app password in EMAIL_PASSWORD (not your regular password)

### 3. Update Backend Index

The backend `index.js` should already have alert routes registered. If not, add:

```javascript
const alertsApiRouter = require('./routes/alertsApi');

// ... in middleware section ...
app.use('/api', alertsApiRouter);
```

### 4. Verify MongoDB

Ensure MongoDB is running and accessible:

```bash
# Test MongoDB connection
mongo mongodb://localhost:27017/smart_health
```

---

## Usage

### Trigger Alert (Via API)

Create 2 consecutive HIGH risk predictions at same location:

```bash
# First HIGH risk prediction
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 5.5,
    "Turbidity": 15.0,
    "Dissolved_Oxygen": 3.0,
    "location": "Main Plant"
  }'

# Wait a moment...

# Second HIGH risk prediction (same location)
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 5.3,
    "Turbidity": 16.0,
    "Dissolved_Oxygen": 2.8,
    "location": "Main Plant"
  }'

# Response will include:
# "alert": { "action": "created", "message": "..." }
```

### List Active Alerts

```bash
curl http://localhost:5000/api/alerts?status=active
```

Response:
```json
{
  "success": true,
  "total": 1,
  "count": 1,
  "alerts": [
    {
      "_id": "...",
      "location": "Main Plant",
      "riskLevel": "HIGH",
      "reason": "Consecutive 2 HIGH risk predictions at Main Plant",
      "status": "active",
      "notificationSent": true,
      "createdAt": "2026-02-06T...",
      "triggeringPredictions": [...]
    }
  ]
}
```

### Get Alert Details

```bash
curl http://localhost:5000/api/alerts/{alert-id}
```

### Resolve Alert Manually

```bash
curl -X POST http://localhost:5000/api/alerts/{alert-id}/resolve \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual resolution - issue investigated"}'
```

### Get Alert Statistics

```bash
curl http://localhost:5000/api/alerts/stats/summary
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalAlerts": 5,
    "activeAlerts": 1,
    "resolvedAlerts": 4,
    "alertsByLocation": [
      {
        "_id": "Main Plant",
        "count": 3,
        "activeCount": 1,
        "resolvedCount": 2
      }
    ],
    "notificationStats": {
      "totalAlerts": 5,
      "notificationsSent": 5,
      "notificationsFailed": 0
    }
  }
}
```

### Send Manual Notification

```bash
curl -X POST http://localhost:5000/api/alerts/{alert-id}/notify \
  -H "Content-Type: application/json" \
  -d '{"recipients": ["admin@company.com", "ops@company.com"]}'
```

---

## API Endpoints Reference

### Create Prediction (with Auto-Alert)

```
POST /api/predictions
Content-Type: application/json

{
  "pH": 7.2,
  "Turbidity": 5.0,
  "Dissolved_Oxygen": 8.5,
  "location": "Main Plant",
  "source": "sensor"
}
```

Response:
```json
{
  "success": true,
  "prediction": {
    "id": "...",
    "risk": "HIGH",
    "confidence": 87,
    "location": "Main Plant",
    "predictedAt": "2026-02-06T..."
  },
  "alert": {
    "action": "created",  // "created", "resolved", or "none"
    "message": "Alert created for Main Plant: 2 consecutive HIGH predictions",
    "alertId": "..."
  }
}
```

### List Alerts

```
GET /api/alerts?location=Main%20Plant&status=active&limit=50&skip=0
```

### Get Alert Detail

```
GET /api/alerts/{id}
```

### Manually Resolve Alert

```
POST /api/alerts/{id}/resolve
Content-Type: application/json

{"reason": "Operational response completed"}
```

### Get Statistics

```
GET /api/alerts/stats/summary
```

### Send Notification

```
POST /api/alerts/{id}/notify
Content-Type: application/json

{"recipients": ["admin@company.com"]}
```

---

## Testing

### Run Integration Tests

```bash
# Terminal 1: Start ML service
cd ml_model
python ml_service.py

# Terminal 2: Start backend
cd backend2
npm start

# Terminal 3: Run tests
python test_alert_logic.py
```

Test sequence:
1. ✓ Backend health check
2. ✓ ML service health check
3. ✓ Single HIGH risk - no alert
4. ✓ Consecutive HIGH risks - alert created
5. ✓ Risk drops - alert resolved
6. ✓ Duplicate alerts prevented
7. ✓ Alerts API list working
8. ✓ Alerts API stats working

### Manual Testing

```bash
# Check backend health (should show MongoDB + ML service status)
curl http://localhost:5000/health

# Create a HIGH risk prediction
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{"pH": 5.5, "Turbidity": 15, "Dissolved_Oxygen": 3, "location": "Test"}'

# Check alerts
curl http://localhost:5000/api/alerts

# Check stats
curl http://localhost:5000/api/alerts/stats/summary
```

---

## Email Configuration

### Gmail Setup (Recommended for Testing)

1. Enable 2-Step Verification on your Google Account
2. Go to myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Copy the 16-character password
5. Add to `.env`:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   ADMIN_EMAIL=recipient@company.com
   ```

### Custom SMTP Server

```
EMAIL_HOST=mail.company.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
EMAIL_FROM=alerts@company.com
```

### Test Email Configuration

```bash
# From backend2 directory
node -e "
const { testEmailConfiguration } = require('./services/alertNotifier');
testEmailConfiguration().then(result => console.log(result));
"
```

---

## Error Handling

### Alert Check Failures (Non-Blocking)

If alert checking fails:
- Logged to console: `[AlertChecker] Error checking for alerts: ...`
- Prediction creation succeeds anyway
- Prediction response includes: `"alert": { "action": "error", "message": "..." }`

### Email Notification Failures (Non-Blocking)

If email fails to send:
- Logged to console: `[AlertNotifier] Error sending alert notification: ...`
- Alert marked with notification error
- Backend continues running
- Can retry manually via `POST /api/alerts/{id}/notify`

### Database Errors

If MongoDB is down:
- Health check shows: `"mongodb": "disconnected"`
- Prediction creation fails with 500 error
- Alert operations return error responses

---

## Troubleshooting

### Alerts Not Being Created

**Check 1:** ML Service Running?
```bash
curl http://localhost:5001/health
```

**Check 2:** Consecutive HIGH Predictions?
```bash
# Both must be at same location and HIGH risk
curl http://localhost:5000/api/predictions?risk=HIGH
```

**Check 3:** Time Window?
- Consecutive predictions must be within 24 hours
- Check timestamps: `predictedAt` in MongoDB

**Check 4:** Logs?
```bash
# Check backend console for alert checking logs
# Look for: [AlertChecker] or [Predictions]
```

### Emails Not Sending

**Check 1:** Email Configuration?
```bash
# Verify .env variables
cat backend2/.env
```

**Check 2:** Email Credentials?
```bash
# Test with Gmail App Password (not regular password)
# Make sure 2FA is enabled on Gmail
```

**Check 3:** SMTP Connection?
```bash
# Test manually
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});
transporter.verify((err, valid) => console.log(err ? 'FAILED: ' + err.message : 'OK'));
"
```

**Check 4:** Recipient Email Valid?
```bash
# Verify ADMIN_EMAIL in .env
# Try manual notification with valid email
curl -X POST http://localhost:5000/api/alerts/{id}/notify \
  -H "Content-Type: application/json" \
  -d '{"recipients": ["your-email@gmail.com"]}'
```

### Duplicate Alerts Still Creating

**Check:** Same location?
- Alerts are created per location
- Different locations can have independent alerts

**Check:** Alert status?
```bash
# View current active alerts
curl http://localhost:5000/api/alerts?status=active
```

---

## Monitoring

### Dashboard Queries

**Active Alerts Now:**
```
GET /api/alerts?status=active
```

**Alerts by Location:**
```
GET /api/alerts?location={location}&limit=100
```

**Recent Resolved Alerts:**
```
GET /api/alerts?status=resolved&limit=20
```

**Failed Notifications:**
```
GET /api/alerts
# Filter response where notificationError != null
```

### Logging

Alert logs appear in backend console:

```
[Predictions] Alert created: Consecutive HIGH risks at Main Plant
[Predictions] Notification result: Email sent to 1 recipient(s)
[AlertChecker] Alert check failed: ...
[AlertNotifier] Error sending alert notification: ...
```

---

## Future Enhancements

Possible extensions (not yet implemented):

- **Multi-level Escalation:** Escalate if alert persists > X hours
- **SMS Alerts:** Send SMS for critical alerts
- **Slack Integration:** Post alerts to Slack channel
- **Custom Alert Rules:** User-defined thresholds per location
- **Alert History:** Archive resolved alerts with analysis
- **Prediction Trends:** Alert on rising trend even without HIGH
- **Geographic Spread:** Alert if HIGH spreads across multiple locations

---

## Production Checklist

- [ ] Email configuration tested and working
- [ ] Recipients configured in ADMIN_EMAIL
- [ ] MongoDB backup configured
- [ ] Alert logs monitored
- [ ] Health check endpoint monitored (CloudWatch, Datadog, etc.)
- [ ] Error handling verified (alert failures don't crash backend)
- [ ] Notification idempotency verified (no duplicate emails)
- [ ] Performance tested with high prediction volume
- [ ] Time window (24 hours) appropriate for your use case
- [ ] Consecutive threshold (2) appropriate for your use case

---

## Summary

**Implementation Status: ✅ COMPLETE**

- ✅ Alert rules implemented (consecutive HIGH detection)
- ✅ Alert model created (MongoDB schema)
- ✅ Email notifications sent (nodemailer integration)
- ✅ REST API for alerts (list, detail, stats, manual operations)
- ✅ Auto-trigger on predictions (integrated into prediction flow)
- ✅ Error handling (non-blocking, idempotent)
- ✅ Test suite (6 comprehensive tests)
- ✅ Documentation (setup, API, troubleshooting)

**Ready for:** Testing, frontend integration, monitoring setup
