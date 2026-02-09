#!/usr/bin/env python3
import requests
import json

API_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("TESTING REGISTRATION")
print("=" * 70)

# Test 1: Check if backend is running
print("\n[1] Checking if backend is running...")
try:
    response = requests.get(f'{API_URL}/health', timeout=5)
    print(f"✅ Backend is running (status: {response.status_code})")
except Exception as e:
    print(f"❌ Backend is NOT running: {e}")
    print("   Run: cd d:\\SmartHealthFullProject\\backend2 && npm start")
    exit(1)

# Test 2: Try registration with test data
print("\n[2] Testing registration with unique username...")
import time
unique_username = f"testuser_{int(time.time())}"
test_data = {
    "username": unique_username,
    "password": "TestPassword123!",
    "email": f"{unique_username}@test.com"
}

print(f"   Registering: {test_data}")
try:
    response = requests.post(f'{API_URL}/auth/register', json=test_data, timeout=5)
    print(f"\n   Status: {response.status_code}")
    result = response.json()
    print(f"   Response: {json.dumps(result, indent=2)}")
    
    if response.ok:
        print(f"\n✅ Registration SUCCESSFUL!")
        print(f"   User ID: {result.get('id')}")
    else:
        print(f"\n❌ Registration FAILED!")
        print(f"   Error: {result.get('error')}")
        
except Exception as e:
    print(f"❌ Error during registration test: {e}")

print("\n" + "=" * 70)
