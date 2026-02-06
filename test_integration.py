#!/usr/bin/env python3
"""
SmartHealth End-to-End Integration Test Suite

Tests the full stack:
- ML Pipeline training
- Flask ML Service
- Backend API endpoints
- Database operations
- Alert generation
"""

import requests
import json
import time
import subprocess
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:5001")
TIMEOUT = 5

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name):
        self.passed += 1
        print(f"{GREEN}✓ {test_name}{RESET}")
    
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append((test_name, error))
        print(f"{RED}✗ {test_name}: {error}{RESET}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{BLUE}{'='*50}{RESET}")
        print(f"Tests Run: {total}")
        print(f"{GREEN}Passed: {self.passed}{RESET}")
        print(f"{RED}Failed: {self.failed}{RESET}")
        if self.errors:
            print(f"\n{YELLOW}Failures:{RESET}")
            for test, error in self.errors:
                print(f"  - {test}: {error}")
        print(f"{BLUE}{'='*50}{RESET}\n")
        return self.failed == 0

# Test data
WATER_QUALITY_GOOD = {
    "pH": 7.2,
    "Turbidity": 2.0,
    "Dissolved_Oxygen": 8.5,
    "location": "Test Plant A"
}

WATER_QUALITY_MEDIUM = {
    "pH": 6.5,
    "Turbidity": 8.0,
    "Dissolved_Oxygen": 6.5,
    "location": "Test Plant B"
}

WATER_QUALITY_POOR = {
    "pH": 5.8,
    "Turbidity": 15.0,
    "Dissolved_Oxygen": 3.0,
    "location": "Test Plant C"
}

def print_header(text):
    print(f"\n{BLUE}{text}{RESET}")
    print("=" * len(text))

# ============================================================================
# Service Health Tests
# ============================================================================

def test_ml_service_health(results):
    """Test Flask ML service is running"""
    try:
        response = requests.get(f"{ML_SERVICE_URL}/health", timeout=TIMEOUT)
        if response.status_code == 200:
            results.add_pass("ML Service Health Check")
            return True
        else:
            results.add_fail("ML Service Health Check", f"Status {response.status_code}")
            return False
    except Exception as e:
        results.add_fail("ML Service Health Check", str(e))
        return False

def test_backend_health(results):
    """Test Backend API is running"""
    try:
        response = requests.get(f"{BASE_URL}/ml-predictions", timeout=TIMEOUT)
        if response.status_code in [200, 400]:  # 200 OK or 400 bad request both mean service is up
            results.add_pass("Backend Health Check")
            return True
        else:
            results.add_fail("Backend Health Check", f"Status {response.status_code}")
            return False
    except Exception as e:
        results.add_fail("Backend Health Check", str(e))
        return False

# ============================================================================
# ML Service Tests
# ============================================================================

def test_ml_model_info(results):
    """Test ML service info endpoint"""
    try:
        response = requests.get(f"{ML_SERVICE_URL}/info", timeout=TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if 'model_type' in data and 'features' in data:
                results.add_pass("ML Model Info Endpoint")
                return data
            else:
                results.add_fail("ML Model Info Endpoint", "Missing required fields")
                return None
        else:
            results.add_fail("ML Model Info Endpoint", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("ML Model Info Endpoint", str(e))
        return None

def test_ml_single_prediction(results, water_quality_data):
    """Test ML service single prediction"""
    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/predict",
            json=water_quality_data,
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'risk' in data and 'confidence' in data:
                results.add_pass(f"ML Single Prediction ({water_quality_data.get('location', 'Unknown')})")
                return data
            else:
                results.add_fail("ML Single Prediction", "Missing risk or confidence")
                return None
        else:
            results.add_fail("ML Single Prediction", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("ML Single Prediction", str(e))
        return None

def test_ml_batch_prediction(results):
    """Test ML service batch prediction"""
    try:
        payload = {
            "data": [WATER_QUALITY_GOOD, WATER_QUALITY_MEDIUM, WATER_QUALITY_POOR]
        }
        response = requests.post(
            f"{ML_SERVICE_URL}/predict-batch",
            json=payload,
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'predictions' in data and len(data['predictions']) == 3:
                results.add_pass("ML Batch Prediction (3 samples)")
                return data
            else:
                results.add_fail("ML Batch Prediction", "Incorrect response format")
                return None
        else:
            results.add_fail("ML Batch Prediction", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("ML Batch Prediction", str(e))
        return None

# ============================================================================
# Backend API Tests
# ============================================================================

def test_backend_single_prediction(results, water_quality_data):
    """Test Backend single prediction endpoint"""
    try:
        response = requests.post(
            f"{BASE_URL}/ml-predictions/predict",
            json=water_quality_data,
            timeout=TIMEOUT
        )
        if response.status_code == 201:
            data = response.json()
            if 'prediction' in data and 'id' in data['prediction']:
                results.add_pass(f"Backend Prediction ({water_quality_data.get('location', 'Unknown')})")
                return data['prediction']['id']
            else:
                results.add_fail("Backend Prediction", "Missing prediction id")
                return None
        else:
            results.add_fail("Backend Prediction", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Backend Prediction", str(e))
        return None

def test_get_predictions(results):
    """Test Backend get predictions endpoint"""
    try:
        response = requests.get(
            f"{BASE_URL}/ml-predictions?limit=10&hours=1",
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'predictions' in data:
                results.add_pass(f"Get Predictions (found {len(data['predictions'])})")
                return data['predictions']
            else:
                results.add_fail("Get Predictions", "Missing predictions in response")
                return None
        else:
            results.add_fail("Get Predictions", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Get Predictions", str(e))
        return None

def test_prediction_stats(results):
    """Test Backend prediction statistics endpoint"""
    try:
        response = requests.get(
            f"{BASE_URL}/ml-predictions/stats/summary?hours=24",
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'total' in data and 'byRiskLevel' in data:
                results.add_pass(f"Prediction Stats (total: {data['total']})")
                return data
            else:
                results.add_fail("Prediction Stats", "Missing required fields")
                return None
        else:
            results.add_fail("Prediction Stats", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Prediction Stats", str(e))
        return None

# ============================================================================
# Alert Tests
# ============================================================================

def test_get_alerts(results):
    """Test Backend get alerts endpoint"""
    try:
        response = requests.get(
            f"{BASE_URL}/alerts",
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'alerts' in data:
                results.add_pass(f"Get Alerts (found {len(data['alerts'])})")
                return data['alerts']
            else:
                results.add_fail("Get Alerts", "Missing alerts in response")
                return None
        else:
            results.add_fail("Get Alerts", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Get Alerts", str(e))
        return None

def test_active_alerts(results):
    """Test Backend active alerts endpoint"""
    try:
        response = requests.get(
            f"{BASE_URL}/alerts/active",
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'alerts' in data:
                results.add_pass(f"Active Alerts (found {len(data['alerts'])})")
                return data['alerts']
            else:
                results.add_fail("Active Alerts", "Missing alerts in response")
                return None
        else:
            results.add_fail("Active Alerts", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Active Alerts", str(e))
        return None

def test_alert_stats(results):
    """Test Backend alert statistics endpoint"""
    try:
        response = requests.get(
            f"{BASE_URL}/alerts/stats",
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            if 'activeCount' in data:
                results.add_pass(f"Alert Stats (active: {data.get('activeCount', 0)}, critical: {data.get('criticalCount', 0)})")
                return data
            else:
                results.add_fail("Alert Stats", "Missing activeCount in response")
                return None
        else:
            results.add_fail("Alert Stats", f"Status {response.status_code}")
            return None
    except Exception as e:
        results.add_fail("Alert Stats", str(e))
        return None

# ============================================================================
# End-to-End Workflow Tests
# ============================================================================

def test_prediction_workflow(results):
    """Test complete prediction workflow"""
    print_header("Testing Prediction Workflow")
    
    # Step 1: Make prediction
    pred_id = test_backend_single_prediction(results, WATER_QUALITY_GOOD)
    if not pred_id:
        return False
    
    # Step 2: Retrieve prediction
    try:
        response = requests.get(f"{BASE_URL}/ml-predictions/{pred_id}", timeout=TIMEOUT)
        if response.status_code == 200:
            results.add_pass("Retrieve Specific Prediction")
            return True
        else:
            results.add_fail("Retrieve Specific Prediction", f"Status {response.status_code}")
            return False
    except Exception as e:
        results.add_fail("Retrieve Specific Prediction", str(e))
        return False

def test_consecutive_alerts_workflow(results):
    """Test consecutive HIGH predictions triggering alerts"""
    print_header("Testing Consecutive Alerts Workflow")
    
    # Make 2 predictions with poor water quality (likely HIGH risk)
    test_backend_single_prediction(results, WATER_QUALITY_POOR)
    time.sleep(1)
    test_backend_single_prediction(results, WATER_QUALITY_POOR)
    time.sleep(1)
    
    # Check if alert was created
    alerts = test_active_alerts(results)
    if alerts and any(a.get('severity') in ['high', 'critical'] for a in alerts):
        results.add_pass("Alert Created for Consecutive HIGH Predictions")
        return True
    else:
        results.add_fail("Alert Created for Consecutive HIGH Predictions", "No alert found")
        return False

def test_batch_workflow(results):
    """Test batch prediction workflow"""
    print_header("Testing Batch Prediction Workflow")
    
    try:
        payload = {
            "predictions": [WATER_QUALITY_GOOD, WATER_QUALITY_MEDIUM, WATER_QUALITY_POOR],
            "location": "Batch Test"
        }
        response = requests.post(
            f"{BASE_URL}/ml-predictions/batch",
            json=payload,
            timeout=TIMEOUT
        )
        if response.status_code == 201:
            data = response.json()
            if data.get('summary', {}).get('saved') == 3:
                results.add_pass("Batch Prediction Stored (3 items)")
                return True
            else:
                results.add_fail("Batch Prediction Stored", f"Only {data.get('summary', {}).get('saved')} saved")
                return False
        else:
            results.add_fail("Batch Prediction Stored", f"Status {response.status_code}")
            return False
    except Exception as e:
        results.add_fail("Batch Prediction Stored", str(e))
        return False

# ============================================================================
# Main Test Runner
# ============================================================================

def main():
    print(f"{BLUE}{'='*50}{RESET}")
    print(f"{BLUE}SmartHealth End-to-End Integration Tests{RESET}")
    print(f"{BLUE}Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    print(f"{BLUE}{'='*50}{RESET}\n")
    
    results = TestResults()
    
    # ====================================================================
    # Phase 1: Service Health
    # ====================================================================
    print_header("Phase 1: Service Health Checks")
    ml_healthy = test_ml_service_health(results)
    backend_healthy = test_backend_health(results)
    
    if not (ml_healthy and backend_healthy):
        print(f"\n{RED}Critical services not running. Please start them first.{RESET}")
        results.summary()
        return 1
    
    # ====================================================================
    # Phase 2: ML Service Tests
    # ====================================================================
    print_header("Phase 2: ML Service Tests")
    test_ml_model_info(results)
    test_ml_single_prediction(results, WATER_QUALITY_GOOD)
    test_ml_single_prediction(results, WATER_QUALITY_MEDIUM)
    test_ml_single_prediction(results, WATER_QUALITY_POOR)
    test_ml_batch_prediction(results)
    
    # ====================================================================
    # Phase 3: Backend API Tests
    # ====================================================================
    print_header("Phase 3: Backend API Tests")
    test_backend_single_prediction(results, WATER_QUALITY_GOOD)
    test_backend_single_prediction(results, WATER_QUALITY_MEDIUM)
    test_backend_single_prediction(results, WATER_QUALITY_POOR)
    test_get_predictions(results)
    test_prediction_stats(results)
    
    # ====================================================================
    # Phase 4: Alert Tests
    # ====================================================================
    print_header("Phase 4: Alert Tests")
    test_get_alerts(results)
    test_active_alerts(results)
    test_alert_stats(results)
    
    # ====================================================================
    # Phase 5: End-to-End Workflows
    # ====================================================================
    print_header("Phase 5: End-to-End Workflows")
    test_prediction_workflow(results)
    test_batch_workflow(results)
    test_consecutive_alerts_workflow(results)
    
    # ====================================================================
    # Summary
    # ====================================================================
    success = results.summary()
    
    if success:
        print(f"{GREEN}All tests passed! ✓{RESET}\n")
        return 0
    else:
        print(f"{RED}Some tests failed. See details above.{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
