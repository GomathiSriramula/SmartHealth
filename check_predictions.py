import requests
import json

# Check predictions created by our tests
res = requests.get('http://localhost:5000/api/predictions')
if res.status_code == 200:
    data = res.json()
    predictions = data.get('predictions', []) if isinstance(data, dict) else data
    
    print(f'Total predictions: {len(predictions)}\n')
    print('Recent predictions:')
    for p in predictions[-5:]:
        print(f'  ID: {p.get("_id", "?")[:8]}...')
        print(f'  Location: {p.get("location")}')
        print(f'  Risk: {p.get("riskLevel")}')  
        print(f'  Type: {p.get("predictionType")}')
        created = p.get('createdAt', p.get('created_at'))
        if created:
            print(f'  Created: {created[:19]}')
        print()
else:
    print(f'Predictions Status: {res.status_code}')

# Also check if any alerts were created
print('\n' + '='*40)
print('Checking Alerts...')
res = requests.get('http://localhost:5000/api/alerts')
if res.status_code == 200:
    try:
        data = res.json()
        alerts = data.get('alerts', []) if isinstance(data, dict) else data
        print(f'Total alerts: {len(alerts)}')
        for a in alerts[-3:]:
            print(f'  Location: {a.get("location")}, Status: {a.get("status")}')
    except:
        print('Could not parse alerts response')
elif res.status_code == 404:
    print('Alerts endpoint not found - trying /alerts')
    res = requests.get('http://localhost:5000/alerts')
    if res.status_code == 200:
        print(f'Found alerts endpoint (status 200)')
    else:
        print(f'Alerts status: {res.status_code}')
else:
    print(f'Alerts Status: {res.status_code}')
