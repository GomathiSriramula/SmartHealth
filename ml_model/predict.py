import os
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from model import DiseaseOutbreakModel

# Load environment variables
load_dotenv()

class PredictionService:
    def __init__(self):
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
        self.api_key = os.getenv('API_KEY', 'secret-key')
        self.model = DiseaseOutbreakModel()
        
        # Load the trained model
        try:
            self.model.load_model()
            print("✅ ML Model loaded successfully")
        except FileNotFoundError:
            print("⚠️  Model not found. Please train the model first.")
            
    def fetch_sensor_data(self, limit=100):
        """Fetch recent sensor readings from backend"""
        try:
            url = f"{self.backend_url}/sensors?limit={limit}"
            response = requests.get(url)
            
            if response.status_code == 200:
                data = response.json()
                print(f"📡 Fetched {len(data)} sensor readings")
                return data
            else:
                print(f"❌ Failed to fetch sensor data: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error fetching sensor data: {e}")
            return []
    
    def analyze_readings(self, sensor_readings):
        """Analyze sensor readings and identify high-risk areas"""
        if not sensor_readings:
            print("⚠️  No sensor readings to analyze")
            return []
        
        print(f"\n🔬 Analyzing {len(sensor_readings)} sensor readings...")
        
        # Make predictions
        predictions = self.model.predict_batch(sensor_readings)
        
        # Filter high-risk predictions
        high_risk = [p for p in predictions if p['risk_level'] == 'High']
        medium_risk = [p for p in predictions if p['risk_level'] == 'Medium']
        
        print(f"   High Risk: {len(high_risk)}")
        print(f"   Medium Risk: {len(medium_risk)}")
        print(f"   Low Risk: {len(predictions) - len(high_risk) - len(medium_risk)}")
        
        return predictions
    
    def create_prediction_alert(self, predictions):
        """Create a prediction alert if high risk detected"""
        high_risk = [p for p in predictions if p['risk_level'] == 'High']
        
        if not high_risk:
            print("✅ No high-risk areas detected")
            return None
        
        # Get location info
        locations = list(set([f"({p['lat']:.4f}, {p['lng']:.4f})" 
                             for p in high_risk if p['lat'] and p['lng']]))
        location_str = ", ".join(locations[:3])  # First 3 locations
        if len(locations) > 3:
            location_str += f" and {len(locations) - 3} more"
        
        # Calculate average confidence
        avg_confidence = sum([p['confidence'] for p in high_risk]) / len(high_risk)
        
        # Create recommendations
        recommendations = [
            "Boil water for at least 1 minute before drinking",
            "Use bottled water for drinking and cooking",
            "Avoid giving tap water to infants and elderly",
            "Wash hands frequently with soap and clean water",
            "Report any symptoms to local health authorities",
            "Avoid swimming or bathing in affected water sources"
        ]
        
        # Create prediction payload
        prediction_data = {
            "predictionType": "Water-Borne Disease Outbreak Risk",
            "location": location_str or "Multiple areas",
            "riskLevel": "high",
            "details": f"ML model detected {len(high_risk)} high-risk sensor readings indicating potential water contamination. "
                      f"Analysis shows elevated turbidity and abnormal pH levels in water sources. "
                      f"Immediate action recommended to prevent disease outbreak.",
            "recommendations": recommendations,
            "confidence": round(avg_confidence, 2),
            "modelVersion": "v1.0",
            "predictedDate": datetime.now().isoformat(),
            "lat": high_risk[0]['lat'] if high_risk[0]['lat'] else None,
            "lng": high_risk[0]['lng'] if high_risk[0]['lng'] else None,
        }
        
        return prediction_data
    
    def send_prediction_to_backend(self, prediction_data):
        """Send prediction to backend which will notify users via email"""
        try:
            url = f"{self.backend_url}/predictions"
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': self.api_key
            }
            
            response = requests.post(url, json=prediction_data, headers=headers)
            
            if response.status_code == 201:
                result = response.json()
                print(f"✅ Prediction sent to backend successfully!")
                print(f"   Prediction ID: {result['prediction']['id']}")
                if result.get('notification'):
                    print(f"   📧 Email notification sent to {result['notification'].get('count', 0)} users")
                return True
            else:
                print(f"❌ Failed to send prediction: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error sending prediction: {e}")
            return False
    
    def run_prediction_pipeline(self):
        """Run the complete prediction pipeline"""
        print("\n" + "="*60)
        print("🔮 Starting ML Prediction Pipeline")
        print("="*60)
        print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Step 1: Fetch sensor data
        sensor_readings = self.fetch_sensor_data()
        
        if not sensor_readings:
            print("\n⚠️  No sensor data available. Exiting.")
            return
        
        # Step 2: Analyze readings
        predictions = self.analyze_readings(sensor_readings)
        
        # Step 3: Create alert if high risk detected
        prediction_alert = self.create_prediction_alert(predictions)
        
        if prediction_alert:
            print(f"\n🚨 HIGH RISK DETECTED!")
            print(f"   Location: {prediction_alert['location']}")
            print(f"   Confidence: {prediction_alert['confidence']:.2f}%")
            print(f"   Details: {prediction_alert['details'][:100]}...")
            
            # Step 4: Send to backend (will trigger email notifications)
            print(f"\n📤 Sending prediction to backend...")
            success = self.send_prediction_to_backend(prediction_alert)
            
            if success:
                print("\n✅ Pipeline completed successfully!")
                print("   Users will receive email notifications about the outbreak risk.")
            else:
                print("\n⚠️  Pipeline completed but failed to send notification")
        else:
            print("\n✅ No high-risk areas detected. All clear!")
        
        print("="*60)
        return predictions


if __name__ == "__main__":
    service = PredictionService()
    service.run_prediction_pipeline()
