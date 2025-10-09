# ML Predictions Dashboard Guide

## 🎉 Features Overview

The **ML Predictions Dashboard** displays real-time disease outbreak risk predictions made by the machine learning model based on water sensor data analysis.

## 📍 Location

Navigate to: **Dashboard → ML Predictions tab** (lightbulb icon 💡)

URL: `http://localhost:5174` (login required)

## 🎨 Dashboard Components

### 1. **Statistics Cards** (Top Section)
- **Total Predictions**: Total number of ML predictions made
- **High Risk**: Count of high-risk outbreak alerts (🚨 red)
- **Medium Risk**: Count of medium-risk alerts (⚠️ yellow)  
- **Low Risk**: Count of low-risk status (✅ green)

### 2. **Filter Tabs**
Quick filters to view predictions by risk level:
- **All**: Show all predictions
- **High**: Only high-risk alerts
- **Medium**: Only medium-risk alerts
- **Low**: Only low-risk status

### 3. **Prediction Cards**
Each prediction card displays:

#### Header Section
- Risk level badge with icon (🚨 ⚠️ ✅)
- Timestamp of prediction
- "View Details" button to expand

#### Quick Stats (5 boxes)
- **Total Readings**: Number of sensor readings analyzed
- **High Risk**: Count of high-risk readings
- **Medium Risk**: Count of medium-risk readings  
- **Low Risk**: Count of low-risk readings
- **Confidence**: ML model confidence score (%)

#### Summary
- Detailed description of the outbreak risk
- Analysis of affected areas
- Recommendations for health authorities

#### Notification Info
- Shows how many users received email notifications
- Format: "📧 Email notifications sent to X registered users"

#### Expanded Details (Click "View Details")
- **Affected Locations**: Grid of all sensor locations
  - Each location card shows:
    - Location number
    - Risk level badge
    - GPS coordinates (lat, lng)
    - "View on Map" link → Opens Google Maps

## 🔄 Auto-Refresh

The dashboard automatically refreshes every **30 seconds** to display new predictions in real-time.

## 📊 How Predictions Are Generated

1. **Sensor Data Upload**: Users upload water quality sensor readings via CSV Upload tab
2. **ML Analysis**: The ML model analyzes pH, turbidity, and dissolved oxygen levels
3. **Risk Classification**: Each reading is classified as High/Medium/Low risk
4. **Prediction Creation**: If significant risk detected, prediction is saved
5. **Email Notifications**: All registered users receive email alerts automatically
6. **Dashboard Display**: Prediction appears on this dashboard

## 🎯 Risk Level Indicators

| Risk Level | Color  | Icon | Meaning |
|-----------|--------|------|---------|
| High      | 🔴 Red | 🚨   | Immediate action required - contamination detected |
| Medium    | 🟡 Yellow | ⚠️ | Caution advised - parameters slightly abnormal |
| Low       | 🟢 Green | ✅ | Normal conditions - no outbreak risk |

## 📧 Email Notifications

When a prediction is made:
- ✅ All registered users receive email alerts
- ✅ Email contains risk level, affected locations, and recommendations
- ✅ Notification count shown on dashboard

## 🚀 Quick Actions

### View Predictions
1. Login to dashboard
2. Click "ML Predictions" tab (💡 icon)
3. Browse predictions sorted by most recent

### Filter by Risk
1. Click filter buttons: All / High / Medium / Low
2. View only predictions matching selected risk level

### View Location Details
1. Click "View Details ▼" on any prediction card
2. Scroll through affected locations
3. Click "View on Map →" to see location on Google Maps

### Check Real-time Updates
- Dashboard auto-refreshes every 30 seconds
- Manual refresh: Reload page or switch tabs

## 🔧 Troubleshooting

### No Predictions Showing?
1. **Check sensor data**: Upload sensor readings via CSV Upload tab
2. **Run prediction**: Execute `python predict.py` in ml_model folder
3. **Wait for analysis**: Model runs every 5 minutes if monitor.py is active

### Predictions Not Updating?
1. **Check backend**: Ensure backend2 is running on port 5000
2. **Check browser**: Open Developer Console (F12) for errors
3. **Clear cache**: Hard refresh with Ctrl+F5

### Email Notifications Not Received?
1. **Check SMTP config**: Verify Gmail credentials in backend2/.env
2. **Check user registration**: Ensure users have valid email addresses
3. **Check spam folder**: Email might be in spam

## 📱 Mobile Responsive

The dashboard is fully responsive and works on:
- 💻 Desktop computers
- 📱 Mobile phones
- 📟 Tablets

## 🎓 Best Practices

1. **Monitor Regularly**: Check dashboard daily for new predictions
2. **Act on High Risk**: Immediately investigate high-risk alerts
3. **Review Trends**: Look for patterns in multiple predictions
4. **Verify Locations**: Use Google Maps links to confirm affected areas
5. **Coordinate Response**: Share prediction details with health teams

## 📞 Support

For issues or questions:
- Check console logs (F12 → Console tab)
- Review backend logs in terminal
- Refer to main project documentation

---

**Created**: October 10, 2025  
**Last Updated**: October 10, 2025  
**Version**: 1.0
