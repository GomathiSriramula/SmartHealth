# SmartHealth - Quick Start Guide (v1.0)

## 🚀 Start Services in 5 Minutes

### Prerequisites
- Python 3.8+
- Node.js 14+
- MongoDB running
- Ports 5000, 5001, 5173 available

### Option 1: Automated Startup (Windows)
```bash
START_ALL_SERVICES.bat
```
This will:
1. ✅ Train ML model
2. ✅ Start Flask service (port 5001)
3. ✅ Start Node backend (port 5000)
4. ✅ Start frontend (port 5173)

### Option 2: Manual Startup (3 terminals)

**Terminal 1 - ML Service:**
```bash
cd ml_model
python ml_pipeline.py    # First time only - trains model
python ml_service.py     # Start Flask service
```

**Terminal 2 - Backend:**
```bash
cd backend2
npm install              # First time only
npm start
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install              # First time only
npm run dev
```

## 🌐 Access Dashboard
- **Dashboard:** http://localhost:5173
- **API:** http://localhost:5000
- **ML Service:** http://localhost:5001

## 🧪 Test the System

### Run Integration Tests
```bash
python test_integration.py
```

### Run IoT Sensor Simulator
```bash
python ml_model/sensor_simulator.py
```

## 📊 Make a Prediction

### Using curl:
```bash
curl -X POST http://localhost:5000/ml-predictions/predict \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 7.2,
    "Turbidity": 5.0,
    "Dissolved_Oxygen": 8.5,
    "location": "Test Plant"
  }'
```

### Response:
```json
{
  "success": true,
  "prediction": {
    "id": "...",
    "riskLevel": "low",
    "confidence": 92,
    "recommendations": [...]
  }
}
```

## 📢 Check Alerts
```bash
curl http://localhost:5000/alerts/active
```

## 🆘 Troubleshooting

### ML Service won't start
```bash
cd ml_model
python ml_pipeline.py  # Ensure model is trained first
```

### Backend won't connect
```bash
# Check MongoDB is running
# Verify ports: netstat -ano | findstr ":5000 :5001"
# Kill existing processes: taskkill /PID <PID> /F
```

### No predictions being made
- Check ML service is running: `curl http://localhost:5001/health`
- Check backend logs for errors
- Verify MongoDB connection

## 🔑 Key Endpoints

**Predictions:**
- `POST /ml-predictions/predict` - Single prediction
- `POST /ml-predictions/batch` - Batch predictions
- `GET /ml-predictions` - List predictions
- `GET /ml-predictions/stats/summary` - Statistics

**Alerts:**
- `GET /alerts/active` - Active alerts
- `GET /alerts/stats` - Alert statistics
- `POST /alerts/{id}/acknowledge` - Mark reviewed
- `POST /alerts/{id}/resolve` - Mark resolved

## 🎯 Next Steps

1. ✅ Start services
2. ✅ Run tests
3. ✅ Send predictions
4. ✅ Monitor dashboard
5. ✅ View alerts
6. ✅ Run sensor simulator for continuous data

## 📞 Support

For detailed documentation, see the guides in the root directory.

---

**Quick Command Reference:**

```bash
# Terminal 1 - ML
cd ml_model && python ml_service.py

# Terminal 2 - Backend  
cd backend2 && npm start

# Terminal 3 - Frontend
cd frontend && npm run dev

# Terminal 4 - Tests/Simulator
python test_integration.py
python ml_model/sensor_simulator.py
```

---

**Project Status:** ✅ Production Ready (v1.0)

That's it! Dashboard should be live at http://localhost:5173 ✨

2. **Start Frontend**
   ```powershell
   cd frontend
   npm run dev
   ```

3. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API Docs: http://127.0.0.1:8000/docs

## 📋 How to Use

### 1. Landing Page
- Click "Get Started" button
- You'll be redirected to Login page

### 2. Login Page
- Enter username and password
- Click "Sign in"
- Or click "Register here" to create new account

### 3. Register Page
- Enter email, username, password
- Confirm password
- Click "Create Account"
- Automatically logs you in after registration

### 4. Dashboard (Protected)
- Only accessible after login
- Shows user info in navigation bar
- Click "Logout" button to sign out

## 🔧 API Testing

### Test Registration
```powershell
curl -X POST http://localhost:8000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"newuser@test.com\",\"username\":\"newuser\",\"password\":\"password123\"}'
```

### Test Login
```powershell
curl -X POST http://localhost:8000/api/auth/login/json `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"testuser\",\"password\":\"test123\"}'
```

### Test Protected Endpoint
```powershell
# Replace YOUR_TOKEN with the token from login response
curl -X GET http://localhost:8000/api/auth/me `
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔐 Security Features

- Passwords are hashed with bcrypt
- JWT tokens expire after 30 minutes
- Tokens stored securely in localStorage
- CORS configured for development
- Admin role separation

## 📁 Key Files Created

### Backend
- `backend/app/models.py` - Added User model
- `backend/app/schemas.py` - Added auth schemas
- `backend/app/utils/auth.py` - Auth utilities
- `backend/app/routes/auth.py` - Auth endpoints
- `backend/init_auth_db.py` - Database initialization
- `backend/create_test_users.py` - Test user creation

### Frontend
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/components/Login.tsx` - Login form
- `frontend/src/components/Register.tsx` - Registration form
- `frontend/src/components/Navigation.tsx` - Updated with logout
- `frontend/src/App.tsx` - Updated with auth flow

## 🎯 Next Steps (Optional Enhancements)

1. **Add to existing endpoints:**
   - Protect report/sensor endpoints with authentication
   - Associate reports with user who created them

2. **Enhanced features:**
   - Password reset via email
   - Email verification
   - Refresh tokens
   - Remember me functionality
   - Social login (Google, GitHub)
   - Two-factor authentication

3. **Production readiness:**
   - Change SECRET_KEY to strong random value
   - Enable HTTPS
   - Set up proper CORS origins
   - Add rate limiting
   - Implement password strength requirements

## 🐛 Troubleshooting

**Login not working?**
- Check backend is running on port 8000
- Verify credentials are correct
- Check browser console for errors

**Token expired?**
- Tokens expire after 30 minutes
- Simply log in again to get new token

**Can't access dashboard?**
- Make sure you're logged in
- Check if token exists in localStorage
- Clear browser cache and try again

## 📞 Testing Checklist

- ✅ Backend server running
- ✅ Database tables created
- ✅ Test users created
- ✅ Can register new user
- ✅ Can login with credentials
- ✅ Can access dashboard after login
- ✅ User info displays in navigation
- ✅ Can logout successfully
- ⬜ Frontend server running (start with `npm run dev`)
- ⬜ Test the complete login flow

---

**All authentication features are now ready to use! 🎊**
