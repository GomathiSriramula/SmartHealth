import requests
import json
from datetime import datetime, timedelta
import random

BACKEND_URL = "http://localhost:5000"
API_KEY = "secret-key"

def generate_sensor_readings(n_readings=50):
    """Generate sample sensor readings"""
    readings = []
    base_time = datetime.now()
    
    sensor_ids = ['S-001', 'S-002', 'S-003', 'S-004', 'S-005']
    
    for i in range(n_readings):
        # Mix of normal and contaminated readings
        if random.random() < 0.3:  # 30% contaminated
            pH = round(random.uniform(5.5, 6.3) if random.random() < 0.5 else random.uniform(8.6, 9.5), 2)
            turbidity = round(random.uniform(15, 50), 2)
            conductivity = round(random.uniform(600, 1200), 2)
        else:  # 70% normal
            pH = round(random.uniform(6.5, 8.5), 2)
            turbidity = round(random.uniform(0.5, 10), 2)
            conductivity = round(random.uniform(200, 600), 2)
        
        reading = {
            'sensor_id': random.choice(sensor_ids),
            'reading_at': (base_time - timedelta(minutes=i*5)).isoformat() + 'Z',
            'lat': round(17.45 + random.uniform(-0.01, 0.01), 6),
            'lng': round(78.39 + random.uniform(-0.01, 0.01), 6),
            'turbidity': turbidity,
            'pH': pH,
            'conductivity': conductivity
        }
        readings.append(reading)
    
    return readings

def upload_sensor_reading(reading):
    """Upload a single sensor reading"""
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
    }
    
    response = requests.post(
        f"{BACKEND_URL}/sensors",
        json=reading,
        headers=headers
    )
    
    return response.status_code == 200

def main():
    print("="*60)
    print("📡 Populating Sensor Data for ML Testing")
    print("="*60)
    
    # Generate readings
    readings = generate_sensor_readings(50)
    print(f"\n🔬 Generated {len(readings)} sensor readings")
    
    # Upload to backend
    print(f"\n📤 Uploading to backend...")
    success_count = 0
    
    for i, reading in enumerate(readings):
        if upload_sensor_reading(reading):
            success_count += 1
            if (i + 1) % 10 == 0:
                print(f"   Uploaded {i + 1}/{len(readings)}...")
    
    print(f"\n✅ Successfully uploaded {success_count}/{len(readings)} readings")
    
    # Show statistics
    print(f"\n📊 Data Statistics:")
    print(f"   Sensors: {len(set([r['sensor_id'] for r in readings]))}")
    print(f"   Time range: {readings[-1]['reading_at']} to {readings[0]['reading_at']}")
    
    high_turbidity = [r for r in readings if r['turbidity'] > 15]
    abnormal_ph = [r for r in readings if r['pH'] < 6.5 or r['pH'] > 8.5]
    
    print(f"   High turbidity readings: {len(high_turbidity)}")
    print(f"   Abnormal pH readings: {len(abnormal_ph)}")
    
    print(f"\n✅ Data population complete!")
    print(f"\n📝 You can now run predictions:")
    print(f"   python predict.py")

if __name__ == "__main__":
    main()
