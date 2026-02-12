#!/usr/bin/env python3
"""
Test script to verify sensor readings CSV upload triggers ML predictions and alerts
"""
import requests

API_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("TESTING SENSOR READINGS CSV UPLOAD → ML PREDICTIONS → ALERTS")
print("=" * 80)

# Test file path
csv_file = 'backend2/sample_sensor_high_risk.csv'

print(f"\n📤 Uploading sensor readings CSV: {csv_file}")
print("   Expected: HIGH turbidity values (12-18) and low pH (4.8-5.5)")
print("   Should trigger: HIGH RISK predictions")
print("   Location: ramapur (for alert matching)")

try:
    with open(csv_file, 'rb') as f:
        files = {'file': ('sensor_test.csv', f, 'text/csv')}
        response = requests.post(f'{API_URL}/upload/sensor-readings', files=files)
        
    if response.ok:
        data = response.json()
        print(f"\n✅ Upload successful!")
        print(f"   Total rows: {data['summary']['totalRows']}")
        print(f"   Successful: {data['summary']['successful']}")
        print(f"   Failed: {data['summary']['failed']}")
        
        if 'mlAnalysis' in data:
            print(f"\n🎯 ML ANALYSIS:")
            print(f"   Predictions created: {data['mlAnalysis']['predictionsCreated']}")
            print(f"   Alerts created: {data['mlAnalysis']['alertsCreated']}")
            print(f"   Message: {data['mlAnalysis']['message']}")
            
            if data['mlAnalysis']['alertsCreated'] > 0:
                print(f"\n🚨 SUCCESS! Alerts were triggered from sensor data!")
            else:
                print(f"\n⚠️  No alerts triggered (may need 2+ consecutive HIGH predictions)")
        else:
            print(f"\n❌ ML Analysis not in response - predictions may not have been triggered")
            print(f"   Full response: {data}")
    else:
        print(f"\n❌ Upload failed: {response.status_code}")
        print(f"   Response: {response.text}")
        
except FileNotFoundError:
    print(f"\n❌ File not found: {csv_file}")
    print(f"   Make sure you're running this from the SmartHealthFullProject directory")
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "=" * 80)
print("NEXT STEPS:")
print("1. Check ML Predictions tab in dashboard")
print("2. Check Alerts tab for triggered alerts")
print("3. Upload again to trigger 2nd consecutive HIGH prediction for alert")
print("=" * 80)
