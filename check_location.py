import requests

res = requests.get('http://localhost:5000/reports?limit=3')
repos = res.json()

print('Recent case reports:')
for r in repos[-2:]:
    print(f"Reporter: {r.get('reporter_id')}")
    print(f"  location field: {r.get('location')}")
    print(f"  lat/lng: ({r.get('lat')}, {r.get('lng')})")
    print()
