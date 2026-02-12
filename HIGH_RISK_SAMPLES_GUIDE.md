# HIGH RISK Sample Data for Alert Testing

## 📋 Case Reports - High Risk Sample
**File:** `sample_case_reports_high_risk.csv`

### Why These Are HIGH RISK:
- **3+ symptoms per patient** (triggers HIGH risk classification)
- **Critical symptoms**: Fever, Diarrhea, Blood in Stool, Dehydration, Vomiting
- **Same location**: ramapur (enables alert matching)
- **Short timeframe**: All within 2 hours (consecutive HIGH predictions)

### Expected Results:
✅ 5 case reports inserted  
✅ 1 HIGH RISK prediction created (bulk upload)  
✅ Upload twice to trigger alert (2 consecutive HIGH predictions needed)

---

## 🌊 Sensor Readings - High Risk Sample
**File:** `sample_sensor_high_risk.csv`

### Why These Are HIGH RISK:

| Parameter | Normal Range | Our Values | Risk Level |
|-----------|--------------|------------|------------|
| **Turbidity** | < 5 NTU | 18-26 NTU | 🔴 CRITICAL |
| **pH** | 6.5-8.5 | 4.3-5.2 | 🔴 CRITICAL |
| **Conductivity** | < 500 µS/cm | 890-1020 µS/cm | 🔴 HIGH |

### Key Features:
- **Extremely high turbidity** (indicates contamination)
- **Very low pH** (acidic, unsafe water)
- **High conductivity** (dissolved contaminants)
- **Same location**: ramapur (all readings from same coordinates)
- **15-minute intervals**: Sequential readings showing sustained contamination

### Expected Results:
✅ 5 sensor readings inserted  
✅ 5 ML predictions created (one per reading)  
✅ All 5 should be HIGH RISK  
✅ 1+ alerts triggered (2+ consecutive HIGH at same location)

---

## 🧪 Testing Instructions

### Option 1: Upload via Dashboard (Recommended)

**For Case Reports:**
1. Go to **CSV Upload** tab
2. Select **Case Reports**
3. Upload `sample_case_reports_high_risk.csv`
4. See: "🚨 5 HIGH RISK cases detected"
5. **Upload again** to trigger alert (need 2 consecutive HIGHs)
6. Check **Alerts** tab for outbreak warning

**For Sensor Readings:**
1. Go to **CSV Upload** tab
2. Select **Sensor Readings**
3. Upload `sample_sensor_high_risk.csv`
4. See: "🎯 5 ML predictions created, X alerts triggered"
5. Check **ML Predictions** tab to see risk analysis
6. Check **Alerts** tab to see outbreak alerts

### Option 2: Test via Python Script

```powershell
cd D:\SmartHealthFullProject

# Test sensor readings
python test_sensor_csv_predictions.py

# Test case reports
python test_case_reports_upload.py  # (create this script)
```

---

## 📊 Expected Alert Behavior

### Alert Triggering Rules:
- Needs **2+ consecutive HIGH RISK predictions** at the **same location**
- Predictions must be within **48 hours** of each other
- Location must match exactly (case-insensitive)

### To Guarantee Alerts:
1. **First upload**: Creates first HIGH prediction
2. **Second upload** (same location): Creates second HIGH prediction → **ALERT TRIGGERED! 🚨**

### Alert Details:
- **Location**: ramapur
- **Risk Level**: HIGH
- **Reason**: "2 consecutive HIGH risk predictions at ramapur"
- **Status**: active
- **Email notifications**: Sent to health officials

---

## 🎯 What Makes Data HIGH RISK?

### Case Reports:
- ✅ **3+ symptoms** → Automatically HIGH RISK
- ✅ **Critical symptoms**: Fever, Diarrhea, Blood in Stool, Dehydration
- ✅ **2+ critical symptoms** → Also triggers HIGH RISK
- ❌ **1-2 mild symptoms** → LOW/MEDIUM RISK

### Sensor Readings (ML Model):
- ✅ **Turbidity > 10 NTU** → HIGH RISK
- ✅ **pH < 6.0 or > 8.5** → HIGH RISK
- ✅ **Conductivity > 800 µS/cm** → HIGH RISK
- ✅ **Multiple parameters abnormal** → VERY HIGH RISK
- ❌ **All parameters normal** → LOW RISK

---

## 📍 Location Field Importance

**CRITICAL**: Include `location` field for proper alert matching!

```csv
# ✅ GOOD - Will trigger alerts
...,location
...,ramapur
...,ramapur  # Same location = alerts work

# ❌ BAD - Won't trigger alerts reliably
...(no location field)
# or different locations
...,ramapur
...,gandhinagar  # Different = no consecutive detection
```

---

## 🔍 Verification

After uploading, verify in database:

```powershell
# Check predictions
python -c "import requests; r=requests.get('http://127.0.0.1:5000/api/predictions?risk=HIGH'); print(f'HIGH predictions: {len(r.json())}')"

# Check alerts
python -c "import requests; r=requests.get('http://127.0.0.1:5000/api/alerts?status=active'); print(f'Active alerts: {r.json()[\"total\"]}')"
```

---

## 💡 Tips

1. **Upload twice**: First upload creates 1st HIGH prediction, second creates 2nd → Alert!
2. **Same location**: Ensure all records have identical `location` field
3. **Fresh start**: Clear old data if testing: `python clear_sample_alerts.py`
4. **Check logs**: Backend console shows "🚨 [Alert] CREATED" when alert triggers
5. **Time window**: Predictions must be within 48 hours (default)

---

**Files included:**
- ✅ `sample_case_reports_high_risk.csv` - 5 high-risk case reports
- ✅ `sample_sensor_high_risk.csv` - 5 high-risk sensor readings

**Ready to test! Upload these files and watch the alerts trigger! 🚨**
