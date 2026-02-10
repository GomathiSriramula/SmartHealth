#!/usr/bin/env python3
"""Test creating predictions via /predictions endpoint and verify alerts are created"""

import requests
import time
import json

API_URL = "http://127.0.0.1:5000"

print("\n" + "="*70)
print("TESTING /PREDICTIONS ENDPOINT & ALERT CREATION (FIXED)")
print("="*70)

# Test data - HIGH risk
prediction_data = {
    "predictionType": "Disease Outbreak",
    "location": "TestLocation456",
    "riskLevel": "high",
    "details": "Test HIGH risk prediction",
    "confidence": 85,
    "recommendations": ["Boil water", "Monitor closely"]
}

try:
    print("\n[1] Creating FIRST HIGH RISK prediction...")
    res1 = requests.post(
        f"{API_URL}/predictions",
        json=prediction_data,
        timeout=10
    )
    print(f"    Status: {res1.status_code}")
    if res1.status_code == 201:
        data1 = res1.json()
        pred1_id = data1.get('prediction', {}).get('id')
        alert1_action = data1.get('alert', {}).get('action')
        print(f"    ✅ Prediction created: {pred1_id}")
        print(f"    Alert action: {alert1_action} (should be 'none' since it's the first)")
    else:
        print(f"    ❌ Error: {res1.text}")
    
    time.sleep(2)
    
    print("\n[2] Creating SECOND HIGH RISK prediction (same location)...")
    res2 = requests.post(
        f"{API_URL}/predictions",
        json=prediction_data,
        timeout=10
    )
    print(f"    Status: {res2.status_code}")
    if res2.status_code == 201:
        data2 = res2.json()
        pred2_id = data2.get('prediction', {}).get('id')
        alert2_action = data2.get('alert', {}).get('action')
        alert2_id = data2.get('alert', {}).get('alertId')
        alert2_msg = data2.get('alert', {}).get('message')
        print(f"    ✅ Prediction created: {pred2_id}")
        print(f"    Alert action: {alert2_action} (should be 'created')")
        print(f"    Alert ID: {alert2_id}")
        print(f"    Alert message: {alert2_msg}")
    else:
        print(f"    ❌ Error: {res2.text}")
    
    print("\n[3] Checking if alerts are visible via API...")
    time.sleep(1)
    
    res_alerts = requests.get(
        f"{API_URL}/api/alerts?status=all&limit=100",
        timeout=10
    )
    print(f"    Status: {res_alerts.status_code}")
    if res_alerts.ok:
        alerts_data = res_alerts.json()
        total = alerts_data.get('total', 0)
        alerts = alerts_data.get('alerts', [])
        
        print(f"    Total alerts in DB: {total}")
        print(f"    Alerts in response: {len(alerts)}")
        
        if alerts:
            print(f"\n    ✅ ALERTS FOUND!")
            for i, alert in enumerate(alerts[:2], 1):
                print(f"    [{i}] Location: {alert.get('location')}")
                print(f"        Status: {alert.get('status')}")
                print(f"        Risk Level: {alert.get('riskLevel')}")
                print(f"        Reason: {alert.get('reason')}")
        else:
            print(f"\n    ❌ NO ALERTS FOUND - Check backend logs!")
    else:
        print(f"    ❌ API error: {res_alerts.status_code}")
        print(f"    Response: {res_alerts.text}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "="*70 + "\n")
