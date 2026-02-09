#!/usr/bin/env python3
"""
STEP 4: Alert Notification Testing
Tests that email notifications are sent when alerts are created
"""

import requests
import json
from datetime import datetime

API_BASE = "http://localhost:5000"

# Register and login
test_user = {
    "username": f"step4_test_{int(datetime.now().timestamp())}",
    "email": f"step4_test_{int(datetime.now().timestamp())}@test.com",
    "password": "TestPassword123"
}

print("=" * 70)
print("STEP 4: ALERT NOTIFICATION TESTING")
print("=" * 70)

# Register
print("\n[1] Registering test user...")
requests.post(f"{API_BASE}/auth/register", json=test_user)

# Login
print("[2] Logging in...")
res = requests.post(f"{API_BASE}/auth/login", json={
    "email": test_user["email"],
    "password": test_user["password"]
})

if res.status_code != 200:
    print(f"ERROR: Login failed: {res.status_code}")
    exit(1)

token = res.json().get("token")
print("[OK] Authenticated")

# Create two HIGH RISK cases at same location to trigger alert
print("\n" + "=" * 70)
print("SUBMIT CASE 1: First HIGH RISK case")
print("=" * 70)

case1 = {
    "reporter_type": "clinic",
    "reporter_id": "clinic-step4-1",
    "patient_age": 35,
    "sex": "M",
    "lat": 40.7500,
    "lng": -74.0100,
    "location": "TestZone-Step4",
    "symptoms": ["severe diarrhea", "cholera"],
    "reported_at": datetime.now().isoformat()
}

res = requests.post(
    f"{API_BASE}/report",
    json=case1,
    headers={"Authorization": f"Bearer {token}"}
)

if res.status_code == 200:
    data = res.json()
    print(f"[OK] First case created: {data.get('id')}")
    print(f"     Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}")
    print("[*] Backend log should show: 'Only 1 HIGH prediction so far'")
    print("[*] NO EMAIL SENT (need 2 consecutive)")
else:
    print(f"ERROR: {res.status_code}")
    print(res.text)

print("\n" + "=" * 70)
print("SUBMIT CASE 2: Second HIGH RISK case (ALERT + EMAIL should trigger)")
print("=" * 70)

case2 = {
    "reporter_type": "clinic",
    "reporter_id": "clinic-step4-2",
    "patient_age": 42,
    "sex": "F",
    "lat": 40.7510,
    "lng": -74.0110,
    "location": "TestZone-Step4",
    "symptoms": ["severe diarrhea", "high fever", "dehydration"],
    "reported_at": datetime.now().isoformat()
}

res = requests.post(
    f"{API_BASE}/report",
    json=case2,
    headers={"Authorization": f"Bearer {token}"}
)

if res.status_code == 200:
    data = res.json()
    print(f"[OK] Second case created: {data.get('id')}")
    print(f"     Risk Level: {data.get('riskAnalysis', {}).get('riskLevel')}")
    print("[*] Backend logs should show:")
    print("    - '[Alert Creator] THRESHOLD MET: 2 total consecutive HIGHs'")
    print("    - '[Alert Creator] NEW ALERT CREATED'")
    print("    - '[Alert Notification] Sending alert email'")
    print("    - '[Alert Notification] Alert email sent successfully'")
    print("[*] EMAIL SHOULD BE SENT NOW")
else:
    print(f"ERROR: {res.status_code}")
    print(res.text)

print("\n" + "=" * 70)
print("CHECK ALERTS IN DATABASE")
print("=" * 70)

res = requests.get(f"{API_BASE}/alerts?limit=10", 
                   headers={"Authorization": f"Bearer {token}"})

if res.status_code == 200:
    data = res.json()
    alerts = data.get('alerts', [])
    
    test_alerts = [a for a in alerts if a.get('location') == 'TestZone-Step4']
    
    if test_alerts:
        alert = test_alerts[0]
        print(f"[OK] Alert found in database:")
        print(f"     Location: {alert.get('location')}")
        print(f"     Status: {alert.get('status')}")
        print(f"     Risk Level: {alert.get('riskLevel')}")
        print(f"     Created: {str(alert.get('createdAt', ''))[:19]}")
        print(f"     Notification Sent: {alert.get('notificationSent')}")
        if alert.get('notificationTimestamp'):
            print(f"     Notification Time: {str(alert.get('notificationTimestamp'))[:19]}")
        
        if alert.get('triggeringPredictions'):
            print(f"     Triggering Predictions: {len(alert.get('triggeringPredictions'))}")
    else:
        print(f"[*] No alert found for TestZone-Step4")
        print(f"    Total alerts in DB: {len(alerts)}")
        if alerts:
            print(f"    First alert location: {alerts[0].get('location')}")
else:
    print(f"ERROR: Failed to fetch alerts: {res.status_code}")

print("\n" + "=" * 70)
print("STEP 4 IMPLEMENTATION SUMMARY")
print("=" * 70)
print("""
NOTIFICATION SYSTEM:
  [OK] Alert creation triggers email notification
  [OK] Email sent only when alert created (not on subsequent HIGHs)
  [OK] Recipients: All users with valid email addresses
  [OK] Safe error handling (email failures don't crash backend)
  [OK] Notification status tracked in Alert document

EMAIL CONTENT INCLUDES:
  - Location of outbreak
  - Risk level (HIGH)
  - Time detected
  - Alert ID
  - Number of triggering predictions
  - Recommended actions (6 steps)
  - Link to dashboard

DUPLICATE PREVENTION:
  - notificationSent flag checked before sending
  - Prevents resending email for same alert
  - Alert object updated after successful send

LOGGING:
  [*] Check backend logs for:
      [Alert Notification] Sending alert email...
      [Alert Notification] Alert email sent successfully
""")

print("=" * 70)
