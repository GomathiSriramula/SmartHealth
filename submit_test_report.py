#!/usr/bin/env python3
"""
Submit a test health report with symptoms that trigger alerts
This will demonstrate the user-specific alert generation system
"""
import requests
import json
import random

API_URL = "http://127.0.0.1:5000"

def submit_test_report(username="seetha", location="Water Treatment Plant A"):
    """Submit a high-risk health report to trigger alert generation"""
    
    # High-risk symptoms that will trigger alerts
    high_risk_symptoms = [
        "Severe Diarrhea",
        "Vomiting", 
        "Dehydration",
        "Abdominal Pain",
        "High Fever"
    ]
    
    # Random location near major city
    locations = [
        {"lat": 40.7128, "lng": -74.0060, "name": "New York Water District"},  # NYC
        {"lat": 34.0522, "lng": -118.2437, "name": "Los Angeles Water Treatment"},  # LA
        {"lat": 39.7392, "lng": -104.9903, "name": "Denver Water Authority"},  # Denver
    ]
    
    selected_location = random.choice(locations)
    
    report_data = {
        "reporter_type": "healthcare_worker",
        "reporter_id": username,
        "patient_age": random.randint(20, 65),
        "sex": random.choice(["M", "F"]),
        "lat": selected_location["lat"],
        "lng": selected_location["lng"],
        "symptoms": high_risk_symptoms,
        "reported_at": "2026-02-09T10:00:00Z"
    }
    
    print("=" * 70)
    print("SUBMITTING HIGH-RISK HEALTH REPORT FOR ALERT GENERATION")
    print("=" * 70)
    print(f"\n🏥 Report Details:")
    print(f"   Reporter: {username}")
    print(f"   Location: {selected_location['name']}")
    print(f"   Coordinates: ({selected_location['lat']}, {selected_location['lng']})")
    print(f"   Patient Age: {report_data['patient_age']}")
    print(f"   Sex: {report_data['sex']}")
    print(f"   Symptoms: {', '.join(high_risk_symptoms)}")
    
    try:
        print(f"\n📤 Submitting report...")
        response = requests.post(
            f"{API_URL}/reports",
            json=report_data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": "secret-key"
            },
            timeout=10
        )
        
        if response.ok:
            result = response.json()
            print(f"✅ Report submitted successfully!")
            print(f"   Report ID: {result.get('_id', 'N/A')}")
            
            # Check if alerts were generated
            print(f"\n🔍 Checking for generated alerts...")
            alerts_response = requests.get(f"{API_URL}/api/alerts?status=all&limit=50")
            
            if alerts_response.ok:
                alerts_data = alerts_response.json()
                total_alerts = alerts_data.get('total', 0)
                alerts = alerts_data.get('alerts', [])
                
                print(f"\n📊 Alert Status:")
                print(f"   Total Alerts in System: {total_alerts}")
                print(f"   Active Alerts: {len([a for a in alerts if a.get('status') == 'active'])}")
                
                if alerts:
                    print(f"\n🚨 Latest Alerts:")
                    for alert in alerts[:3]:  # Show first 3 alerts
                        print(f"\n   Location: {alert.get('location')}")
                        print(f"   Risk Level: {alert.get('riskLevel')}")
                        print(f"   Status: {alert.get('status')}")
                        print(f"   Reason: {alert.get('reason')}")
            
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            return False
            
    except Exception as e:
        print(f"❌ Failed to submit report: {e}")
        return False

if __name__ == "__main__":
    success = submit_test_report(username="seetha")
    
    print("\n" + "=" * 70)
    if success:
        print("✅ TEST COMPLETE - Alerts generated from user-submitted data")
        print("\n💡 How this works:")
        print("   1. User submits health report with symptoms")
        print("   2. System analyzes symptoms for disease risk")
        print("   3. If HIGH RISK, an alert is automatically created")
        print("   4. Alert is displayed on Dashboard Alerts tab")
        print("   5. Each user sees alerts relevant to their location/data")
    else:
        print("❌ TEST FAILED - Check backend connection")
    print("=" * 70 + "\n")
