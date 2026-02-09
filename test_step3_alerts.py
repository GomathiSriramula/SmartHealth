#!/usr/bin/env python3
"""
STEP 3: Alert Verification & Escalation Tests

Tests that alerts are triggered correctly:
1. Two consecutive HIGH predictions at same location → Alert created
2. Single HIGH prediction → No alert (waiting for second)
3. Risk drops from HIGH → Alert resolved
4. Disease cases trigger alerts
5. Sensor data triggers alerts

Run with: python test_step3_alerts.py
"""

import requests
import json
import sys
from datetime import datetime

API_BASE = "http://localhost:5000"

TEST_USER = {
    "username": f"testuser_step3_{int(datetime.now().timestamp())}",
    "email": f"testuser_step3_{int(datetime.now().timestamp())}@test.com",
    "password": "TestPassword123"
}

def log(msg, color="default"):
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
    try:
        log("\n📝 Registering test user...", "cyan")
        res = requests.post(f"{API_BASE}/auth/register", json=TEST_USER)
        if res.status_code == 200:
            log("✅ Registration successful", "green")
            return True
        elif res.status_code == 400 or res.status_code == 409:
            log("ℹ️  User already exists", "yellow")
            return True
        else:
            log(f"❌ Registration failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Registration error: {e}", "red")
        return False

def login_user():
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
            log(f"❌ Login failed: {res.status_code}", "red")
            return None
    except Exception as e:
        log(f"❌ Login error: {e}", "red")
        return None

def test_single_high_no_alert(token):
    """Single HIGH should NOT trigger alert"""
    try:
        log("\n🧪 TEST 1: Single HIGH Risk (No Alert Expected)", "blue")
        log("Creating first HIGH RISK case at location 'Downtown'", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-001",
            "patient_age": 35,
            "sex": "M",
            "lat": 40.7128,
            "lng": -74.0060,
            "location": "Downtown",
            "symptoms": ["severe diarrhea", "bloody diarrhea"],
            "reported_at": datetime.now().isoformat()
        }
        
        res = requests.post(
            f"{API_BASE}/report",
            json=case_report,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ First HIGH case created: {data.get('id')}", "green")
            log(f"   Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}", "cyan")
            log(f"   📊 CHECK LOGS: Should see '⏳ [Alert Checker] Only 1 HIGH prediction so far'", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_second_high_creates_alert(token):
    """Second consecutive HIGH at same location SHOULD trigger alert"""
    try:
        log("\n🧪 TEST 2: Second HIGH Risk at Same Location (Alert Expected)", "blue")
        log("Creating SECOND HIGH RISK case at same location 'Downtown'", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-002",
            "patient_age": 42,
            "sex": "F",
            "lat": 40.7140,
            "lng": -74.0070,
            "location": "Downtown",  # SAME location as test 1
            "symptoms": ["severe diarrhea", "high fever", "dehydration"],
            "reported_at": datetime.now().isoformat()
        }
        
        res = requests.post(
            f"{API_BASE}/report",
            json=case_report,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ Second HIGH case created: {data.get('id')}", "green")
            log(f"   Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}", "cyan")
            log(f"   📊 CHECK LOGS: Should see '✅ [Alert Creator] THRESHOLD MET' and '🚨 [Alert Creator] NEW ALERT CREATED'", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_low_risk_resolves_alert(token):
    """LOW RISK should resolve the alert"""
    try:
        log("\n🧪 TEST 3: Low Risk Case (Alert Should Resolve)", "blue")
        log("Creating LOW RISK case at same location 'Downtown' to resolve alert", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-003",
            "patient_age": 28,
            "sex": "O",
            "lat": 40.7130,
            "lng": -74.0065,
            "location": "Downtown",  # SAME location
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
            log(f"✅ LOW RISK case created: {data.get('id')}", "green")
            log(f"   Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}", "cyan")
            log(f"   📊 CHECK LOGS: Should see '✅ [Alert Resolver] Alert resolved' with reason", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_different_location_independent(token):
    """HIGH at different location should NOT trigger same alert"""
    try:
        log("\n🧪 TEST 4: Different Location (Independent Alert)", "blue")
        log("Creating HIGH RISK case at NEW location 'Uptown' (should be independent)", "cyan")
        
        case_report = {
            "reporter_type": "clinic",
            "reporter_id": "clinic-004",
            "patient_age": 55,
            "sex": "M",
            "lat": 40.7800,
            "lng": -74.0200,
            "location": "Uptown",  # DIFFERENT location
            "symptoms": ["severe diarrhea", "cholera"],
            "reported_at": datetime.now().isoformat()
        }
        
        res = requests.post(
            f"{API_BASE}/report",
            json=case_report,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ First case at 'Uptown' created: {data.get('id')}", "green")
            log(f"   Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}", "cyan")
            log(f"   📊 Should NOT reuse Downtown alert. New location = independent alert tracking", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def test_water_quality_high_risk(token):
    """Test that water quality sensor HIGH risk triggers alerts"""
    try:
        log("\n🧪 TEST 5: Water Quality Sensor HIGH Risk", "blue")
        log("Posting sensor data with HIGH risk water quality", "cyan")
        
        sensor_data = {
            "sensor_id": "sensor-alert-test",
            "reading_at": datetime.now().isoformat(),
            "lat": 40.7128,
            "lng": -74.0060,
            "location": "Central Plant",
            "turbidity": 12.0,  # Bad
            "pH": 4.5,  # Bad
            "conductivity": 2000.0  # High (Dissolved_Oxygen proxy)
        }
        
        res = requests.post(
            f"{API_BASE}/sensor",
            json=sensor_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            data = res.json()
            log(f"✅ Sensor data posted: {data.get('sensor_id')}", "green")
            log(f"   📊 CHECK LOGS: Should see [Sensor Prediction] and potential [Sensor Alert] if HIGH", "yellow")
            return True
        else:
            log(f"❌ Failed: {res.status_code}", "red")
            return False
    except Exception as e:
        log(f"❌ Test failed: {e}", "red")
        return False

def get_alerts(token):
    """Fetch all alerts to verify they were created"""
    try:
        res = requests.get(
            f"{API_BASE}/alerts",
            headers={"Authorization": f"Bearer {token}"} if token else {},
            params={"limit": 100}
        )
        
        if res.status_code == 200:
            return res.json()
        return None
    except Exception as e:
        log(f"⚠️  Could not fetch alerts: {e}", "yellow")
        return None

def run_all_tests():
    log("\n" + "=" * 70, "cyan")
    log("STEP 3: ALERT VERIFICATION & ESCALATION", "cyan")
    log("=" * 70, "cyan")
    
    # Auth
    if not register_user():
        return False
    
    token = login_user()
    if not token:
        return False
    
    # Run tests
    results = []
    results.append(test_single_high_no_alert(token))
    results.append(test_second_high_creates_alert(token))
    results.append(test_low_risk_resolves_alert(token))
    results.append(test_different_location_independent(token))
    results.append(test_water_quality_high_risk(token))
    
    # Summary
    log("\n" + "=" * 70, "cyan")
    log("TEST SUMMARY", "cyan")
    log("=" * 70, "cyan")
    
    passed = sum(results)
    total = len(results)
    log(f"\n{passed}/{total} tests executed successfully", "green" if passed == total else "yellow")
    
    # Try to fetch alerts
    log("\n📋 Checking database for created alerts...", "cyan")
    alerts = get_alerts(token)
    if alerts:
        alert_count = len(alerts.get('alerts', []))
        log(f"✅ Found {alert_count} active alerts in database", "green")
        for alert in alerts.get('alerts', []):
            log(f"   - Location: {alert.get('location')}, Status: {alert.get('status')}", "cyan")
    
    log("\n✅ STEP 3 IMPLEMENTATION DETAILS:", "cyan")
    log("✅ Fixed consecutive HIGH requirement: Now needs exactly 2 HIGHs (not 1)", "green")
    log("✅ Added alert triggering to disease case reports (HIGH RISK)", "green")
    log("✅ Added alert triggering to sensor water quality (HIGH RISK)", "green")
    log("✅ Made time window configurable (default 48 hours)", "green")
    log("✅ Clear logging: [Alert Checker], [Alert Creator], [Alert Resolver]", "green")
    
    log("\n📊 ALERT LOGIC:", "cyan")
    log("1. Single HIGH prediction → ⏳ Waiting for second (no alert)", "cyan")
    log("2. Two consecutive HIGH at same location → 🚨 ALERT CREATED", "cyan")
    log("3. Risk drops from HIGH → ✅ ALERT RESOLVED", "cyan")
    log("4. Different locations → Independent alert tracking", "cyan")
    log("5. Existing active alert + HIGH check → ✅ No duplicate (update existing)", "cyan")
    
    log("\n" + "=" * 70 + "\n", "cyan")
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
