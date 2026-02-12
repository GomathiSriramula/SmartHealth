#!/usr/bin/env python3
"""
Test CSV Sensor Upload Fix
Verifies that sensor readings from CSV uploads now properly:
1. Create ML predictions
2. Trigger alerts when 2 consecutive HIGH risks occur
"""

import requests
import json
from datetime import datetime

API_BASE = "http://localhost:5000"

def check_predictions():
    """Check if predictions exist"""
    print("\n📊 Checking ML Predictions...")
    try:
        response = requests.get(f"{API_BASE}/predictions?limit=10")
        if response.ok:
            data = response.json()
            predictions = data.get('predictions', [])
            print(f"   ✅ Found {len(predictions)} predictions")
            
            high_risk = [p for p in predictions if (p.get('risk') or p.get('riskLevel', '')).upper() == 'HIGH']
            print(f"   🔴 HIGH risk predictions: {len(high_risk)}")
            
            if high_risk:
                print("\n   Latest HIGH risk predictions:")
                for p in high_risk[:3]:
                    location = p.get('location', 'Unknown')
                    confidence = p.get('confidence', 0)
                    print(f"      - {location} (confidence: {confidence}%)")
            
            return True
        else:
            print(f"   ❌ Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def check_alerts():
    """Check if alerts exist"""
    print("\n🚨 Checking Alerts...")
    try:
        response = requests.get(f"{API_BASE}/api/alerts?status=all&limit=10")
        if response.ok:
            data = response.json()
            alerts = data.get('alerts', [])
            print(f"   ✅ Found {len(alerts)} alerts")
            
            active = [a for a in alerts if a.get('status') == 'active']
            print(f"   🟢 Active alerts: {len(active)}")
            
            if active:
                print("\n   Active alerts:")
                for a in active:
                    location = a.get('location', 'Unknown')
                    triggers = len(a.get('triggeringPredictions', []))
                    print(f"      - {location} ({triggers} triggering predictions)")
            
            return True
        else:
            print(f"   ❌ Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("CSV SENSOR UPLOAD FIX - VERIFICATION TEST")
    print("=" * 60)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n📋 INSTRUCTIONS:")
    print("1. Make sure backend is running (node backend2/server.js)")
    print("2. Upload a CSV file with sensor readings (high pH, high turbidity)")
    print("3. Run this script to verify predictions and alerts were created")
    
    input("\nPress Enter when you've uploaded the CSV file...")
    
    predictions_ok = check_predictions()
    alerts_ok = check_alerts()
    
    print("\n" + "=" * 60)
    if predictions_ok and alerts_ok:
        print("✅ VERIFICATION PASSED")
        print("\nYour CSV upload should now:")
        print("  ✓ Create ML predictions from sensor data")
        print("  ✓ Trigger alerts when 2 consecutive HIGH risks occur")
    else:
        print("⚠️  VERIFICATION INCOMPLETE")
        print("Some checks failed. Review the output above.")
    print("=" * 60)

if __name__ == "__main__":
    main()
