# SmartHealth Mailing Feature

## Overview
This mailing system automatically sends email notifications to all registered users when new ML predictions are made.

## Features
- ✉️ Automated email notifications for new predictions
- 📧 Beautiful HTML email templates
- 🔒 BCC for user privacy
- 🎨 Risk-level color coding (High/Medium/Low)
- 🧪 Development mode with Ethereal test emails
- 📊 Prediction storage and retrieval
- 🔄 Resend notifications for existing predictions

## API Endpoints

### Create Prediction & Notify Users
```
POST /predictions
```

**Request Body:**
```json
{
  "predictionType": "Disease Outbreak",
  "location": "Downtown Area",
  "riskLevel": "high",
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

**Response:**
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
    "message": "Notification sent to 15 users",
    "count": 15
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

### Resend Notification
```
POST /predictions/:id/notify
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

### 2. Create a Prediction
```bash
curl -X POST http://localhost:5000/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "predictionType": "Water Quality Alert",
    "location": "City Center",
    "riskLevel": "high",
    "details": "High turbidity detected in water supply",
    "recommendations": [
      "Use bottled water",
      "Install water filter"
    ],
    "confidence": 92
  }'
```

### 3. Check Console for Email Preview URL
In development mode, you'll see:
```
📧 Preview URL: https://ethereal.email/message/xxxxx
```

### 4. View All Predictions
```bash
curl http://localhost:5000/predictions
```

## Email Template
The system generates professional HTML emails with:
- SmartHealth branding
- Risk level highlighting
- Location and date information
- Detailed predictions
- Actionable recommendations
- Link to dashboard
- Responsive design

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
When your ML model is ready, simply POST to `/predictions` endpoint with the prediction data, and all users will be automatically notified!

```javascript
// In your ML model code
const axios = require('axios');

async function notifyPrediction(mlResult) {
  await axios.post('http://localhost:5000/predictions', {
    predictionType: mlResult.type,
    riskLevel: mlResult.risk,
    details: mlResult.description,
    recommendations: mlResult.recommendations,
    confidence: mlResult.confidence,
    modelVersion: 'v2.0'
  });
}
```

## Troubleshooting

### Emails Not Sending
1. Check `.env` configuration
2. Verify SMTP credentials
3. Check firewall/port access
4. Review console logs for errors

### No Users Receiving Emails
1. Verify users have valid email addresses
2. Check MongoDB for user records: `db.users.find({email: {$exists: true}})`
3. Ensure users registered with the updated registration endpoint

### Email Preview URLs Not Showing
This is normal in production mode. Preview URLs only appear when using Ethereal (development mode).

## Security Notes
- Use environment variables for sensitive data
- Enable 2FA and app passwords for Gmail
- Consider rate limiting for prediction endpoints
- Validate and sanitize all input data
- Use BCC to protect user email privacy
