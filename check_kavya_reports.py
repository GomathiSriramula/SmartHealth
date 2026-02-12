#!/usr/bin/env python3
import requests

API_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("CHECKING KAVYA'S REPORTS IN DATABASE")
print("=" * 70)

try:
    # Check reports for kavya with high limit
    response = requests.get(f'{API_URL}/reports?reporter_id=kavya@gmail.com&limit=10000')
    if response.ok:
        data = response.json()
        print(f"\n✅ Reports API responding")
        print(f"   Total reports for kavya@gmail.com: {len(data)}")
        
        if data:
            print(f"\n   📊 First 5 reports:")
            for i, report in enumerate(data[:5], 1):
                print(f"\n   [{i}] ID: {report.get('_id', 'N/A')}")
                print(f"       Patient: {report.get('sex')}, {report.get('patient_age')}y")
                print(f"       Symptoms: {', '.join(report.get('symptoms', [])[:3])}")
                print(f"       Reporter: {report.get('reporter_id')}")
                print(f"       Location: {report.get('location', 'N/A')}")
                print(f"       Date: {report.get('reported_at', report.get('created_at'))}")
        else:
            print("\n   ⚠️ No reports found for kavya@gmail.com")
    else:
        print(f"   ❌ Error: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   ❌ Exception: {e}")

print("\n" + "=" * 70)
