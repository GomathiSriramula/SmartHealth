import requests
import json

# Test configuration
BACKEND_URL = "http://localhost:5000"
API_KEY = "secret-key"

def test_backend_connection():
    """Test if backend is accessible"""
    print("🔗 Testing backend connection...")
    try:
        response = requests.get(f"{BACKEND_URL}/upload/stats")
        if response.status_code == 200:
            print("✅ Backend is accessible")
            data = response.json()
            print(f"   Case Reports: {data['database']['caseReports']}")
            return True
        else:
            print(f"❌ Backend returned status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return False



def test_prediction_endpoint():
    """Test sending a prediction to backend"""
    print("\n🔮 Testing prediction endpoint...")
    
    test_prediction = {
        "predictionType": "Test Water-Borne Disease Risk",
        "location": "Test Area",
        "riskLevel": "medium",
        "details": "This is a test prediction from ML model setup",
        "recommendations": [
            "This is a test recommendation",
            "Please ignore this notification"
        ],
        "confidence": 85.5,
        "modelVersion": "v1.0-test",
        "lat": 17.4530,
        "lng": 78.3950
    }
    
    try:
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        }
        response = requests.post(
            f"{BACKEND_URL}/predictions", 
            json=test_prediction,
            headers=headers
        )
        
        if response.status_code == 201:
            result = response.json()
            print("✅ Prediction sent successfully!")
            print(f"   Prediction ID: {result['prediction']['id']}")
            if result.get('notification'):
                print(f"   📧 Emails sent to: {result['notification'].get('count', 0)} users")
            return True
        else:
            print(f"❌ Failed to send prediction: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("="*60)
    print("🧪 SmartHealth ML Integration Test")
    print("="*60)
    
    # Test 1: Backend connection
    backend_ok = test_backend_connection()
    
    if not backend_ok:
        print("\n⚠️  Backend is not running. Please start it first:")
        print("   cd backend2")
        print("   node index.js")
        return
    
    # Test 3: Prediction endpoint
    prediction_ok = test_prediction_endpoint()
    
    # Summary
    print("\n" + "="*60)
    print("📊 Test Summary")
    print("="*60)
    print(f"Backend Connection: {'✅' if backend_ok else '❌'}")
    print(f"Prediction Endpoint: {'✅' if prediction_ok else '❌'}")
    print("="*60)
    
    if backend_ok and prediction_ok:
        print("\n✅ All tests passed! ML model is ready to use.")
        print("\n📝 Next steps:")
        print("1. Train the model: python train.py <path-to-dataset.csv>")
        print("2. Run predictions: python predict.py")
        print("3. Start monitoring: python monitor.py")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    main()
