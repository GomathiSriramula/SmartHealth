# 🚀 Analytics Dashboard - Quick Start

## ⚡ 3-Minute Setup

### 1. Start Backend (if not running)
```powershell
cd d:\SmartHealthFullProject\backend2
node index.js
```
✅ Wait for: "SmartHealth Node ingestion API listening on port 5000"

### 2. Start Frontend (if not running)
```powershell
cd d:\SmartHealthFullProject\frontend
npm run dev
```
✅ Wait for: "Local: http://localhost:5173/"

### 3. Access Analytics
1. Open: http://localhost:5173
2. Login with your credentials
3. Click **"Analytics"** in the sidebar
4. 🎉 See your interactive dashboard!

---

## 📊 What You'll See

```
┌────────────────────────────────────────────────────────────┐
│  📊 Analytics Dashboard                                    │
│  Real-time insights and ML prediction analytics            │
│                                                            │
│  [🔄 Auto-refresh ON]  [🔄 Refresh Analytics]             │
│  Time Range: [7] [14] [30] [60] [90] days                 │
│  Last updated: 3:45 PM • Auto-refreshing every 30s        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Total     │ │   Recent    │ │   Average   │        │
│  │ Predictions │ │ Predictions │ │  Confidence │        │
│  │     156     │ │      45     │ │    87.3%    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐      │
│  │  Risk Distribution   │  │  Prediction Types    │      │
│  │   (Pie Chart)        │  │   (Bar Chart)        │      │
│  │  🔴 High   45%       │  │  Disease Outbreak: 25│      │
│  │  🟡 Medium 35%       │  │  Water Quality:   15│      │
│  │  🟢 Low    20%       │  │  Health Alert:     5│      │
│  └──────────────────────┘  └──────────────────────┘      │
│                                                            │
│  ┌──────────────────────────────────────────────┐        │
│  │       Predictions Over Time (Area Chart)      │        │
│  │  📈 Daily trends by risk level                │        │
│  └──────────────────────────────────────────────┘        │
│                                                            │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │  Top Locations     │  │  Confidence Dist   │         │
│  │  🥇 Downtown: 12   │  │  81-100%:  23     │         │
│  │  🥈 North: 8       │  │  61-80%:   15     │         │
│  │  🥉 South: 5       │  │  41-60%:    5     │         │
│  └────────────────────┘  └────────────────────┘         │
│                                                            │
│  🚨 Recent High-Risk Alerts                               │
│  ┌──────────────────────────────────────────────┐        │
│  │ Cholera Outbreak • 95% confidence             │        │
│  │ 📍 Downtown District • 📅 Oct 10, 3:14 PM     │        │
│  │ URGENT: Severe contamination detected...      │        │
│  └──────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features at a Glance

### 🔄 Auto-Refresh (Every 30 seconds)
- **Green button** = Auto-refresh ON
- **Gray button** = Auto-refresh OFF
- Click to toggle

### 🔘 Manual Refresh
- **Blue button** with refresh icon
- Click anytime for instant update
- Shows "Refreshing..." with spinner

### 📅 Time Range Options
- **7 days** - This week
- **14 days** - Last 2 weeks
- **30 days** - This month (default)
- **60 days** - Last 2 months
- **90 days** - Last quarter

### 📊 5 Chart Types
1. **Pie Chart** - Risk distribution
2. **Area Chart** - Time trends
3. **Bar Chart** - Prediction types
4. **Bar Chart** - Confidence scores
5. **List** - Top locations (with medals!)

---

## 🎯 Common Actions

### View Latest Data
1. Click **"Refresh Analytics"** button
2. Charts update instantly
3. See "Last updated" timestamp change

### Change Time Period
1. Click any time range button (7, 14, 30, 60, 90)
2. Charts recalculate immediately
3. Selected button highlights in blue

### Pause Auto-Refresh
1. Click **"Auto-refresh ON"** toggle
2. Button turns gray → "Auto-refresh OFF"
3. Data won't auto-update (manual refresh still works)

### Resume Auto-Refresh
1. Click **"Auto-refresh OFF"** toggle
2. Button turns green → "Auto-refresh ON"
3. Updates resume every 30 seconds

### Explore Charts
1. **Hover** over any chart for tooltips
2. **Pie chart** shows percentages
3. **Area chart** shows daily breakdown
4. **Bar charts** show exact counts

---

## 🧪 Quick Test

### Test Live Updates (2 minutes)

1. **Open Analytics** in one browser tab
2. **Open Dashboard** in another tab
3. Go to **"Submit Report"** tab
4. Submit a HIGH RISK report:
   - Symptoms: `Severe diarrhea, Dehydration`
   - Any age/location
5. **Return to Analytics tab**
6. Wait 30 seconds for auto-refresh
7. ✅ See your new report in charts!

---

## 📱 Mobile/Tablet

- Works on all devices
- Charts resize automatically
- Touch-friendly buttons
- Swipe-friendly interface

---

## ❓ Quick Troubleshooting

### No Data Showing?
→ Create predictions first (submit HIGH RISK reports)

### Charts Not Loading?
→ Check if backend is running on port 5000

### "Failed to fetch analytics"?
→ Make sure you're logged in (valid JWT token)

### Auto-refresh Not Working?
→ Check if toggle is ON (green button)

---

## 📚 More Info

- **Full Guide:** `ANALYTICS_DASHBOARD_GUIDE.md`
- **Testing Guide:** `ANALYTICS_TESTING.md`
- **Implementation:** `ANALYTICS_IMPLEMENTATION_SUMMARY.md`

---

## 🎉 That's It!

You now have a **real-time, auto-updating analytics dashboard** connected to your ML model predictions!

**Enjoy exploring your data! 📊🚀**

---

## 💡 Pro Tips

✨ **Tip 1:** Keep auto-refresh ON for live monitoring
✨ **Tip 2:** Use 7-day view for recent outbreak detection
✨ **Tip 3:** Check "Recent High-Risk Alerts" for urgent cases
✨ **Tip 4:** Export data by taking screenshots (built-in export coming soon!)
✨ **Tip 5:** Hover over charts for detailed tooltips

---

**Need Help?** Check the full documentation or the troubleshooting sections in the guides!
Updated by shashanka on 24-01-2026