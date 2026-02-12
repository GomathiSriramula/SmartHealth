# CSV Sensor Upload Fix - Alerts & ML Predictions

## Problem Summary

When CSV files with sensor readings were uploaded, the data was saved to the database but:
1. ❌ ML predictions were NOT being created
2. ❌ Alerts were NOT being triggered
3. ❌ Frontend didn't show any new predictions or alerts

## Root Causes Found

### Issue #1: Wrong Data Passed to ML Prediction Function
**File:** `backend2/routes/uploads.js` (Line 677)

**Problem:**
```javascript
// BEFORE (WRONG):
if (results.length > 0) {
    mlAnalysis = await analyzeSensorReadingsAndPredict(results);
}
```

The code was passing `results` (raw CSV data array) instead of `insertedRecords` (MongoDB documents with IDs).

**Fix:**
```javascript
// AFTER (CORRECT):
if (insertedRecords.length > 0) {
    const recordsToAnalyze = insertedRecords.map(record => ({
        sensor_id: record.sensor_id,
        pH: record.pH,
        turbidity: record.turbidity,
        conductivity: record.conductivity,
        location: record.location,
        lat: record.lat,
        lng: record.lng
    }));
    mlAnalysis = await analyzeSensorReadingsAndPredict(recordsToAnalyze);
}
```

Now it:
- Uses actual saved records from database
- Extracts only needed fields
- Ensures data consistency

---

### Issue #2: Alert Checker Using Wrong Field Names
**File:** `backend2/services/alertChecker.js` (Lines 121-128)

**Problem:**
```javascript
// BEFORE (WRONG FIELD NAMES):
const recentHighRisks = await Prediction.find({
    location: location,
    riskLevel: { $in: ['HIGH', 'high'] },        // ❌ Wrong field!
    predictedDate: { $gte: timeWindowStart },    // ❌ Wrong field!
    _id: { $ne: prediction._id },
})
.sort({ predictedDate: -1 })                      // ❌ Wrong field!
```

The Prediction model uses:
- ✅ `risk` (not `riskLevel`)
- ✅ `predictedAt` (not `predictedDate`)

**Result:** Query never found previous HIGH predictions, so alerts were never created!

**Fix:**
```javascript
// AFTER (SUPPORTS BOTH FIELD NAMES):
const recentHighRisks = await Prediction.find({
    location: location,
    $and: [
        {
            $or: [
                { risk: { $in: ['HIGH', 'high'] } },
                { riskLevel: { $in: ['HIGH', 'high'] } }
            ]
        },
        {
            $or: [
                { predictedAt: { $gte: timeWindowStart } },
                { predictedDate: { $gte: timeWindowStart } }
            ]
        }
    ],
    _id: { $ne: prediction._id },
})
.sort({ predictedAt: -1, predictedDate: -1 })
```

Now it:
- Checks both `risk` and `riskLevel` fields
- Checks both `predictedAt` and `predictedDate` fields
- Works with any prediction source (sensor, CSV, manual)

---

## Complete Data Flow (Now Working)

### CSV Upload → ML Predictions → Alerts

```
1. User uploads CSV with sensor readings
   ↓
2. CSV parsed and validated
   ↓
3. Records inserted into MongoDB (SensorReading collection)
   ↓
4. ✅ FIX #1: insertedRecords extracted and passed to ML analyzer
   ↓
5. For each sensor reading with pH, turbidity, conductivity:
   - Call ML model to predict water quality risk
   - Save prediction to database (Prediction collection)
   ↓
6. If prediction is HIGH risk:
   ↓ 7. ✅ FIX #2: Alert checker queries with CORRECT field names
   - Finds previous HIGH predictions at same location
   - If 2nd consecutive HIGH → Create alert
   - Send email notification
```

---

## Testing the Fix

### 1. Create Test CSV File

**File:** `test_high_risk_sensors.csv`
```csv
sensor_id,reading_at,lat,lng,turbidity,pH,conductivity,location
S-TEST-001,2026-02-10T10:00Z,17.4530,78.3950,25.0,9.5,800,TestVillage
S-TEST-002,2026-02-10T10:15Z,17.4530,78.3950,28.0,9.8,850,TestVillage
S-TEST-003,2026-02-10T10:30Z,17.4530,78.3950,30.0,10.0,900,TestVillage
```

**Note:** High turbidity (>20) and high pH (>9) should trigger HIGH risk predictions

### 2. Upload via Frontend

1. Start backend: `node backend2/server.js`
2. Start frontend: `npm start` (in frontend directory)
3. Login to dashboard
4. Go to "CSV Upload" tab
5. Select "Sensor Readings" type
6. Upload `test_high_risk_sensors.csv`
7. Check response for ML predictions created

### 3. Verify Results

**Option A: Run Test Script**
```bash
python test_csv_sensor_fix.py
```

**Option B: Check Manually**
```bash
# Check predictions
curl http://localhost:5000/predictions?limit=10

# Check alerts
curl http://localhost:5000/api/alerts?status=active
```

**Expected Results:**
- ✅ 3 predictions created (one per sensor reading)
- ✅ At least 1 HIGH risk prediction
- ✅ Alert triggered after 2nd HIGH risk at same location
- ✅ Email notification sent (if SMTP configured)

### 4. Frontend Verification

After CSV upload:
1. Go to **ML Predictions** tab → Should show new predictions
2. Go to **Alerts** tab → Should show new alert (if 2+ HIGH risks)
3. Check **Outbreak Risk** tab → Should show location on map

---

## Backend Logs to Look For

After uploading CSV with sensor data, you should see:

```
🌊 [CSV Sensor Upload] Processing 3 sensor readings for ML predictions...
✅ [CSV Sensor] Prediction for S-TEST-001: HIGH risk
✅ [CSV Sensor] Prediction for S-TEST-002: HIGH risk
🔍 [Alert Checker] No active alert. Looking for previous HIGH predictions in TestVillage...
   Found 1 previous HIGH predictions in time window
✅ [Alert Creator] THRESHOLD MET: 2 total consecutive HIGHs detected!
🚨 [CSV Sensor Alert] CREATED: 2 consecutive HIGH risk predictions at TestVillage
✅ [CSV Sensor Upload] Complete: 3 predictions, 1 alerts
```

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `backend2/routes/uploads.js` | 677-689 | Use insertedRecords instead of results |
| `backend2/services/alertChecker.js` | 121-140 | Fix field names in query (risk/riskLevel, predictedAt/predictedDate) |

---

## Impact

### Before Fix:
- CSV uploads saved sensor data ✅
- ML predictions NOT created ❌
- Alerts NOT triggered ❌
- Frontend showed no new data ❌

### After Fix:
- CSV uploads saved sensor data ✅
- ML predictions created automatically ✅
- Alerts triggered for consecutive HIGH risks ✅
- Frontend shows predictions and alerts ✅
- Email notifications sent ✅

---

## Additional Notes

### Field Name Compatibility

The system now supports predictions from multiple sources with different field naming:

| Field | Primary Name | Alternate Name |
|-------|--------------|----------------|
| Risk Level | `risk` | `riskLevel` |
| Timestamp | `predictedAt` | `predictedDate` |
| Water Quality | `waterQuality.pH` | `pH` (direct) |

This ensures compatibility with:
- Sensor data uploads
- Manual predictions
- ML service predictions
- Legacy data

### Alert Logic Reminder

Alerts are triggered when:
1. **TWO** consecutive HIGH risk predictions occur
2. At the **same location**
3. Within **48 hours** (configurable)
4. No existing active alert for that location

Single HIGH risk predictions do NOT trigger alerts (by design).

---

## Related Files

- Alert system documentation: `ALERT_LOGIC_GUIDE.md`
- CSV upload guide: `backend2/CSV_UPLOAD_GUIDE.md`
- ML integration: `ML_COMPLETE_DOCUMENTATION.md`
- Alert notifier: `backend2/services/alertNotifier.js`
- Prediction trigger: `backend2/services/predictionTrigger.js`

---

## Date Fixed
February 10, 2026

**Status: ✅ RESOLVED**
