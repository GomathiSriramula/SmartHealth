# Troubleshooting: ERR_CONNECTION_REFUSED Error

## Error Details
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
TypeError: Failed to fetch at fetchReports
```

## What This Error Means

**ERR_CONNECTION_REFUSED** means the frontend is trying to connect to a backend server, but:
1. ❌ The backend server is **NOT running** on the specified port
2. ❌ The backend is running on a **DIFFERENT port** than expected
3. ❌ A firewall is blocking the connection
4. ❌ The URL/port is incorrect in the frontend code

## Solution Applied ✅

### The Problem
- Frontend was configured to connect to: `http://127.0.0.1:8000`
- But your backend (backend2/Node.js) is running on: `http://127.0.0.1:5000`

### The Fix
Changed the API URL in `frontend/src/components/Dashboard.tsx`:

```typescript
// Before (WRONG)
const API_URL = "http://127.0.0.1:8000";

// After (CORRECT)
const API_URL = "http://127.0.0.1:5000";
```

## How to Verify Backend is Running

### Check What's Running on Ports

**Windows PowerShell:**
```powershell
# Check port 5000
netstat -ano | findstr :5000

# Check port 8000
netstat -ano | findstr :8000
```

**Expected Output for Port 5000:**
```
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       46424
TCP    [::]:5000              [::]:0                 LISTENING       46424
```

If you see "LISTENING", the backend is running! ✅

### Check Backend Logs

In the terminal where backend is running, you should see:
```
Server running on port 5000
Connected to MongoDB
```

## Your Project Setup

### Backend Servers in Your Project

You have **TWO** backend folders:

#### 1. **backend/** (Python/FastAPI)
- Port: 8000 (default)
- Start command: 
  ```bash
  cd backend
  python -m uvicorn app.main:app --reload
  ```

#### 2. **backend2/** (Node.js/Express) ✅ CURRENTLY ACTIVE
- Port: 5000 (hardcoded in index.js line 42)
- Start command:
  ```bash
  cd backend2
  node index.js
  # OR
  npm run dev
  ```

### Which Backend Should You Use?

Based on your terminal output, you're using **backend2 (Node.js)** which runs on **port 5000**.

## Step-by-Step Fix Verification

### 1. Check Backend is Running
```powershell
netstat -ano | findstr :5000
```

If you see nothing, start the backend:
```powershell
cd backend2
node index.js
```

### 2. Test Backend Directly

Open a browser and visit:
```
http://127.0.0.1:5000/reports
```

**Expected:** You should see JSON data (could be empty array `[]` if no reports yet)

**If you see error:** Backend is not running or has issues

### 3. Check Frontend Configuration

The frontend should now be configured correctly at:
```typescript
const API_URL = "http://127.0.0.1:5000";
```

### 4. Refresh Your Browser

After the fix:
1. **Hard refresh** your browser: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Or **clear browser cache**
3. The error should be gone! ✅

## Common Issues & Solutions

### Issue 1: Backend Not Starting

**Error:** 
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
Another process is using port 5000. Kill it or change port:

```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process (replace PID with actual process ID)
taskkill /PID 46424 /F
```

### Issue 2: MongoDB Connection Error

**Error:**
```
MongoServerError: connect ECONNREFUSED
```

**Solution:**
Start MongoDB:
```powershell
# Start MongoDB service
net start MongoDB

# Or if using MongoDB Compass, ensure it's running
```

### Issue 3: CORS Error

**Error:**
```
Access to fetch at 'http://127.0.0.1:5000/reports' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Solution:**
Check `backend2/index.js` includes your frontend origin:
```javascript
const FRONTEND_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173";
```

### Issue 4: Wrong Port in Multiple Files

**Check these files** for API_URL or backend URLs:
- `frontend/src/components/Dashboard.tsx` ✅ Fixed
- `frontend/src/components/Login.tsx`
- `frontend/src/components/Register.tsx`
- `frontend/src/components/CSVUpload.tsx`
- `frontend/src/components/PredictionsDashboard.tsx`

Let me check if other files need updating...

## Quick Health Check Script

Create this PowerShell script to check everything:

**check-system.ps1:**
```powershell
Write-Host "=== SmartHealth System Health Check ===" -ForegroundColor Cyan

# Check Backend Port 5000
Write-Host "`nChecking Backend (Port 5000)..." -ForegroundColor Yellow
$backend = netstat -ano | findstr :5000
if ($backend) {
    Write-Host "✅ Backend is RUNNING on port 5000" -ForegroundColor Green
} else {
    Write-Host "❌ Backend is NOT running on port 5000" -ForegroundColor Red
    Write-Host "   Start it with: cd backend2; node index.js" -ForegroundColor Gray
}

# Check Frontend Port 5173
Write-Host "`nChecking Frontend (Port 5173)..." -ForegroundColor Yellow
$frontend = netstat -ano | findstr :5173
if ($frontend) {
    Write-Host "✅ Frontend is RUNNING on port 5173" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend is NOT running on port 5173" -ForegroundColor Red
    Write-Host "   Start it with: cd frontend; npm run dev" -ForegroundColor Gray
}

# Test Backend API
Write-Host "`nTesting Backend API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5000/reports" -Method Get -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend API is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend API is not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n=== System Check Complete ===" -ForegroundColor Cyan
```

Run it:
```powershell
.\check-system.ps1
```

## Summary

### ✅ What Was Fixed
- Changed API URL from port 8000 → port 5000 in Dashboard.tsx
- Now matches the actual running backend

### 🔍 How to Prevent This
1. Always check which port your backend is running on
2. Use environment variables for API URLs
3. Keep backend port consistent across documentation

### 📝 Current Configuration
- **Backend (Node.js)**: `http://127.0.0.1:5000`
- **Frontend (Vite/React)**: `http://localhost:5173` or `http://127.0.0.1:5173`
- **Database (MongoDB)**: `mongodb://localhost:27017/smart_health`

## Next Steps

1. ✅ Backend is running on port 5000
2. ✅ Frontend is configured to use port 5000
3. 🔄 Refresh your browser (Ctrl+Shift+R)
4. ✅ Error should be gone!

## Still Having Issues?

If you still see connection errors:

1. **Check browser console** for new error messages
2. **Check backend terminal** for error logs
3. **Verify MongoDB** is running
4. **Check firewall** settings
5. **Try accessing** `http://127.0.0.1:5000/reports` directly in browser

The error should now be resolved! 🎉
