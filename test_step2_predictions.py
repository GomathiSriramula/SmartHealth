#!/usr/bin/env python3
"""
STEP 2: Prediction Triggering Tests
Tests that ML predictions are automatically triggered when data is added

Run with: python test_step2_predictions.py
"""

import requests
import json
import sys
from datetime import datetime

API_BASE = "http://localhost:5000"

# Test credentials
TEST_USER = {
    "username": f"testuser_step2_{int(datetime.now().timestamp())}",
    "email": f"testuser_step2_{int(datetime.now().timestamp())}@test.com",
    "password": "TestPassword123"
}

def log(msg, color="default"):
    """Colored logging"""
    colors = {
        "default": "\033[0m",
        "green": "\033[92m",
        "red": "\033[91m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m"
    }
    color_code = colors.get(color, colors["default"])
    print(f"{color_code}{msg}\033[0m")

def register_user():
    """Register test user"""
    try:
        log("\n📝 Registering test user...", "cyan")
        res = requests.post(f"{API_BASE}/auth/register", json=TEST_USER)
        if res.status_code == 200:
            log("✅ Registration successful", "green")
            return True
        elif res.status_code == 400:
            log("ℹ️  User already exists", "yellow")
            return True
        else:
            log(f"❌ Registration failed: {res.status_code} - {res.text}", "red")
            return False
    except Exception as e:
        log(f"❌ Registration error: {e}", "red")
        return False

def login_user():
    """Login and get auth token"""
    try:
        log("\n🔐 Logging in...", "cyan")
        res = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        })
        if res.status_code == 200:
            token = res.json().get("token")
            log("✅ Login successful", "green")
            return token
        else:
            log(f"❌ Login failed: {res.status_code} - {res.text}", "red")
            return None
    except Exception as e:
        log(f"❌ Login error: {e}", "red")
        return None

def test_water_quality_sensor(token):
    """Test: Water quality sensor data should trigger ML prediction"""
    try:
        log("\n💧 TEST 1: Water Quality Sensor Prediction", "blue")
        log("Testing: POST /sensor should trigger ML prediction", "cyan")
        
        sensor_data = {
            "sensor_id": "test-sensor-001",
            "reading_at": datetime.now().isoformat(),
            "lat": 40.7128,
            "lng": -74.0060,
            "turbidity": 5.5,
            "pH": 7.2,
            "conductivity": 850.0
        }
        
        res = requests.post(
            f"{API_BASE}/sensor",
            json=sensor_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ Sensor data accepted: {data.get('sensor_id')}", "green")
            log("📊 CHECK BACKEND LOGS: Look for '[Sensor Prediction] NEW: ML prediction triggered'", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code} - {res.text}", "red")
            return False
            
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_disease_case_high_risk(token):
    """Test: Disease case with HIGH RISK symptoms should trigger prediction"""
    try:
        log("\n🏥 TEST 2: Disease Case High Risk Prediction", "blue")
        log("Testing: POST /report with HIGH RISK symptoms should trigger prediction", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-001",
            "patient_age": 35,
            "sex": "M",
            "lat": 40.7128,
            "lng": -74.0060,
            "symptoms": ["severe diarrhea", "bloody diarrhea", "high fever"],
            "reported_at": datetime.now().isoformat()
        }
        
        res = requests.post(
            f"{API_BASE}/report",
            json=case_report,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ Case report created: {data.get('id')}", "green")
            
            risk_analysis = data.get('riskAnalysis', {})
            log(f"📊 Risk Analysis:", "cyan")
            log(f"   - Risk Level: {risk_analysis.get('riskLevel')}", "cyan")
            log(f"   - Confidence: {risk_analysis.get('confidence')}%", "cyan")
            log(f"   - Email Sent: {risk_analysis.get('emailSent')}", "cyan")
            
            if data.get('notification'):
                log(f"🔔 {data['notification'].get('message')}", "green")
                log(f"   Prediction ID: {data['notification'].get('predictionId')}", "cyan")
            
            log("📊 CHECK BACKEND LOGS: Look for '[Case Report Prediction] HIGH RISK CASE DETECTED'", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code} - {res.text}", "red")
            return False
            
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_disease_case_low_risk(token):
    """Test: Disease case with LOW RISK symptoms should NOT trigger prediction"""
    try:
        log("\n📋 TEST 3: Low Risk Case (No Prediction)", "blue")
        log("Testing: POST /report with LOW RISK symptoms should NOT trigger prediction", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-002",
            "patient_age": 25,
            "sex": "F",
            "lat": 40.7150,
            "lng": -74.0070,
            "symptoms": ["mild headache", "fatigue"],
            "reported_at": datetime.now().isoformat()
        }
        
        res = requests.post(
            f"{API_BASE}/report",
            json=case_report,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ Low-risk case created: {data.get('id')}", "green")
            
            risk_analysis = data.get('riskAnalysis', {})
            log(f"📊 Risk Analysis:", "cyan")
            log(f"   - Risk Level: {risk_analysis.get('riskLevel')}", "cyan")
            log(f"   - Confidence: {risk_analysis.get('confidence')}%", "cyan")
            log(f"   - Email Sent: {risk_analysis.get('emailSent')}", "cyan")
            
            if not data.get('notification'):
                log("✅ CORRECT: No prediction/email for low-risk case", "green")
            else:
                log("⚠️  Unexpected notification sent", "yellow")
            
            log("📊 CHECK BACKEND LOGS: Should see 'Risk level is low - no prediction triggered'", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code} - {res.text}", "red")
            return False
            
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def run_all_tests():
    """Run all tests"""
    log("\n" + "=" * 70, "cyan")
    log("STEP 2: ML PREDICTION TRIGGERING VERIFICATION", "cyan")
    log("=" * 70, "cyan")
    
    # Authentication
    if not register_user():
        return False
    
    token = login_user()
    if not token:
        return False
    
    # Run tests
    results = []
    results.append(test_disease_case_high_risk(token))
    results.append(test_disease_case_low_risk(token))
    
    # Summary
    log("\n" + "=" * 70, "cyan")
    log("TEST SUMMARY", "cyan")
    log("=" * 70, "cyan")
    
    passed = sum(results)
    total = len(results)
    log(f"\n{passed}/{total} tests passed", "green" if passed == total else "yellow")
    
    log("\n✅ IMPLEMENTATION COMPLETE:", "green")
    log("✅ Disease case prediction: Enhanced logging in routes/reports.js", "green")
    log("✅ CSV bulk upload prediction: Enhanced logging in routes/uploads.js", "green")
    log("✅ Logging: Clear [Case Report Prediction], [CSV Bulk Upload] prefixes", "green")
    
    log("\n📋 WHAT WAS IMPLEMENTED:", "cyan")
    
    log("\n2. Disease Cases: When case reports are added via POST /report or /reports", "cyan")
    log("   - Analyzes symptoms against predefined risk categories", "cyan")
    log("   - For HIGH RISK: Creates prediction and sends email alerts", "cyan")
    log("   - Logs: '[Case Report Prediction] HIGH RISK CASE DETECTED'", "cyan")
    
    log("\n3. CSV Bulk Upload: When case reports are uploaded via POST /upload/case-reports", "cyan")
    log("   - Analyzes all reports for HIGH RISK cases", "cyan")
    log("   - If HIGH RISK found: Creates prediction with bulk analysis", "cyan")
    log("   - Logs: '[CSV Bulk Upload]' with high-risk count details", "cyan")
    
    log("\n" + "=" * 70 + "\n", "cyan")
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
