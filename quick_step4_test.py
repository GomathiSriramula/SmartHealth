import requests
from datetime import datetime

BASE = "http://localhost:5000"

# Quick registration
user = {
    "username": f"quicktest_{int(datetime.now().timestamp())}",
    "email": f"qt_{int(datetime.now().timestamp())}@test.com",
    "password": "TestPassword123"
}

requests.post(f"{BASE}/auth/register", json=user)
res = requests.post(f"{BASE}/auth/login", json={
    "email": user["email"],
    "password": user["password"]
})

token = res.json().get("token")

# Submit 2 cases at same location
case1 = {
    "reporter_type": "clinic",
    "reporter_id": "q1",
    "patient_age": 35,
    "sex": "M",
    "lat": 40.8,
    "lng": -74.0,
    "location": "QuickTestZone",
    "symptoms": ["diarrhea", "fever"],
    "reported_at": datetime.now().isoformat()
}

case2 = {
    "reporter_type": "clinic",
    "reporter_id": "q2",
    "patient_age": 42,
    "sex": "F",
    "lat": 40.81,
    "lng": -74.01,
    "location": "QuickTestZone",
    "symptoms": ["diarrhea", "fever", "dehydration"],
    "reported_at": datetime.now().isoformat()
}

print("[1] Submitting case 1...")
res = requests.post(f"{BASE}/report", json=case1, headers={"Authorization": f"Bearer {token}"})
print(f"Case 1: {res.status_code}")

print("[2] Submitting case 2 (should trigger alert + email)...")
res = requests.post(f"{BASE}/report", json=case2, headers={"Authorization": f"Bearer {token}"})
print(f"Case 2: {res.status_code}")

print("[3] Checking alerts...")
res = requests.get(f"{BASE}/alerts?limit=5")
if res.status_code == 200:
    alerts = res.json().get('alerts', [])
    qt_alerts = [a for a in alerts if 'QuickTest' in a.get('location', '')]
    if qt_alerts:
        a = qt_alerts[0]
        print(f"     Found: {a.get('location')}")
        print(f"     Notification Sent: {a.get('notificationSent')}")
        print(f"     Notification Error: {a.get('notificationError')}")
    else:
        print(f"     No QuickTest alerts found")
        print(f"     Total alerts: {len(alerts)}")
        if alerts:
            print(f"     Last alert location: {alerts[0].get('location')}")

print("\nDone. Check backend logs for [Alert Notification] messages")
