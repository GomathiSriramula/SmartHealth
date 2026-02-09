import requests
import json

res = requests.get('http://localhost:5000/reports')
if res.status_code == 200:
    data = res.json()
    test_reports = [r for r in data if 'clinic-test' in str(r.get('reporter_id', ''))]
    
    if test_reports:
        print('Test Report Details:\n')
        for i, r in enumerate(test_reports, 1):
            print(f'{i}. Reporter ID: {r.get("reporter_id")}')
            print(f'   Location: {r.get("location")}')
            print(f'   Risk Analysis: {r.get("riskAnalysis")}')
            print(f'   Symptoms: {r.get("symptoms")}')
            print()
else:
    print(f'Status: {res.status_code}')
