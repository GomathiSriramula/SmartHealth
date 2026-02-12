#!/usr/bin/env python3
import requests

API_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("CHECKING REPORTS WITH DIFFERENT REPORTER_IDs")
print("=" * 70)

usernames = ['kavya@gmail.com', 'kavya']

for username in usernames:
    print(f"\n🔍 Checking reporter_id='{username}'")
    try:
        response = requests.get(f'{API_URL}/reports?reporter_id={username}&limit=10000')
        if response.ok:
            data = response.json()
            print(f"   Total reports: {len(data)}")
            
            if data and len(data) > 0:
                # Show first 3 reports
                for i, report in enumerate(data[:3], 1):
                    print(f"   [{i}] {report.get('sex')}, {report.get('patient_age')}y - {len(report.get('symptoms', []))} symptoms - Location: {report.get('location', 'N/A')}")
        else:
            print(f"   ❌ Error: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

print("\n" + "=" * 70)
