import requests

res = requests.get('http://localhost:5000/reports')
if res.status_code == 200:
    data = res.json()
    print(f'Total reports: {len(data)}')
    
    # Look for test reports
    test_reports = [r for r in data if 'clinic-test' in str(r.get('reporter_id', ''))]
    print(f'Test reports found: {len(test_reports)}')
    
    if test_reports:
        print('\nTest Reports:')
        for r in test_reports:
            rid = r.get('reporter_id')
            risk = r.get('riskAnalysis', {}).get('riskLevel', 'unknown')
            loc = r.get('location', 'unknown')
            print(f'  ✓ {rid}: {risk} risk at {loc}')
else:
    print(f'Status: {res.status_code}')
