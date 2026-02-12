#!/usr/bin/env python3
"""
Test One-Admin-Per-Village Constraint
Verifies that only one admin can be assigned to each village
"""

import requests
import json
from datetime import datetime

API_BASE = "http://localhost:5000"

def test_duplicate_admin_prevention():
    print("=" * 70)
    print("ONE ADMIN PER VILLAGE CONSTRAINT - TEST")
    print("=" * 70)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Test data for same village
    timestamp = int(datetime.now().timestamp())
    test_village = f"TestVillage{timestamp}"
    test_district = "TestDistrict"
    test_state = "TestState"
    
    admin1 = {
        "username": f"admin1_{timestamp}",
        "email": f"admin1_{timestamp}@test.com",
        "password": "Admin@12345",
        "role": "ADMIN",
        "state": test_state,
        "district": test_district,
        "village": test_village
    }
    
    admin2 = {
        "username": f"admin2_{timestamp}",
        "email": f"admin2_{timestamp}@test.com",
        "password": "Admin@12345",
        "role": "ADMIN",
        "state": test_state,
        "district": test_district,
        "village": test_village  # Same village as admin1
    }
    
    admin3 = {
        "username": f"admin3_{timestamp}",
        "email": f"admin3_{timestamp}@test.com",
        "password": "Admin@12345",
        "role": "ADMIN",
        "state": test_state,
        "district": test_district,
        "village": f"{test_village}Different"  # Different village
    }
    
    # Test 1: Register first admin
    print("📝 TEST 1: Registering first admin for village")
    print(f"   Village: {test_village}")
    print(f"   Username: {admin1['username']}")
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin1)
        if response.status_code == 200:
            print("   ✅ First admin registered successfully\n")
        else:
            print(f"   ❌ Failed: {response.status_code} - {response.json()}\n")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}\n")
        return False
    
    # Test 2: Try to register second admin for SAME village (should FAIL)
    print("📝 TEST 2: Attempting to register SECOND admin for SAME village")
    print(f"   Village: {test_village} (same as admin1)")
    print(f"   Username: {admin2['username']}")
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin2)
        if response.status_code == 409:  # Conflict - expected
            data = response.json()
            print("   ✅ CORRECTLY REJECTED - Village already has an admin")
            print(f"   Error message: {data.get('error', 'No error message')}")
            if 'detail' in data:
                print(f"   Details: {data['detail']}")
            if 'existingAdmin' in data:
                print(f"   Existing admin: {data['existingAdmin']['username']}")
            print()
        else:
            print(f"   ❌ FAIL: Should have been rejected but got status {response.status_code}")
            print(f"   Response: {response.json()}\n")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}\n")
        return False
    
    # Test 3: Register admin for DIFFERENT village (should SUCCEED)
    print("📝 TEST 3: Registering admin for DIFFERENT village")
    print(f"   Village: {admin3['village']} (different from admin1)")
    print(f"   Username: {admin3['username']}")
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin3)
        if response.status_code == 200:
            print("   ✅ Third admin registered successfully (different village)\n")
        else:
            print(f"   ❌ Failed: {response.status_code} - {response.json()}\n")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}\n")
        return False
    
    # Test 4: Test case-insensitive and whitespace handling
    print("📝 TEST 4: Testing case-insensitive duplicate detection")
    print(f"   Village: '{test_village.upper()}  ' (uppercase with spaces)")
    
    admin4 = {
        "username": f"admin4_{timestamp}",
        "email": f"admin4_{timestamp}@test.com",
        "password": "Admin@12345",
        "role": "ADMIN",
        "state": test_state.upper() + "  ",  # Uppercase with trailing spaces
        "district": test_district.upper() + "  ",
        "village": test_village.upper() + "  "  # Same village, different case + spaces
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=admin4)
        if response.status_code == 409:  # Conflict - expected
            print("   ✅ CORRECTLY REJECTED - Case-insensitive check working")
            print(f"   Error: {response.json().get('error', 'No error message')}\n")
        else:
            print(f"   ❌ FAIL: Should have been rejected (case-insensitive)")
            print(f"   Response: {response.json()}\n")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}\n")
        return False
    
    print("=" * 70)
    print("✅ ALL TESTS PASSED")
    print("\nConstraint Verification:")
    print("  ✓ Only ONE admin allowed per village")
    print("  ✓ Case-insensitive village comparison")
    print("  ✓ Whitespace trimming working correctly")
    print("  ✓ Different villages can have different admins")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = test_duplicate_admin_prevention()
    exit(0 if success else 1)
