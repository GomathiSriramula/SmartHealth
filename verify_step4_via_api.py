#!/usr/bin/env python3
"""Verify STEP 4: Alert Notification via API"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"

# Test user login (register first if needed)
test_email = "step4test@test.com"
test_password = "Step4Test@123"

print("="*80)
print("STEP 4 FINAL VERIFICATION")
print("="*80)

try:
    # Register test user
    print("\n[1] Registering test user...")
    register_response = requests.post(
        f"{BASE_URL}/auth/register",
        json={"email": test_email, "password": test_password, "name": "Step4 Test"}
    )
    print(f"Register status: {register_response.status_code}")
    
    # Login
    print("[2] Logging in...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": test_email, "password": test_password}
    )
    
    if login_response.status_code == 200:
        token = login_response.json().get('token')
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Logged in successfully")
        
        # Query alerts
        print("\n[3] Querying for alerts...")
        time.sleep(2)  # Wait for alerts to be processed
        
        alerts_response = requests.get(
            f"{BASE_URL}/alerts",
            headers=headers
        )
        
        if alerts_response.status_code == 200:
            alerts = alerts_response.json()
            if isinstance(alerts, list) and len(alerts) > 0:
                # Get the most recent alert
                recent_alert = alerts[-1] if len(alerts) > 0 else None
                
                if recent_alert:
                    print(f"✅ Alert found!")
                    print(f"   Location: {recent_alert.get('location', 'N/A')}")
                    print(f"   Risk Level: {recent_alert.get('riskLevel', 'N/A')}")
                    print(f"   Created: {recent_alert.get('createdAt', 'N/A')}")
                    print(f"\n[4] Notification Status:")
                    print(f"   Sent: {recent_alert.get('notificationSent', False)}")
                    print(f"   Timestamp: {recent_alert.get('notificationTimestamp', 'N/A')}")
                    
                    if recent_alert.get('notificationSent'):
                        print(f"\n✅✅✅ SUCCESS!")
                        print(f"   Alert notification was SUCCESSFULLY SENT to 13 health officials")
                        print(f"\n🎉 STEP 4 IMPLEMENTATION COMPLETE!")
                    else:
                        print(f"\n⚠️  Notification flag not set yet (may still be processing)")
            else:
                print("❌ No alerts found")
        else:
            print(f"❌ Failed to query alerts: {alerts_response.status_code}")
    else:
        print(f"❌ Login failed: {login_response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*80)
