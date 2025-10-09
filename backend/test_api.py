#!/usr/bin/env python3
"""
Test script to verify the /reports endpoint
This helps debug 422 validation errors
"""
import requests
import json
from datetime import datetime

API_URL = "http://127.0.0.1:8000"
API_KEY = "secret-key"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

# Test 1: Valid request
print("=" * 60)
print("TEST 1: Valid Case Report")
print("=" * 60)

valid_report = {
    "reporter_type": "ASHA",
    "reporter_id": "test-001",
    "patient_age": 35,
    "sex": "F",
    "lat": 17.447,
    "lng": 78.39,
    "symptoms": ["fever", "cough", "headache"],
    "reported_at": datetime.now().isoformat()
}

print("\nSending:")
print(json.dumps(valid_report, indent=2))

try:
    response = requests.post(f"{API_URL}/reports", json=valid_report, headers=headers)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response text: {e.response.text}")

# Test 2: Debug endpoint (see what server receives)
print("\n" + "=" * 60)
print("TEST 2: Debug Endpoint (No validation)")
print("=" * 60)

try:
    response = requests.post(f"{API_URL}/reports/debug", json=valid_report, headers=headers)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Common frontend mistakes
print("\n" + "=" * 60)
print("TEST 3: Common Frontend Format Issues")
print("=" * 60)

# Issue: symptoms as string instead of array
problematic_report = {
    "reporter_type": "ASHA",
    "reporter_id": "test-002",
    "patient_age": 40,
    "sex": "male",  # lowercase
    "lat": 17.447,
    "lng": 78.39,
    "symptoms": "fever, cough",  # string instead of array
    "reported_at": "2025-10-09T12:00:00Z"  # string format
}

print("\nSending (with common issues):")
print(json.dumps(problematic_report, indent=2))

try:
    response = requests.post(f"{API_URL}/reports", json=problematic_report, headers=headers)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response: {e.response.text}")

# Test 4: Invalid data
print("\n" + "=" * 60)
print("TEST 4: Invalid Data (should fail)")
print("=" * 60)

invalid_report = {
    "reporter_type": "ASHA",
    # Missing required fields
    "patient_age": "not a number",
    "sex": "X",  # invalid
}

print("\nSending (invalid):")
print(json.dumps(invalid_report, indent=2))

try:
    response = requests.post(f"{API_URL}/reports", json=invalid_report, headers=headers)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {response.json()}")
except requests.exceptions.HTTPError as e:
    print(f"Expected error: {e}")
    print(f"Response: {e.response.text}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("Tests Complete!")
print("=" * 60)
print("\nIf TEST 1 passes, your API is working correctly.")
print("If TEST 3 passes, your API can handle common frontend format issues.")
print("\nTo fix your frontend, ensure it sends data matching the format in TEST 1.")
