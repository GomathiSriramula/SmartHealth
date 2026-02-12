#!/usr/bin/env python3
import requests
import json

API_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("TESTING LOGIN API")
print("=" * 70)

# Test login
print("\n🔑 Testing login with kavya@gmail.com...")
try:
    response = requests.post(f'{API_URL}/auth/login', 
        json={'email': 'kavya@gmail.com', 'password': 'your_password_here'},
        headers={'Content-Type': 'application/json'})
    
    if response.ok:
        data = response.json()
        print(f"✅ Login successful!")
        print(f"   Token: {data.get('token', 'N/A')[:50]}...")
        print(f"   Username: {data.get('username', 'NOT RETURNED')}")
        
        if 'username' in data:
            print(f"\n✅ Username IS being returned: '{data['username']}'")
        else:
            print(f"\n❌ Username NOT being returned - frontend will use email!")
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"❌ Exception: {e}")
    print("\n⚠️  Replace 'your_password_here' with actual password to test")

print("\n" + "=" * 70)
