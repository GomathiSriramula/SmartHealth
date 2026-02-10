#!/usr/bin/env python3
import requests
import time

BASE_URL = "http://localhost:5000"

print("\n" + "="*70)
print("TESTING REGISTRATION WITH FRESH DATABASE")
print("="*70)

# Generate unique email
timestamp = int(time.time())
test_email = f"newuser{timestamp}@test.com"
test_password = "TestPassword123!"
test_username = f"newuser{timestamp}"

print(f"\n📝 Registering new user:")
print(f"   Email: {test_email}")
print(f"   Username: {test_username}")

try:
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "username": test_username
        },
        timeout=10
    )

    print(f"\n📊 Response Status: {response.status_code}")
    print(f"Response Body: {response.json()}")

    if response.status_code == 200:
        print("\n✅ SUCCESS! Registration worked!")
        print(f"   User ID: {response.json().get('id')}")
        
        # Try login
        print(f"\n🔑 Testing login...")
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": test_email, "password": test_password},
            timeout=10
        )
        
        print(f"   Login Status: {login_response.status_code}")
        if login_response.status_code == 200:
            print(f"   ✅ Login successful! Token: {login_response.json().get('token')[:30]}...")
        else:
            print(f"   ❌ Login failed: {login_response.json()}")
    else:
        print(f"\n❌ Registration failed!")

except requests.exceptions.ConnectionError:
    print("\n❌ Error: Cannot connect to backend at localhost:5000")
    print("   Make sure backend is running: cd backend2 && npm start")
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "="*70 + "\n")
