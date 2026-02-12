import requests
import json

# Login first to get token
login_url = "http://localhost:5000/auth/login"
login_data = {"email": "kavya@gmail.com", "password": "kavyasmitha"}

print("🔐 Logging in...")
login_response = requests.post(login_url, json=login_data)
login_result = login_response.json()
print(f"Login response: {json.dumps(login_result, indent=2)}")

if 'token' not in login_result:
    print("❌ Login failed!")
    exit(1)

token = login_result['token']
username = login_result.get('username', 'kavya@gmail.com')
print(f"✅ Logged in as: {username}")
print(f"Token: {token[:50]}...")

# Upload sensor CSV
print("\n🌊 Uploading HIGH RISK sensor CSV...")
upload_url = "http://localhost:5000/api/upload/sensor-readings"
headers = {"Authorization": f"Bearer {token}"}

with open('backend2/sample_sensor_high_risk.csv', 'rb') as f:
    files = {'file': ('sample_sensor_high_risk.csv', f, 'text/csv')}
    upload_response = requests.post(upload_url, files=files, headers=headers)

print(f"Status Code: {upload_response.status_code}")
print(f"Response: {json.dumps(upload_response.json(), indent=2)}")

if upload_response.status_code == 200:
    result = upload_response.json()
    print("\n✅ Upload successful!")
    print(f"   • Total rows: {result['summary']['totalRows']}")
    print(f"   • Successful: {result['summary']['successful']}")
    print(f"   • Failed: {result['summary']['failed']}")
    
    if 'mlAnalysis' in result:
        print(f"\n🎯 ML PREDICTIONS CREATED!")
        print(f"   • Predictions: {result['mlAnalysis']['predictionsCreated']}")
        print(f"   • Alerts: {result['mlAnalysis']['alertsCreated']}")
        print(f"   • Message: {result['mlAnalysis']['message']}")
    else:
        print("\n⚠️ No ML analysis in response - predictions may not have been triggered")

# Check ML predictions
print("\n🔍 Checking ML Predictions...")
predictions_url = "http://localhost:5000/api/predictions"
pred_response = requests.get(predictions_url, headers=headers)
predictions = pred_response.json()

print(f"Status Code: {pred_response.status_code}")
print(f"Total predictions: {len(predictions) if isinstance(predictions, list) else 'N/A'}")

if isinstance(predictions, list) and len(predictions) > 0:
    print(f"\n📊 Latest predictions (showing first 5):")
    for i, pred in enumerate(predictions[:5]):
        print(f"\n   Prediction {i+1}:")
        print(f"   • Location: {pred.get('location', 'N/A')}")
        print(f"   • Risk Level: {pred.get('risk_level', 'N/A')}")
        print(f"   • Turbidity: {pred.get('parameters', {}).get('turbidity', 'N/A')}")
        print(f"   • pH: {pred.get('parameters', {}).get('ph', 'N/A')}")
        print(f"   • Conductivity: {pred.get('parameters', {}).get('conductivity', 'N/A')}")
        print(f"   • Created: {pred.get('createdAt', 'N/A')}")
else:
    print("⚠️ No predictions found!")

# Check Alerts
print("\n🚨 Checking Alerts...")
alerts_url = "http://localhost:5000/api/alerts"
alerts_response = requests.get(alerts_url, headers=headers)
alerts = alerts_response.json()

print(f"Status Code: {alerts_response.status_code}")
print(f"Total alerts: {len(alerts) if isinstance(alerts, list) else 'N/A'}")

if isinstance(alerts, list) and len(alerts) > 0:
    print(f"\n🔔 Active alerts:")
    for i, alert in enumerate(alerts):
        print(f"\n   Alert {i+1}:")
        print(f"   • Location: {alert.get('location', 'N/A')}")
        print(f"   • Risk Level: {alert.get('critical_level', 'N/A')}")
        print(f"   • Status: {alert.get('status', 'N/A')}")
        print(f"   • Message: {alert.get('message', 'N/A')}")
        print(f"   • Created: {alert.get('createdAt', 'N/A')}")
else:
    print("ℹ️ No alerts found yet - you may need to upload twice to get 2 consecutive HIGH readings")

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
