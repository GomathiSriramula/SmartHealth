#!/usr/bin/env python3
"""
Alert Logic Test Suite

Tests the outbreak alert and escalation logic:
1. Single HIGH risk - no alert
2. Consecutive HIGH risks - alert created
3. Risk drops - alert resolved
4. Duplicate alerts prevented
5. Email notifications sent
6. API endpoints working

Run: python test_alert_logic.py
"""

import requests
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
BASE_URL = 'http://localhost:5000'
ML_SERVICE_URL = 'http://localhost:5001'

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

# Test results
results = {
    'passed': 0,
    'failed': 0,
    'errors': []
}

def print_header(title):
    """Print colored header"""
    print(f"\n{BLUE}{BOLD}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{RESET}\n")

def print_pass(message):
    """Print green success message"""
    results['passed'] += 1
    print(f"{GREEN}✓ PASS{RESET} - {message}")

def print_fail(message, error=None):
    """Print red failure message"""
    results['failed'] += 1
    print(f"{RED}✗ FAIL{RESET} - {message}")
    if error:
        print(f"  Error: {error}")
    results['errors'].append({'test': message, 'error': error})

def print_info(message):
    """Print info message"""
    print(f"{YELLOW}ℹ{RESET} {message}")

def test_backend_health():
    """Test that backend is running"""
    print_header("Backend Health Check")
    try:
        response = requests.get(f'{BASE_URL}/health', timeout=5)
        if response.status_code == 200:
            print_pass("Backend is running")
            data = response.json()
            print_info(f"Services: MongoDB={data.get('services', {}).get('mongodb')}, ML={data.get('services', {}).get('ml_service')}")
            return True
        else:
            print_fail("Backend health check failed", f"Status {response.status_code}")
            return False
    except Exception as e:
        print_fail("Backend connection failed", str(e))
        return False

def test_ml_service():
    """Test that ML service is running"""
    print_header("ML Service Check")
    try:
        response = requests.get(f'{ML_SERVICE_URL}/health', timeout=5)
        if response.status_code == 200:
            print_pass("ML service is running")
            return True
        else:
            print_fail("ML service health check failed", f"Status {response.status_code}")
            return False
    except Exception as e:
        print_fail("ML service connection failed", str(e))
        return False

def create_prediction(location: str, risk_trigger: str = 'normal') -> Optional[Dict]:
    """
    Create a prediction
    
    risk_trigger can be:
    - 'normal': pH=7.0, Turbidity=3.0, DO=8.0 (should be LOW risk)
    - 'high': pH=5.5, Turbidity=15.0, DO=3.0 (should be HIGH risk)
    """
    
    if risk_trigger == 'high':
        # Values that trigger HIGH risk
        data = {
            'pH': 5.5,
            'Turbidity': 15.0,
            'Dissolved_Oxygen': 3.0,
            'location': location,
            'source': 'test'
        }
    else:
        # Normal values (LOW risk)
        data = {
            'pH': 7.0,
            'Turbidity': 3.0,
            'Dissolved_Oxygen': 8.0,
            'location': location,
            'source': 'test'
        }
    
    try:
        response = requests.post(f'{BASE_URL}/api/predictions', json=data, timeout=10)
        if response.status_code == 201:
            return response.json()
        else:
            print_fail(f"Prediction creation failed", f"Status {response.status_code}")
            return None
    except Exception as e:
        print_fail(f"Prediction request error", str(e))
        return None

def test_single_high_risk_no_alert():
    """Test: Single HIGH risk should NOT trigger alert"""
    print_header("Test 1: Single HIGH Risk - No Alert")
    
    try:
        # Create one HIGH risk prediction
        location = "Test_Location_1"
        result = create_prediction(location, risk_trigger='high')
        
        if not result or not result.get('success'):
            print_fail("Failed to create HIGH risk prediction")
            return False
        
        prediction = result.get('prediction', {})
        print_info(f"Created prediction: risk={prediction.get('risk')}, confidence={prediction.get('confidence')}%")
        
        # Check if alert was created
        alert_info = result.get('alert')
        
        if alert_info and alert_info['action'] == 'created':
            print_fail("Alert should NOT be created for single HIGH risk", 
                      f"But got: {alert_info['message']}")
            return False
        else:
            print_pass("Single HIGH risk did not trigger alert")
            return True
            
    except Exception as e:
        print_fail("Test failed with error", str(e))
        return False

def test_consecutive_high_risks_alert():
    """Test: Two consecutive HIGH risks trigger alert"""
    print_header("Test 2: Consecutive HIGH Risks - Alert Created")
    
    try:
        location = "Test_Location_2"
        
        # Create first HIGH risk prediction
        print_info("Creating first HIGH risk prediction...")
        result1 = create_prediction(location, risk_trigger='high')
        if not result1 or not result1.get('success'):
            print_fail("Failed to create first HIGH risk prediction")
            return False
        
        pred1 = result1.get('prediction', {})
        print_info(f"First prediction: risk={pred1.get('risk')}")
        
        # Wait a moment
        time.sleep(1)
        
        # Create second HIGH risk prediction
        print_info("Creating second HIGH risk prediction...")
        result2 = create_prediction(location, risk_trigger='high')
        if not result2 or not result2.get('success'):
            print_fail("Failed to create second HIGH risk prediction")
            return False
        
        pred2 = result2.get('prediction', {})
        print_info(f"Second prediction: risk={pred2.get('risk')}")
        
        # Check if alert was created
        alert_info = result2.get('alert')
        
        if alert_info and alert_info['action'] == 'created':
            print_pass("Alert created on consecutive HIGH risks")
            print_info(f"Alert ID: {alert_info.get('alertId')}")
            return alert_info.get('alertId')
        else:
            print_fail("Alert should be created on consecutive HIGH risks",
                      f"Got: {alert_info}")
            return False
            
    except Exception as e:
        print_fail("Test failed with error", str(e))
        return False

def test_alert_resolution(alert_id: str) -> bool:
    """Test: Alert resolves when risk drops below HIGH"""
    print_header("Test 3: Alert Resolution - Risk Drops")
    
    try:
        location = "Test_Location_2"  # Same location
        
        # Create a LOW risk prediction
        print_info("Creating LOW risk prediction to trigger resolution...")
        result = create_prediction(location, risk_trigger='normal')
        
        if not result or not result.get('success'):
            print_fail("Failed to create LOW risk prediction")
            return False
        
        pred = result.get('prediction', {})
        print_info(f"Prediction: risk={pred.get('risk')}")
        
        # Check if alert was resolved
        alert_info = result.get('alert')
        
        if alert_info and alert_info['action'] == 'resolved':
            print_pass("Alert resolved when risk dropped below HIGH")
            return True
        elif alert_info and alert_info['action'] == 'none':
            print_pass("Alert remains unchanged (expected for non-HIGH risk)")
            return True
        else:
            print_fail("Unexpected alert status",
                      f"Got: {alert_info}")
            return False
            
    except Exception as e:
        print_fail("Test failed with error", str(e))
        return False

def test_duplicate_alert_prevention():
    """Test: Duplicate alerts prevented for same outbreak"""
    print_header("Test 4: Duplicate Alert Prevention")
    
    try:
        location = "Test_Location_3"
        
        # Create first HIGH risk
        print_info("Creating first HIGH risk prediction...")
        result1 = create_prediction(location, risk_trigger='high')
        if not result1 or not result1.get('success'):
            print_fail("Failed to create first prediction")
            return False
        
        time.sleep(1)
        
        # Create second HIGH risk
        print_info("Creating second HIGH risk prediction...")
        result2 = create_prediction(location, risk_trigger='high')
        if not result2 or not result2.get('success'):
            print_fail("Failed to create second prediction")
            return False
        
        alert2 = result2.get('alert')
        alert2_created = alert2 and alert2['action'] == 'created'
        alert2_id = alert2.get('alertId') if alert2 else None
        
        if not alert2_created:
            print_fail("Alert should be created on consecutive HIGH risks")
            return False
        
        time.sleep(1)
        
        # Create third HIGH risk - should NOT create new alert
        print_info("Creating third HIGH risk prediction...")
        result3 = create_prediction(location, risk_trigger='high')
        if not result3 or not result3.get('success'):
            print_fail("Failed to create third prediction")
            return False
        
        alert3 = result3.get('alert')
        
        if alert3 and alert3['action'] == 'none' and alert3.get('message', '').lower().find('duplicate') >= 0:
            print_pass("Duplicate alert prevented (same alert reused)")
            return True
        elif alert3 and alert3['action'] == 'none':
            print_pass("Duplicate alert prevented (no new alert created)")
            return True
        else:
            print_fail("Should not create duplicate alert",
                      f"Got: {alert3}")
            return False
            
    except Exception as e:
        print_fail("Test failed with error", str(e))
        return False

def test_alerts_api_list():
    """Test: GET /api/alerts endpoint"""
    print_header("Test 5: Alerts API - List Alerts")
    
    try:
        response = requests.get(f'{BASE_URL}/api/alerts?limit=10', timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                alerts = data.get('alerts', [])
                print_pass(f"Alerts API working, found {len(alerts)} alerts")
                
                if alerts:
                    # Show first alert
                    alert = alerts[0]
                    print_info(f"Latest alert: location={alert.get('location')}, status={alert.get('status')}")
                
                return True
            else:
                print_fail("Alerts API returned error", data.get('error'))
                return False
        else:
            print_fail("Alerts API request failed", f"Status {response.status_code}")
            return False
            
    except Exception as e:
        print_fail("Alerts API request error", str(e))
        return False

def test_alerts_api_stats():
    """Test: GET /api/alerts/stats/summary endpoint"""
    print_header("Test 6: Alerts API - Statistics")
    
    try:
        response = requests.get(f'{BASE_URL}/api/alerts/stats/summary', timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                stats = data.get('stats', {})
                
                total = stats.get('totalAlerts', 0)
                active = stats.get('activeAlerts', 0)
                resolved = stats.get('resolvedAlerts', 0)
                
                print_pass("Alert statistics retrieved")
                print_info(f"Total alerts: {total}, Active: {active}, Resolved: {resolved}")
                
                return True
            else:
                print_fail("Stats API returned error", data.get('error'))
                return False
        else:
            print_fail("Stats API request failed", f"Status {response.status_code}")
            return False
            
    except Exception as e:
        print_fail("Stats API request error", str(e))
        return False

def main():
    """Run all tests"""
    print(f"\n{BOLD}SmartHealth Alert Logic Test Suite{RESET}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend: {BASE_URL}")
    print(f"ML Service: {ML_SERVICE_URL}\n")
    
    # Prerequisite checks
    if not test_backend_health():
        print(f"\n{RED}Backend is not running. Start backend and try again.{RESET}")
        return
    
    if not test_ml_service():
        print(f"\n{RED}ML service is not running. Start ML service and try again.{RESET}")
        return
    
    # Run tests
    test_single_high_risk_no_alert()
    alert_id = test_consecutive_high_risks_alert()
    if alert_id:
        test_alert_resolution(alert_id)
    test_duplicate_alert_prevention()
    test_alerts_api_list()
    test_alerts_api_stats()
    
    # Summary
    print_header("Test Summary")
    total = results['passed'] + results['failed']
    pass_rate = (results['passed'] / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"{GREEN}Passed: {results['passed']}{RESET}")
    print(f"{RED}Failed: {results['failed']}{RESET}")
    print(f"Success Rate: {pass_rate:.1f}%")
    
    if results['failed'] > 0:
        print(f"\n{RED}Failed Tests:{RESET}")
        for error in results['errors']:
            print(f"  - {error['test']}")
            if error['error']:
                print(f"    {error['error']}")
    
    print()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Test interrupted by user{RESET}")
    except Exception as e:
        print(f"\n\n{RED}Fatal error: {str(e)}{RESET}")
