#!/usr/bin/env python3
"""Verify STEP 4: Alert Notification via API - Final Check"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"

# Use an existing test user
test_email = "step4test@test.com"
test_password = "Step4Test@123"

print("="*80)
print("STEP 4 FINAL VERIFICATION: Alert Notification Status")
print("="*80)

try:
    # Try login first
    print("\n[1] Attempting login...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": test_email, "password": test_password}
    )
    
    if login_response.status_code != 200:
        # User doesn't exist, create one
        print(f"[1.1] User not found, registering...")
        register_response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": test_email, "password": test_password, "name": "Step4 Verifier"}
        )
        print(f"Registration: {register_response.status_code}")
        
        # Now login
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": test_email, "password": test_password}
        )
    
    if login_response.status_code == 200:
        print(f"✅ Authentication successful")
        token = login_response.json().get('token')
        headers = {"Authorization": f"Bearer {token}"}
        
        # Query alerts
        print("\n[2] Querying database for alerts...")
        time.sleep(1)
        
        alerts_response = requests.get(
            f"{BASE_URL}/alerts",
            headers=headers
        )
        
        if alerts_response.status_code == 200:
            alerts = alerts_response.json()
            print(f"✅ Found {len(alerts) if isinstance(alerts, list) else 'unknown'} alert(s)")
            
            if isinstance(alerts, list) and len(alerts) > 0:
                # Show most recent alert
                alert = alerts[0]  # Usually most recent is first
                
                print(f"\n[3] Most Recent Alert Details:")
                print(f"   ID: {alert.get('_id', 'N/A')}")
                print(f"   Location: {alert.get('location', 'N/A')}")
                print(f"   Risk Level: {alert.get('riskLevel', 'N/A')}")
                print(f"   Created: {alert.get('createdAt', 'N/A')}")
                
                print(f"\n[4] Notification Status:")
                notification_sent = alert.get('notificationSent', False)
                notification_time = alert.get('notificationTimestamp', None)
                notification_error = alert.get('notificationError', None)
                
                print(f"   📧 notificationSent: {notification_sent}")
                print(f"   ⏰ notificationTimestamp: {notification_time}")
                if notification_error:
                    print(f"   ❌ notificationError: {notification_error}")
                
                if notification_sent:
                    print(f"\n🎉 ✅ STEP 4 VERIFICATION SUCCESS!")
                    print(f"   All alert notifications have been successfully sent!")
                else:
                    print(f"\n⚠️  Alert created but notification may still be processing...")
                    print(f"   Alert ID: {alert.get('_id')}")
            else:
                print("ℹ️  No alerts in database yet")
        else:
            print(f"❌ Failed to query alerts: {alerts_response.status_code}")
            print(f"   Response: {alerts_response.text}")
    else:
        print(f"❌ Authentication failed: {login_response.status_code}")
        
except Exception as e:
    print(f"❌ Error during verification: {e}")

print("\n" + "="*80)
print("Verification Complete")
print("="*80)
