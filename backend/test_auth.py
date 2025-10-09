"""
Script to test authentication endpoints
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_register():
    """Test user registration"""
    print("\n=== Testing Registration ===")
    data = {
        "email": "demo@smarthealth.com",
        "username": "demouser",
        "password": "demo123",
        "full_name": "Demo User"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=data)
        if response.status_code == 201:
            print("✓ Registration successful!")
            print(json.dumps(response.json(), indent=2))
            return True
        else:
            print(f"✗ Registration failed: {response.status_code}")
            print(response.json())
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_login(username, password):
    """Test user login"""
    print(f"\n=== Testing Login ({username}) ===")
    data = {
        "username": username,
        "password": password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login/json", json=data)
        if response.status_code == 200:
            result = response.json()
            print("✓ Login successful!")
            print(f"  User: {result['user']['username']}")
            print(f"  Email: {result['user']['email']}")
            print(f"  Admin: {result['user']['is_admin']}")
            print(f"  Token: {result['access_token'][:50]}...")
            return result['access_token']
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(response.json())
            return None
    except Exception as e:
        print(f"✗ Error: {e}")
        return None

def test_get_current_user(token):
    """Test getting current user info"""
    print("\n=== Testing Get Current User ===")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if response.status_code == 200:
            print("✓ Got user info!")
            print(json.dumps(response.json(), indent=2))
            return True
        else:
            print(f"✗ Failed: {response.status_code}")
            print(response.json())
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_protected_endpoint_without_token():
    """Test accessing protected endpoint without token"""
    print("\n=== Testing Protected Endpoint (No Token) ===")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me")
        if response.status_code == 401:
            print("✓ Correctly rejected unauthorized request")
            return True
        else:
            print(f"✗ Unexpected response: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("SmartHealth Authentication Testing")
    print("=" * 60)
    
    # Test 1: Register (might fail if user exists)
    print("\n[1/5] Testing user registration...")
    test_register()
    
    # Test 2: Login with test user
    print("\n[2/5] Testing login with testuser...")
    token = test_login("testuser", "test123")
    
    if not token:
        print("\n✗ Cannot continue without valid token")
        return
    
    # Test 3: Get current user
    print("\n[3/5] Testing get current user...")
    test_get_current_user(token)
    
    # Test 4: Login with admin
    print("\n[4/5] Testing login with admin...")
    admin_token = test_login("admin", "admin123")
    
    if admin_token:
        test_get_current_user(admin_token)
    
    # Test 5: Access without token
    print("\n[5/5] Testing unauthorized access...")
    test_protected_endpoint_without_token()
    
    print("\n" + "=" * 60)
    print("✓ Authentication testing complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
