@echo off
REM SmartHealth Full Stack Startup Script for Windows
REM This script starts all services: ML pipeline, Flask service, Node backend, and optionally frontend

setlocal enabledelayedexpansion
set "BASE_DIR=%~dp0"
set "PYTHON_TIMEOUT=30"

echo.
echo ========================================
echo  SmartHealth Full Stack Startup
echo ========================================
echo.
echo Base directory: !BASE_DIR!

REM Kill existing processes on ports if needed
echo.
echo [1/5] Checking for existing processes on required ports...
netstat -ano | findstr ":5000 :5001 :5173" >nul
if not errorlevel 1 (
    echo     Warning: Processes found on ports 5000, 5001, or 5173
    echo     You may need to kill them manually or the startup will fail
    echo.
)

REM Step 1: Train ML Model
echo [2/5] Training ML model...
cd /d "!BASE_DIR!ml_model"
python ml_pipeline.py > ml_training.log 2>&1
if errorlevel 1 (
    echo     ❌ ML training failed. Check ml_model/ml_training.log
    type ml_training.log
    exit /b 1
) else (
    echo     ✅ ML model trained successfully
)

REM Step 2: Start Flask ML Service
echo.
echo [3/5] Starting Flask ML Service on port 5001...
start "SmartHealth Flask ML Service" cmd /k python ml_service.py
timeout /t 3 /nobreak
echo     ✅ Flask service started (check window)

REM Step 3: Start Node.js Backend
echo.
echo [4/5] Starting Node.js Backend on port 5000...
cd /d "!BASE_DIR!backend2"
start "SmartHealth Node Backend" cmd /k npm start
timeout /t 5 /nobreak
echo     ✅ Backend started (check window)

REM Step 4: Start Frontend (Optional)
echo.
echo [5/5] Starting Frontend on port 5173...
cd /d "!BASE_DIR!frontend"
start "SmartHealth Frontend" cmd /k npm run dev
timeout /t 3 /nobreak
echo     ✅ Frontend started (check window)

echo.
echo ========================================
echo  ✅ All services started!
echo ========================================
echo.
echo Services running on:
echo   - Flask ML Service:  http://localhost:5001
echo   - Node.js Backend:   http://localhost:5000
echo   - Frontend UI:       http://localhost:5173
echo.
echo Endpoints:
echo   - ML Predict:        POST http://localhost:5000/ml-predictions/predict
echo   - Alerts:            GET  http://localhost:5000/alerts/active
echo   - Dashboard:         http://localhost:5173
echo.
echo All service windows will stay open. Close them to stop services.
echo.
pause
