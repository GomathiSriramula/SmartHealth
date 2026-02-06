#!/usr/bin/env python3
"""
Integration test for ML Service and Backend

Tests:
1. ML service health
2. ML prediction endpoint
3. Backend health
4. Backend API prediction endpoint
5. Database storage
"""

import requests
import json
import sys
import time

ML_SERVICE_URL = "http://localhost:5001"
BACKEND_URL = "http://localhost:5000"

def test_ml_service_health():
    """Test ML service is running"""
    print("\n[1] Testing ML Service Health...")
    try:
        response = requests.get(f"{ML_SERVICE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ ML Service healthy: {data.get('status')}")
            print(f"  ✓ Model loaded: {data.get('model_loaded')}")
            return True
        else:
            print(f"  ✗ Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_ml_prediction():
    """Test ML service prediction"""
    print("\n[2] Testing ML Service Prediction...")
    try:
        data = {
            "pH": 7.2,
            "Turbidity": 5.0,
            "Dissolved_Oxygen": 8.5
        }
        response = requests.post(
            f"{ML_SERVICE_URL}/predict",
            json=data,
            timeout=5
        )
        if response.status_code == 200:
            result = response.json()
            print(f"  ✓ Prediction successful")
            print(f"  ✓ Risk: {result.get('risk')}")
            print(f"  ✓ Confidence: {result.get('confidence'):.1f}%")
            return True
        else:
            print(f"  ✗ Status: {response.status_code}")
            print(f"  {response.text}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_backend_health():
    """Test backend health"""
    print("\n[3] Testing Backend Health...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code in [200, 503]:  # 503 is ok if ML service not available
            data = response.json()
            status = data.get('status')
            print(f"  ✓ Backend responsive: {status}")
            services = data.get('services', {})
            print(f"  ✓ MongoDB: {services.get('mongodb', 'unknown')}")
            print(f"  ✓ ML Service: {services.get('ml_service', 'unknown')}")
            return status == 'healthy'
        else:
            print(f"  ✗ Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_backend_prediction():
    """Test backend API prediction"""
    print("\n[4] Testing Backend Prediction API...")
    try:
        data = {
            "pH": 7.2,
            "Turbidity": 5.0,
            "Dissolved_Oxygen": 8.5,
            "location": "Test Plant"
        }
        response = requests.post(
            f"{BACKEND_URL}/api/predictions",
            json=data,
            timeout=10
        )
        if response.status_code == 201:
            result = response.json()
            pred = result.get('prediction', {})
            print(f"  ✓ Prediction created")
            print(f"  ✓ ID: {pred.get('id')}")
            print(f"  ✓ Risk: {pred.get('risk')}")
            print(f"  ✓ Confidence: {pred.get('confidence'):.1f}%")
            return True
        else:
            print(f"  ✗ Status: {response.status_code}")
            print(f"  {response.text}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_backend_list_predictions():
    """Test backend prediction listing"""
    print("\n[5] Testing Backend List Predictions...")
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/predictions?limit=5",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            returned = data.get('returned', 0)
            print(f"  ✓ Query successful")
            print(f"  ✓ Total predictions: {total}")
            print(f"  ✓ Returned: {returned}")
            return True
        else:
            print(f"  ✗ Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_backend_stats():
    """Test backend statistics"""
    print("\n[6] Testing Backend Statistics...")
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/predictions/stats/summary",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ Stats retrieved")
            print(f"  ✓ Total: {data.get('total', 0)}")
            by_risk = data.get('byRisk', {})
            for risk, stats in by_risk.items():
                print(f"  ✓ {risk}: {stats.get('count')} (avg confidence: {stats.get('avgConfidence')}%)")
            return True
        else:
            print(f"  ✗ Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("ML Service & Backend Integration Test")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("ML Service Health", test_ml_service_health()))
    results.append(("ML Prediction", test_ml_prediction()))
    results.append(("Backend Health", test_backend_health()))
    results.append(("Backend Prediction", test_backend_prediction()))
    results.append(("Backend List", test_backend_list_predictions()))
    results.append(("Backend Stats", test_backend_stats()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {test_name}")

    if passed == total:
        print("\n✓ All tests passed! Integration is working.")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed. Check setup above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
