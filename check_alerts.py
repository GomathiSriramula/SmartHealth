#!/usr/bin/env python3
import requests
import json

API_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("CHECKING ALERTS DATA IN BACKEND")
print("=" * 70)

try:
    # Check alerts
    response = requests.get(f'{API_URL}/api/alerts?status=all&limit=10')
    if response.ok:
        data = response.json()
        print(f"\n✅ Alerts API responding")
        print(f"   Total alerts: {data.get('total', 0)}")
        print(f"   Count in response: {data.get('count', 0)}")
        
        alerts = data.get('alerts', [])
        if alerts:
            print(f"\n   📊 {len(alerts)} alerts found:")
            for i, alert in enumerate(alerts, 1):
                print(f"\n   [{i}] {alert.get('location')}")
                print(f"       Status: {alert.get('status')}")
                print(f"       Risk Level: {alert.get('riskLevel')}")
                print(f"       Created: {alert.get('createdAt', 'N/A')[:19]}")
        else:
            print(f"\n   ⚠️  No alerts in database yet")
            print(f"   Full response: {json.dumps(data, indent=2)[:300]}")
    else:
        print(f"\n❌ API error: {response.status_code}")
        print(f"   Response: {response.text[:300]}")
        
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "=" * 70)
