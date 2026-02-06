@echo off
REM ML Integration Test Script for Windows
REM Run this script to verify the ML backend integration is working

setlocal enabledelayedexpansion

echo ==========================================
echo ML Backend Integration Test Suite
echo ==========================================
echo.

REM Color codes (using echo with special characters)
set PASS=[92mPASS[0m
set FAIL=[91mFAIL[0m

REM Test counter
set TESTS_PASSED=0
set TESTS_FAILED=0

REM Backend URL
set BACKEND_URL=http://localhost:5000

echo Step 1: Checking if backend is running...
curl -s "%BACKEND_URL%/api/ml/health" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [92m✓ Backend is running on port 5000[0m
) else (
    echo [91m✗ Backend is not running[0m
    echo   Please start the backend: cd backend2 ^&^& node index.js
    exit /b 1
)
echo.

echo Step 2: Testing API endpoints...

REM Test 1: Health Check
echo Testing Health Check Endpoint...
for /f "delims=" %%A in ('curl -s "%BACKEND_URL%/api/ml/health"') do (
    set response=%%A
    if "!response!"=="!response:status=!" (
        echo [91m✗ FAIL[0m
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

REM Test 2: Model Info
echo Testing Model Info Endpoint...
for /f "delims=" %%A in ('curl -s "%BACKEND_URL%/api/ml/info"') do (
    set response=%%A
    if "!response!"=="!response:available=!" (
        echo [91m✗ FAIL[0m
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

REM Test 3: Single Prediction
echo Testing Single Prediction...
for /f "delims=" %%A in ('curl -s -X POST "%BACKEND_URL%/api/ml/predict" -H "Content-Type: application/json" -d "{\"pH\": 7.0, \"turbidity\": 5.0, \"dissolved_oxygen\": 6.0}"') do (
    set response=%%A
    if "!response!"=="!response:risk_label=!" (
        echo [91m✗ FAIL[0m
        set /a TESTS_FAILED+=1
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

REM Test 4: Batch Prediction
echo Testing Batch Prediction...
for /f "delims=" %%A in ('curl -s -X POST "%BACKEND_URL%/api/ml/batch" -H "Content-Type: application/json" -d "[{\"pH\": 7.0, \"turbidity\": 5.0, \"dissolved_oxygen\": 6.0}]"') do (
    set response=%%A
    if "!response!"=="!response:predictions=!" (
        echo [91m✗ FAIL[0m
        set /a TESTS_FAILED+=1
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

REM Test 5: Validation
echo Testing Validation Endpoint...
for /f "delims=" %%A in ('curl -s -X POST "%BACKEND_URL%/api/ml/validate" -H "Content-Type: application/json" -d "{\"pH\": 7.0, \"turbidity\": 5.0, \"dissolved_oxygen\": 6.0}"') do (
    set response=%%A
    if "!response!"=="!response:valid=!" (
        echo [91m✗ FAIL[0m
        set /a TESTS_FAILED+=1
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

echo.
echo Step 3: Testing error handling...

REM Test 6: Missing Field
echo Testing Missing Field Error...
for /f "delims=" %%A in ('curl -s -X POST "%BACKEND_URL%/api/ml/predict" -H "Content-Type: application/json" -d "{\"pH\": 7.0, \"turbidity\": 5.0}"') do (
    set response=%%A
    if "!response!"=="!response:MISSING_FIELDS=!" (
        echo [91m✗ FAIL[0m
        set /a TESTS_FAILED+=1
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

REM Test 7: Invalid Value
echo Testing Invalid Value Error...
for /f "delims=" %%A in ('curl -s -X POST "%BACKEND_URL%/api/ml/predict" -H "Content-Type: application/json" -d "{\"pH\": 20.0, \"turbidity\": 5.0, \"dissolved_oxygen\": 6.0}"') do (
    set response=%%A
    if "!response!"=="!response:VALIDATION_ERROR=!" (
        echo [91m✗ FAIL[0m
        set /a TESTS_FAILED+=1
    ) else (
        echo [92m✓ PASS[0m
        set /a TESTS_PASSED+=1
    )
)

echo.
echo ==========================================
echo Test Summary
echo ==========================================
echo Passed: %TESTS_PASSED%
echo Failed: %TESTS_FAILED%
set /a TOTAL=TESTS_PASSED+TESTS_FAILED
echo Total:  %TOTAL%
echo.

if %TESTS_FAILED% equ 0 (
    echo [92m✓ All tests passed![0m
    exit /b 0
) else (
    echo [91m✗ Some tests failed[0m
    exit /b 1
)
