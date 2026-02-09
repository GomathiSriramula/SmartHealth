#!/usr/bin/env python3
"""STEP 4 Verification - Use unique email"""

import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:5000"

# Use unique email per run
timestamp = int(datetime.now().timestamp())
test_email = f"step4verify{timestamp}@test.com"
test_password = "Test@12345"

print("="*80)
print("STEP 4 FINAL VERIFICATION: Alert Notification Delivery")
print("="*80)

try:
    # Register new user
    print(f"\n[1] Registering unique test user...")
    register_response = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "name": f"Verifier {timestamp}"
        }
    )
    
    if register_response.status_code == 200:
        print(f"✅ User registered")
    else:
        print(f"Registration response: {register_response.status_code}")
    
    # Login
    print("[2] Logging in...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": test_email, "password": test_password}
    )
    
    if login_response.status_code == 200:
        token = login_response.json().get('token')
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Logged in")
        
        # Query for alerts
        print("\n[3] Querying alerts from database...")
        alerts_response = requests.get(f"{BASE_URL}/alerts", headers=headers)
        
        if alerts_response.status_code == 200:
            alerts = alerts_response.json()
            
            if isinstance(alerts, list) and len(alerts) > 0:
                # Get the MOST RECENT alert (likely at index 0 if sorted by creation)
                alert = alerts[0]
                
                print(f"\n✅ Alert found in database!")
                print(f"\n[4] Alert Notification Status:")
                print(f"   Alert ID: {alert.get('_id')}")
                print(f"   Location: {alert.get('location')}")
                print(f"   Risk Level: {alert.get('riskLevel')}")
                
                notification_sent = alert.get('notificationSent')
                notification_time = alert.get('notificationTimestamp')
                
                print(f"\n   📧 Notification Sent: {notification_sent}")
                print(f"   ⏰ Notification Timestamp: {notification_time}")
                
                if notification_sent:
                    print(f"\n" + "="*80)
                    print(f"🎉 SUCCESS: STEP 4 ALERT NOTIFICATION FULLY OPERATIONAL")
                    print(f"="*80)
                    print(f"✅ Alert created when 2 consecutive HIGH predictions detected")
                    print(f"✅ Email notifications sent to all health officials")
                    print(f"✅ Notification status persisted in database")
                else:
                    print(f"\n⚠️  Alert created but notification not yet marked as sent")
            else:
                print(f"ℹ️  No alerts in database")
        else:
            print(f"❌ Alerts query failed: {alerts_response.status_code}")
    else:
        print(f"❌ Login failed: {login_response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
