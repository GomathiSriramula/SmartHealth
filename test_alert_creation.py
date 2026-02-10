#!/usr/bin/env python3
"""Test creating ML predictions and checking if alerts are created"""

import requests
import time
import json

API_URL = "http://127.0.0.1:5000"

print("\n" + "="*70)
print("TESTING ML PREDICTIONS & ALERT CREATION")
print("="*70)

# Test data - HIGH risk
high_risk_data = {
    "pH": 5.5,
    "Turbidity": 15.0,
    "Dissolved_Oxygen": 3.0,
    "location": "TestLocation123",
    "source": "test"
}

try:
    print("\n[1] Creating FIRST HIGH RISK prediction...")
    res1 = requests.post(
        f"{API_URL}/api/predictions",
        json=high_risk_data,
        timeout=10
    )
    print(f"    Status: {res1.status_code}")
    data1 = res1.json()
    print(f"    Response: {json.dumps(data1, indent=2)[:200]}...")
    
    if res1.status_code != 201:
        print(f"❌ Error: {data1}")
    else:
        pred1_id = data1.get('prediction', {}).get('id')
        print(f"    ✅ Prediction created: {pred1_id}")
    
    time.sleep(2)
    
    print("\n[2] Creating SECOND HIGH RISK prediction (same location)...")
    res2 = requests.post(
        f"{API_URL}/api/predictions",
        json=high_risk_data,
        timeout=10
    )
    print(f"    Status: {res2.status_code}")
    data2 = res2.json()
    print(f"    Response: {json.dumps(data2, indent=2)[:400]}...")
    
    if res2.status_code == 201:
        pred2_id = data2.get('prediction', {}).get('id')
        print(f"    ✅ Prediction created: {pred2_id}")
        alert_action = data2.get('alert', {}).get('action')
        print(f"    Alert action: {alert_action}")
    
    print("\n[3] Checking if alerts exist in database...")
    time.sleep(1)
    
    res_alerts = requests.get(
        f"{API_URL}/api/alerts?status=all&limit=100",
        timeout=10
    )
    print(f"    Alerts API Status: {res_alerts.status_code}")
    alerts_data = res_alerts.json()
    print(f"    Total alerts: {alerts_data.get('total')}")
    print(f"    Active alerts: {alerts_data.get('stats', {}).get('activeAlerts', 'N/A')}")
    
    alerts = alerts_data.get('alerts', [])
    print(f"    Alerts in response: {len(alerts)}")
    
    if alerts:
        print(f"\n   ✅ ALERTS FOUND!")
        for i, alert in enumerate(alerts, 1):
            print(f"   [{i}] Location: {alert.get('location')}")
            print(f"       Status: {alert.get('status')}")
            print(f"       Risk: {alert.get('riskLevel')}")
    else:
        print(f"\n   ❌ NO ALERTS FOUND")
    
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "="*70 + "\n")
