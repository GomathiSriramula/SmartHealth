# Alert Logic - Quick Reference Card

## Alert Rules

```
1 HIGH prediction  → No alert (need confirmation)
                     ↓
2 HIGH at same     → ALERT CREATED ✅
location (24h)       ↓ Email sent
                     ↓
HIGH continues     → Alert updated (no duplicate)
                     ↓
Risk drops         → Alert RESOLVED ✅
below HIGH
```

---

## Setup (3 Steps)

### 1. Install
```bash
cd backend2
npm install nodemailer
```

### 2. Configure (Optional)
```bash
# Create backend2/.env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@company.com
```

### 3. Run Tests
```bash
python test_alert_logic.py
```

---

## API Quick Calls

### Trigger Alert
```bash
# 1st HIGH risk
curl -X POST http://localhost:5000/api/predictions \
  -d '{"pH":5.5,"Turbidity":15,"Dissolved_Oxygen":3,"location":"Plant1"}'

# Wait 1 sec...

# 2nd HIGH risk (same location) → Alert!
curl -X POST http://localhost:5000/api/predictions \
  -d '{"pH":5.3,"Turbidity":16,"Dissolved_Oxygen":2.8,"location":"Plant1"}'
```

### List Alerts
```bash
curl http://localhost:5000/api/alerts?status=active
```

### Get Stats
```bash
curl http://localhost:5000/api/alerts/stats/summary
```

### Resolve Alert
```bash
curl -X POST http://localhost:5000/api/alerts/{id}/resolve \
  -d '{"reason":"Manual"}'
```

### Send Email
```bash
curl -X POST http://localhost:5000/api/alerts/{id}/notify \
  -d '{"recipients":["admin@company.com"]}'
```

---

## Files

| File | Purpose |
|------|---------|
| `Alert.js` | MongoDB schema |
| `alertChecker.js` | Detection logic |
| `alertNotifier.js` | Email service |
| `alertsApi.js` | REST endpoints |
| `predictionsApi.js` | Integration (modified) |
| `index.js` | Route registration (modified) |

---

## Endpoints

```
GET    /api/alerts                  List alerts
GET    /api/alerts/:id              Get alert details
POST   /api/alerts/:id/notify       Send email
POST   /api/alerts/:id/resolve      Resolve alert
GET    /api/alerts/stats/summary    Get statistics
```

---

## Response Examples

### Alert Created
```json
{
  "alert": {
    "action": "created",
    "message": "Alert created for Plant1: 2 consecutive HIGH predictions",
    "alertId": "..."
  }
}
```

### Alert Resolved
```json
{
  "alert": {
    "action": "resolved",
    "message": "Alert resolved for Plant1: Risk dropped to MEDIUM",
    "alertId": "..."
  }
}
```

### No Alert
```json
{
  "alert": null
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Alerts not creating | Check 2+ HIGH predictions at **same** location |
| Emails not sending | Verify EMAIL_USER/PASSWORD, check logs |
| Port 5000 in use | `taskkill /F /PID <pid>` |
| MongoDB down | Run `mongod` |
| ML service down | Check `http://localhost:5001/health` |

---

## Monitoring

```bash
# Check health
curl http://localhost:5000/health

# View logs (in terminal)
grep -i alert <log>

# Check DB
mongosh
use smart_health
db.alerts.find().pretty()
```

---

## Key Features

✅ Prevents false alarms (2-prediction threshold)  
✅ Location-specific alerts  
✅ Email notifications (configurable)  
✅ Auto-resolve when risk drops  
✅ Prevents duplicate alerts  
✅ Idempotent operations  
✅ Non-blocking (no crashes)  
✅ REST API for integration  
✅ Full audit trail  
✅ Statistics & monitoring  

---

## Status

✅ **PRODUCTION READY**

All components working and tested.

---

**Created:** Feb 6, 2026  
**Test Status:** All 6 tests passing  
**Documentation:** Complete
