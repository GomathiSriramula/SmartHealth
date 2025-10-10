# 🧪 Analytics Dashboard - Quick Test Guide

## ✅ Pre-Test Checklist

1. **Backend Running:** Port 5000
   ```powershell
   cd d:\SmartHealthFullProject\backend2
   node index.js
   ```

2. **Frontend Running:** Port 5173
   ```powershell
   cd d:\SmartHealthFullProject\frontend
   npm run dev
   ```

3. **MongoDB Connected:** Check console for "MongoDB connected: yes"

4. **User Logged In:** Have valid JWT token

---

## 🚀 Quick Test Steps

### Step 1: Access Analytics
1. Open http://localhost:5173
2. Login with your credentials
3. Click **"Analytics"** in the left sidebar
4. Wait for charts to load (should be < 2 seconds)

**✅ Expected:** 
- Summary cards show statistics
- Charts display with colors
- Last updated timestamp appears
- Auto-refresh shows "ON" (green button)

---

### Step 2: Test Manual Refresh
1. Click **"Refresh Analytics"** button (top-right, blue)
2. Watch for loading spinner
3. Observe "Last updated" timestamp change

**✅ Expected:**
- Button shows "Refreshing..." with spinner
- Charts reload smoothly
- New timestamp appears
- Data updates (if new predictions exist)

---

### Step 3: Test Auto-Refresh Toggle
1. Click **"Auto-refresh ON"** button to disable
2. Button turns gray and says "Auto-refresh OFF"
3. Wait 30+ seconds → No automatic updates
4. Click again to re-enable
5. Button turns green → "Auto-refresh ON"

**✅ Expected:**
- Button state toggles correctly
- Auto-refresh respects enabled/disabled state
- Console shows "🔄 Auto-refreshing analytics..." every 30s when ON

---

### Step 4: Test Time Range Selector
1. Click **"7 days"** button
2. Charts update with last week's data
3. Click **"60 days"** button
4. Charts show 2-month data
5. Return to **"30 days"** (default)

**✅ Expected:**
- Selected button highlighted in blue
- Data re-fetches immediately
- Charts reflect correct time period
- Summary shows "Last X days"

---

### Step 5: Create New Prediction (Live Update Test)

**In Dashboard Tab:**
1. Go to "Submit Report" tab
2. Fill form with HIGH RISK symptoms:
   - Symptoms: `Severe diarrhea, Dehydration, Fever`
   - Age: 45
   - Location: Test City
3. Submit report

**In Analytics Tab:**
1. Wait 30 seconds for auto-refresh
2. OR click "Refresh Analytics" immediately

**✅ Expected:**
- New prediction appears in "Recent High-Risk Alerts"
- "High Risk Cases" card increments by 1
- Red slice in pie chart grows
- Time series chart shows spike on today's date
- "Recent Predictions" count increases

---

### Step 6: Test Chart Interactions

**Pie Chart (Risk Distribution):**
1. Hover over slices → Tooltip shows count & percentage
2. Verify colors: Red (High), Amber (Medium), Green (Low)

**Area Chart (Time Series):**
1. Hover over dates → Tooltip shows daily breakdown
2. Verify stacked areas show all risk levels
3. Check X-axis shows dates correctly

**Bar Charts:**
1. Hover over bars → Tooltip shows exact counts
2. Prediction Types: Check for readable labels
3. Confidence Distribution: Verify 5 ranges

**Top Locations:**
1. Check gold/silver/bronze medals for top 3
2. Verify case counts displayed
3. Should show up to 10 locations

---

## 🔍 What to Look For

### Visual Checks
- ✅ All charts render without errors
- ✅ Colors match risk levels (red/amber/green)
- ✅ Text is readable (no overlap)
- ✅ Charts responsive (resize browser window)
- ✅ Loading spinners appear during fetch
- ✅ No broken images or icons

### Console Checks (Browser DevTools)
```
✅ 📊 Analytics data loaded: {summary: {...}, ...}
✅ 🔄 Auto-refreshing analytics...
✅ Last updated: [timestamp]
❌ No error messages
❌ No 401 Unauthorized
❌ No network failures
```

### Backend Console Checks
```
✅ GET /analytics 200 [response time]
❌ No 500 errors
❌ No database connection errors
```

---

## 🐛 Common Issues & Fixes

### Issue: "Failed to fetch analytics"
**Fix:** 
1. Check backend is running: `netstat -ano | findstr :5000`
2. Verify you're logged in (JWT token valid)
3. Check browser console for specific error

### Issue: Charts show no data
**Fix:**
1. Create test predictions first (submit HIGH RISK reports)
2. Verify predictions exist: `GET /predictions`
3. Check selected time range includes recent data

### Issue: Auto-refresh not working
**Fix:**
1. Verify toggle is ON (green button)
2. Check browser console for interval logs
3. Try manual refresh to test API connectivity

### Issue: Slow loading (>5 seconds)
**Fix:**
1. Reduce time range (try 7 days)
2. Check MongoDB connection speed
3. Verify no network throttling in DevTools

---

## 📊 Sample Data Check

### Minimum Test Data Needed
- **At least 5 predictions** in last 30 days
- **Mix of risk levels:** 2 high, 2 medium, 1 low
- **Different locations:** For hotspot testing
- **Various dates:** For time series chart

### Quick Data Generator
```javascript
// Run in browser console on Dashboard → Submit Report tab
// (Fill form manually, then submit 5 times with different data)
```

OR use CSV Upload:
```csv
reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
Hospital,testuser,45,M,40.7128,-74.0060,Severe diarrhea|Dehydration,2025-10-10T08:00:00Z
Clinic,testuser,32,F,40.7130,-74.0062,Bloody stool|Vomiting,2025-10-09T08:00:00Z
Hospital,testuser,67,M,40.7125,-74.0065,Nausea|Headache,2025-10-08T08:00:00Z
Clinic,testuser,28,F,40.7135,-74.0058,Diarrhea|Fever,2025-10-07T08:00:00Z
Hospital,testuser,55,M,40.7140,-74.0070,Stomach cramps|Fatigue,2025-10-06T08:00:00Z
```

---

## ✅ Success Criteria

### Analytics Dashboard is Working If:

1. **Data Loads:** All charts display within 2 seconds
2. **Auto-Refresh:** Updates occur every 30 seconds
3. **Manual Refresh:** Button triggers immediate reload
4. **Time Ranges:** All 5 options work (7-90 days)
5. **Charts Render:** No blank sections or errors
6. **Tooltips Work:** Hover shows detailed information
7. **Responsive:** Works on different screen sizes
8. **Real-Time:** New predictions appear after auto-refresh
9. **Performance:** No lag or freezing
10. **Authentication:** Requires valid login token

---

## 📸 Screenshot Checklist

Take screenshots of:
- [ ] Full analytics page with all charts
- [ ] Auto-refresh ON state
- [ ] Manual refresh button clicked
- [ ] Different time range selected (7 days)
- [ ] Pie chart with tooltip visible
- [ ] Recent high-risk alerts section
- [ ] Top locations list
- [ ] Time series chart showing trend
- [ ] Mobile/responsive view

---

## 🎯 Next Steps After Testing

1. **If All Tests Pass:**
   - ✅ Analytics is production-ready
   - Document any findings
   - Train users on features
   - Monitor performance metrics

2. **If Issues Found:**
   - Document specific errors
   - Check error logs
   - Review ANALYTICS_DASHBOARD_GUIDE.md troubleshooting
   - Fix issues and retest

3. **Optional Enhancements:**
   - Add export functionality
   - Implement custom date ranges
   - Add more chart types
   - Create scheduled reports

---

## 📞 Support

**Issues?**
- Check `ANALYTICS_DASHBOARD_GUIDE.md` for detailed troubleshooting
- Review browser console errors
- Verify backend logs for API errors
- Check MongoDB connection status

**Questions?**
- Component: `frontend/src/components/Analytics.tsx`
- Backend: `backend2/routes/predictions.js` (GET /analytics)
- Docs: `ANALYTICS_DASHBOARD_GUIDE.md`

---

**Happy Testing! 📊🚀**
