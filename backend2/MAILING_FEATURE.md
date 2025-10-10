# SmartHealth Mailing Feature

## 🚨 Overview
This mailing system **automatically sends URGENT email notifications ONLY for HIGH RISK predictions** detected by the ML model. This ensures health officials receive immediate alerts for critical situations while avoiding notification fatigue from lower-risk predictions.

## ✨ Key Features

### 🎯 Smart Alert Filtering (v2.0)
- **HIGH RISK ONLY**: Emails are sent ONLY when `riskLevel: "high"` is detected
- **Automatic Filtering**: Low and Medium risk predictions are stored but don't trigger emails
- **Force Override**: Optional `forceNotify` parameter bypasses filtering for testing
- **Intelligent Logging**: All predictions are logged with clear indicators of notification status

### � Reliability & Resilience
- **3-Attempt Retry**: Automatic retry with exponential backoff (2s, 4s, 8s delays)
- **Error Recovery**: Graceful handling of SMTP failures with detailed logging
- **Connection Pooling**: Efficient transporter reuse across multiple emails
- **Detailed Tracking**: Each attempt is logged with timestamps and error details

### 📧 Enhanced Email Templates
- **URGENT Styling**: High-risk emails feature prominent red borders, urgent banners, and larger fonts
- **Risk-Level Color Coding**: Red (#dc2626) for high, Amber (#f59e0b) for medium, Green (#10b981) for low
- **Time-Sensitive Notices**: Clear "IMMEDIATE ATTENTION REQUIRED" messaging
- **Comprehensive Details**: Includes confidence scores, model versions, timestamps, and recommendations
- **Responsive Design**: Mobile-friendly HTML that renders beautifully on all devices
- **Professional Branding**: Consistent SmartHealth styling with emojis and clear hierarchy

### � Privacy & Security
- **BCC Protection**: All recipients receive emails via BCC to protect privacy
- **Environment Variables**: Sensitive SMTP credentials stored securely in `.env`
- **Input Validation**: Sanitized prediction data before email generation
- **Rate Limiting Ready**: Compatible with rate limiting middleware

## API Endpoints

### Create Prediction & Auto-Notify (HIGH RISK Only)
```
POST /predictions
```

**Behavior:**
- ✅ HIGH risk predictions: Email sent to all users
- ⚠️ MEDIUM/LOW risk predictions: Stored but NO email sent
- 📝 All predictions are saved to database regardless of risk level

**Request Body:**
```json
{
  "predictionType": "Disease Outbreak",
  "location": "Downtown Area",
  "riskLevel": "high",  // ⚠️ Must be "high" to trigger email
  "details": "Predicted cholera outbreak based on water quality data",
  "recommendations": [
    "Boil water before drinking",
    "Seek medical attention if symptoms appear"
  ],
  "lat": 40.7128,
  "lng": -74.0060,
  "modelVersion": "v1.0",
  "confidence": 85
}
```

**Response (HIGH RISK):**
```json
{
  "message": "Prediction created and notifications sent",
  "prediction": {
    "id": "507f1f77bcf86cd799439011",
    "predictionType": "Disease Outbreak",
    "riskLevel": "high",
    "location": "Downtown Area",
    "predictedDate": "2025-10-09T10:30:00.000Z"
  },
  "notification": {
    "success": true,
    "message": "High risk notification sent to 15 users",
    "count": 15
  }
}
```

**Response (MEDIUM/LOW RISK):**
```json
{
  "message": "Prediction created successfully",
  "prediction": {
    "id": "507f1f77bcf86cd799439012",
    "riskLevel": "medium"
  },
  "notification": {
    "success": true,
    "message": "Notification skipped - not high risk",
    "count": 0
  }
}
```

### Get All Predictions
```
GET /predictions?riskLevel=high&limit=50&skip=0&sort=newest
```

### Get Specific Prediction
```
GET /predictions/:id
```

### Resend Notification (Force Override)
```
POST /predictions/:id/notify
```

**Purpose:** Manually resend notification for ANY risk level (bypasses HIGH RISK filter)

**Use Cases:**
- Testing email system with existing predictions
- Resending failed notifications
- Administrative override for important updates

**Response:**
```json
{
  "message": "Notification sent successfully",
  "result": {
    "success": true,
    "message": "High risk notification sent to 15 users",
    "count": 15
  }
}
```

### Delete Prediction
```
DELETE /predictions/:id
```

## Email Configuration

### Development Mode
By default, the system uses Ethereal (ethereal.email) for testing. No configuration needed - emails won't be sent to real addresses but you'll get preview URLs in the console.

### Production Mode
Configure SMTP settings in `.env`:

**Gmail Example:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@smarthealth.com
SMTP_FROM_NAME=SmartHealth System
```

**SendGrid Example:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## User Registration
Email is now required during registration:

```
POST /auth/register
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "secure_password",
  "email": "john@example.com"
}
```

## Testing

### 1. Register Users with Emails
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser1",
    "password": "password123",
    "email": "testuser1@example.com"
  }'
```

### 2. Test HIGH RISK Prediction (Will Send Email)
```bash
curl -X POST http://localhost:5000/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "predictionType": "Water Quality Alert",
    "location": "City Center",
    "riskLevel": "high",
    "details": "URGENT: High turbidity and bacterial contamination detected",
    "recommendations": [
      "DO NOT drink tap water",
      "Use bottled water immediately",
      "Seek medical attention if experiencing symptoms"
    ],
    "confidence": 92
  }'
```

**Expected Console Output:**
```
🚨 HIGH RISK ALERT: Sending urgent email notification...
📧 Attempt 1/3: Sending to 5 users...
✅ Email sent successfully to 5 users
📧 Preview URL: https://ethereal.email/message/xxxxx
```

### 3. Test MEDIUM RISK Prediction (Will NOT Send Email)
```bash
curl -X POST http://localhost:5000/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "predictionType": "Water Quality Alert",
    "location": "Suburb Area",
    "riskLevel": "medium",
    "details": "Moderate turbidity detected",
    "recommendations": ["Monitor water quality"],
    "confidence": 75
  }'
```

**Expected Console Output:**
```
⚠️  Prediction risk level is 'medium' - skipping email notification
✅ Prediction saved but no email sent
```

### 4. Force Notification for Any Risk Level
```bash
# First, get the prediction ID from step 3
curl -X POST http://localhost:5000/predictions/PREDICTION_ID/notify
```

### 5. Check Console for Email Preview URL
In development mode (Ethereal), you'll see:
```
📧 Preview URL: https://ethereal.email/message/xxxxx
```
Click the URL to view the styled email in your browser.

### 6. View All Predictions
```bash
curl http://localhost:5000/predictions
```

### 7. Test Retry Mechanism
To simulate email failures and test retry logic:
1. Temporarily set invalid SMTP credentials in `.env`
2. Create a HIGH RISK prediction
3. Watch console logs for retry attempts:
```
📧 Attempt 1/3: Sending to 5 users...
❌ Attempt 1 failed: Connection refused
⏳ Waiting 2000ms before retry...
📧 Attempt 2/3: Sending to 5 users...
❌ Attempt 2 failed: Connection refused
⏳ Waiting 4000ms before retry...
📧 Attempt 3/3: Sending to 5 users...
❌ All retry attempts exhausted
```

## Email Template Features

The system generates **professional, urgent HTML emails** for HIGH RISK predictions with:

### 🚨 High-Risk Specific Elements
- **3px Red Border**: Entire email has prominent border for HIGH risk
- **Dual Headers**: "🚨 URGENT ALERT 🚨" banner + "🏥 SmartHealth Alert" heading
- **Urgent Banner**: Red background strip with "⚠️ IMMEDIATE ATTENTION REQUIRED ⚠️"
- **Enlarged Text**: 28px risk level text with uppercase styling and letter spacing
- **Shadow Effects**: Box shadows on risk level card for HIGH risk alerts
- **Time-Sensitive Notice**: Orange warning box explaining urgency
- **Larger CTA Button**: 18px font, 16px padding on "🔍 View Alert Details" button

### 📊 All Risk Levels
- **Risk Level Color Coding**: Red (high), Amber (medium), Green (low)
- **SmartHealth Branding**: Professional blue header with logo emoji
- **Comprehensive Details Table**: Location, date, confidence, model version
- **Formatted Dates**: Human-readable format (e.g., "Monday, January 9, 2025 at 10:30 AM")
- **Recommendations Section**: Bulleted list with bold text for HIGH risk
- **Details Card**: Gray background section with full prediction description
- **Call-to-Action**: Direct link to predictions dashboard
- **Responsive Design**: Mobile-friendly HTML (600px max width)
- **Professional Footer**: Copyright, timestamp, system info

### 📱 Mobile Optimization
- Responsive table layout
- Scalable fonts
- Touch-friendly button sizes
- Proper email client compatibility

## Database Schema

### Prediction Model
```javascript
{
  predictionType: String (required),
  location: String,
  riskLevel: String (low/medium/high, required),
  predictedDate: Date (default: now),
  details: String (required),
  recommendations: [String],
  modelVersion: String,
  confidence: Number (0-100),
  lat: Number,
  lng: Number,
  created_at: Date,
  updated_at: Date
}
```

### Updated User Model
```javascript
{
  username: String (required, unique),
  email: String (required, unique),  // Now required!
  passwordHash: String (required),
  created_at: Date
}
```

## Files Created/Modified

### New Files:
- `utils/mailer.js` - Email service and templates
- `routes/predictions.js` - Prediction endpoints

### Modified Files:
- `index.js` - Added predictions router
- `models.js` - Made email required in User schema
- `routes/auth.js` - Added email validation in registration
- `.env` - Added SMTP configuration options

## Future ML Integration
When your ML model is ready, simply POST to `/predictions` endpoint. **Only HIGH RISK predictions will trigger emails automatically!**

```javascript
// In your ML model code (e.g., ml_model/predict.py or monitor.py)
const axios = require('axios');

async function notifyPrediction(mlResult) {
  const prediction = await axios.post('http://localhost:5000/predictions', {
    predictionType: mlResult.type,
    riskLevel: mlResult.risk,  // ⚠️ Must be "high" for email notification
    details: mlResult.description,
    recommendations: mlResult.recommendations,
    confidence: mlResult.confidence,
    modelVersion: 'v2.0',
    location: mlResult.location || 'Unknown',
    lat: mlResult.latitude,
    lng: mlResult.longitude
  });
  
  console.log(`✅ Prediction saved. Email sent: ${prediction.data.notification.count > 0}`);
}

// Example usage with different risk levels
notifyPrediction({
  type: "Cholera Outbreak",
  risk: "high",  // ✅ Will send email
  description: "Critical contamination detected",
  recommendations: ["Boil water", "Seek medical help"],
  confidence: 95,
  location: "District A"
});

notifyPrediction({
  type: "Minor Quality Issue",
  risk: "low",  // ❌ Will NOT send email (stored only)
  description: "Slight turbidity increase",
  recommendations: ["Monitor situation"],
  confidence: 60,
  location: "District B"
});
```

### Python Integration Example
```python
# ml_model/predict.py or monitor.py
import requests

def send_prediction(ml_result):
    """Send ML prediction to backend - emails sent ONLY for HIGH RISK"""
    url = "http://localhost:5000/predictions"
    
    payload = {
        "predictionType": ml_result["type"],
        "riskLevel": ml_result["risk_level"],  # "high", "medium", or "low"
        "details": ml_result["description"],
        "recommendations": ml_result["recommendations"],
        "confidence": ml_result["confidence"],
        "location": ml_result.get("location", "Unknown"),
        "lat": ml_result.get("latitude"),
        "lng": ml_result.get("longitude"),
        "modelVersion": "v2.0"
    }
    
    response = requests.post(url, json=payload)
    result = response.json()
    
    # Check if email was sent
    if result["notification"]["count"] > 0:
        print(f"🚨 HIGH RISK: Email sent to {result['notification']['count']} users")
    else:
        print(f"📝 Prediction saved (Risk: {ml_result['risk_level']}, No email)")
    
    return result

# Usage
prediction_result = {
    "type": "Disease Outbreak",
    "risk_level": "high",  # ⚠️ Triggers email
    "description": "Urgent: High bacterial contamination detected",
    "recommendations": [
        "Boil water before consumption",
        "Avoid tap water for drinking"
    ],
    "confidence": 92,
    "location": "City Center",
    "latitude": 40.7128,
    "longitude": -74.0060
}

send_prediction(prediction_result)
```

## Troubleshooting

### ❌ Emails Not Sending for HIGH RISK Predictions

**Check 1: Verify Risk Level**
```javascript
// Risk level must be EXACTLY "high" (case-insensitive)
{ riskLevel: "high" }     // ✅ Will send
{ riskLevel: "High" }     // ✅ Will send
{ riskLevel: "HIGH" }     // ✅ Will send
{ riskLevel: "medium" }   // ❌ Won't send
{ riskLevel: "urgent" }   // ❌ Won't send (must be "high")
```

**Check 2: Verify SMTP Configuration**
```bash
# Check .env file has correct settings
cat backend2/.env | grep SMTP
```

**Check 3: Check Console Logs**
Look for these messages:
- ✅ `🚨 HIGH RISK ALERT: Sending urgent email notification...`
- ❌ `⚠️ Prediction risk level is 'X' - skipping email notification`
- ❌ `❌ Attempt X failed: [error message]`

**Check 4: Test SMTP Connection**
```bash
# Run test script
node backend2/test_mailing.js
```

### 📧 No Users Receiving Emails

**Check 1: Verify Users Have Emails**
```javascript
// In MongoDB shell or via API
db.users.find({email: {$exists: true, $ne: ""}}).count()
```

**Check 2: Check User Registration**
```bash
# Ensure users registered with email
curl http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"pass","email":"test@example.com"}'
```

### 🔄 Emails Not Retrying on Failure

**Check 1: Verify Retry Logic**
- Look for `📧 Attempt X/3` in console logs
- Check for `⏳ Waiting Xms before retry...` messages
- Verify `❌ All retry attempts exhausted` appears after 3 attempts

**Check 2: Test Retry Mechanism**
```bash
# Temporarily set invalid SMTP credentials and create HIGH RISK prediction
# Watch for exponential backoff: 2s, 4s, 8s delays
```

### 🚫 Emails Sent for LOW/MEDIUM Risk

**This should NOT happen!** Check for:
- Custom `forceNotify: true` parameter being passed
- Modified `notifyUsersOfPrediction()` function
- Manual `/predictions/:id/notify` endpoint calls

### 📱 Email Preview URLs Not Showing

**In Development (Ethereal):**
- ✅ Preview URLs appear in console: `📧 Preview URL: https://ethereal.email/message/xxxxx`
- Click URL to view email in browser

**In Production (Real SMTP):**
- ❌ No preview URLs (normal behavior)
- Emails sent to actual recipient addresses
- Check user inboxes or email logs

### 🔥 Common Fixes

**Fix 1: Reset Email Configuration**
```bash
# backend2/.env
SMTP_HOST=smtp.ethereal.email  # Use Ethereal for testing
SMTP_PORT=587
SMTP_SECURE=false
# Remove or comment out SMTP_USER and SMTP_PASS for auto Ethereal
```

**Fix 2: Restart Backend**
```bash
cd backend2
npm start
```

**Fix 3: Clear Node Cache**
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

**Fix 4: Check Firewall/Ports**
```bash
# Windows PowerShell
Test-NetConnection -ComputerName smtp.ethereal.email -Port 587

# Ensure port 587 is open for SMTP
```

## Security Notes
- Use environment variables for sensitive data
- Enable 2FA and app passwords for Gmail
- Consider rate limiting for prediction endpoints
- Validate and sanitize all input data
- Use BCC to protect user email privacy
