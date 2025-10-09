@echo off
echo ============================================================
echo SmartHealth ML Model - Quick Start
echo ============================================================
echo.

:menu
echo Choose an option:
echo 1. Test Integration
echo 2. Generate Sample Data
echo 3. Train Model
echo 4. Run One-time Prediction
echo 5. Start Monitoring Service
echo 6. Exit
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    echo.
    echo Running integration tests...
    python test_integration.py
    echo.
    pause
    goto menu
)

if "%choice%"=="2" (
    echo.
    echo Generating sample dataset...
    python generate_sample_data.py
    echo.
    pause
    goto menu
)

if "%choice%"=="3" (
    echo.
    set /p dataset="Enter path to dataset CSV (or press Enter for sample): "
    if "%dataset%"=="" (
        set dataset=data/sample_water_disease_data.csv
    )
    echo Training model with %dataset%...
    python train.py %dataset%
    echo.
    pause
    goto menu
)

if "%choice%"=="4" (
    echo.
    echo Running prediction...
    python predict.py
    echo.
    pause
    goto menu
)

if "%choice%"=="5" (
    echo.
    echo Starting monitoring service...
    echo Press Ctrl+C to stop
    python monitor.py
    pause
    goto menu
)

if "%choice%"=="6" (
    echo.
    echo Goodbye!
    exit /b 0
)

echo Invalid choice. Please try again.
echo.
goto menu
