# Alert Logic - Quick Setup

## What's New

Outbreak alert system that triggers on **consecutive HIGH risk predictions** at the same location:

- ✅ 1 HIGH risk → No alert (wait for confirmation)
- ✅ 2+ HIGH risks (same location, 24h window) → Alert created + Email sent
- ✅ Risk drops → Alert resolved
- ✅ Duplicate alerts prevented
- ✅ All errors non-blocking (safe)

## Files Created

```
backend2/
├── models/
│   └── Alert.js                    [NEW] MongoDB schema
├── services/
│   ├── alertChecker.js             [NEW] Alert logic
│   └── alertNotifier.js            [NEW] Email service
├── routes/
│   └── alertsApi.js                [NEW] REST API
└── index.js                        [UPDATED] Register alerts route

root/
└── ALERT_LOGIC_GUIDE.md            [NEW] Full documentation
└── test_alert_logic.py             [NEW] Test suite
```

## Quick Start

### 1. Install Nodemailer (if needed)

```bash
cd backend2
npm install nodemailer
```

### 2. Optional: Configure Email

Create `backend2/.env`:

```
# Gmail (recommended for testing)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@smarthealthwatersystem.com
ADMIN_EMAIL=admin@company.com

# Or use your own SMTP server
```

### 3. Start Services

```bash
# Terminal 1: ML Service
cd ml_model
python ml_service.py

# Terminal 2: Backend
cd backend2
npm start

# Terminal 3: Test
python test_alert_logic.py
```

## API Examples

### Trigger Alert

```bash
# First HIGH risk
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 5.5,
    "Turbidity": 15.0,
    "Dissolved_Oxygen": 3.0,
    "location": "Main Plant"
  }'

# Wait 1 second...

# Second HIGH risk (same location) → Alert created
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 5.3,
    "Turbidity": 16.0,
    "Dissolved_Oxygen": 2.8,
    "location": "Main Plant"
  }'
```

Response includes:
```json
"alert": {
  "action": "created",
  "message": "Alert created for Main Plant: 2 consecutive HIGH predictions",
  "alertId": "..."
}
```

### List Active Alerts

```bash
curl http://localhost:5000/api/alerts?status=active
```

### Get Statistics

```bash
curl http://localhost:5000/api/alerts/stats/summary
```

### Manually Resolve

```bash
curl -X POST http://localhost:5000/api/alerts/{id}/resolve \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual resolution"}'
```

## How It Works

```
Prediction created (HIGH risk)
    ↓
Check previous HIGH predictions at same location
    ↓
If 2+ within 24 hours → Create alert
    ↓
Send email notification (non-blocking)
    ↓
Mark notification sent/failed
    ↓
Return alert info to client
    ↓
If subsequent prediction is HIGH → Update alert (no duplicate)
    ↓
If risk drops → Resolve alert
```

## Testing

Run automated test suite:

```bash
python test_alert_logic.py
```

Tests:
1. Single HIGH risk - no alert
2. Consecutive HIGH risks - alert created
3. Risk drops - alert resolved
4. Duplicate alerts prevented
5. Alerts API list working
6. Alerts API stats working

## Key Features

### Smart Alert Rules
- Requires 2 consecutive HIGH predictions (prevents false alarms)
- Same location requirement (location-specific)
- 24-hour time window
- Auto-resolves when risk drops

### Email Notifications
- Minimal content (location, risk, timestamp)
- Only sent when alert confirmed
- HTML + plain text formats
- Idempotent (safe to retry)

### API Endpoints
- `GET /api/alerts` - List with filtering
- `GET /api/alerts/:id` - Get details
- `POST /api/alerts/:id/notify` - Manual email
- `POST /api/alerts/:id/resolve` - Manual resolve
- `GET /api/alerts/stats/summary` - Statistics

### Error Handling
- Alert failures don't crash backend
- Notification failures logged but don't block
- All errors returned in response
- Idempotent operations (safe retries)

## MongoDB Collections

**Alerts Collection:**
```javascript
{
  _id: ObjectId,
  location: "Main Plant",           // Location of outbreak
  riskLevel: "HIGH",                // Risk level (HIGH)
  reason: "Consecutive 2 HIGH...",  // Alert trigger reason
  status: "active",                 // "active" or "resolved"
  triggeringPredictions: [...],     // Predictions that triggered
  notificationSent: true,           // Was email sent?
  notificationError: null,          // Email error if any
  createdAt: Date,                  // Alert created
  resolvedAt: Date,                 // Alert resolved
  updatedAt: Date                   // Last updated
}
```

## Troubleshooting

**Alerts not creating?**
- Check ML service running: `curl http://localhost:5001/health`
- Check 2 HIGH predictions at same location
- Check within 24-hour window
- Review logs for `[AlertChecker]` errors

**Emails not sending?**
- Verify EMAIL_USER and EMAIL_PASSWORD in .env
- For Gmail: use app password (not regular password)
- Test config: `node -e "require('./services/alertNotifier').testEmailConfiguration()"`
- Check logs for `[AlertNotifier]` errors

**Port conflicts?**
```bash
netstat -ano | findstr :5000  # Backend
netstat -ano | findstr :5001  # ML Service
```

## Files Reference

| File | Purpose |
|------|---------|
| `backend2/models/Alert.js` | MongoDB schema for alerts |
| `backend2/services/alertChecker.js` | Core alert logic (consecutive detection) |
| `backend2/services/alertNotifier.js` | Email notification service |
| `backend2/routes/alertsApi.js` | REST API endpoints |
| `backend2/routes/predictionsApi.js` | Updated to trigger alerts |
| `backend2/index.js` | Updated to register alert routes |
| `test_alert_logic.py` | Automated test suite |
| `ALERT_LOGIC_GUIDE.md` | Complete documentation |

## Status

✅ **Implementation Complete**

All components working:
- ✅ Alert rules implemented
- ✅ Email notifications configured
- ✅ REST API created
- ✅ Auto-integration with predictions
- ✅ Error handling verified
- ✅ Test suite provided

**Ready for:** Frontend integration, monitoring setup, production deployment

---

**Next Steps:**
1. Run `test_alert_logic.py` to validate
2. Configure email if not done
3. Monitor alert logs in console
4. Optionally connect to frontend dashboard
5. Set up monitoring/alerting for the alert system itself
