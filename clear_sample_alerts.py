#!/usr/bin/env python3
"""
Clear sample alerts from the database and keep only user-generated ones
"""
import requests
import json

API_URL = "http://127.0.0.1:5000"

def clear_sample_alerts():
    """Delete sample/test alerts, keep user-generated ones"""
    try:
        # Get all alerts
        print("📋 Fetching all alerts...")
        res = requests.get(f"{API_URL}/api/alerts?status=all&limit=100")
        if not res.ok:
            print(f"❌ Failed to fetch alerts: {res.status_code}")
            return
        
        data = res.json()
        alerts = data.get('alerts', [])
        
        print(f"\n📊 Found {len(alerts)} alerts total")
        
        # Sample alert indicators
        sample_indicators = [
            "FinalTest",
            "Test-Location",
            "Coordinates: (40.714",
            "Coordinates: (40.7128",
            "Sample",
            "Demo",
        ]
        
        sample_count = 0
        user_count = 0
        
        # Identify and delete sample alerts
        for alert in alerts:
            location = alert.get('location', '')
            reason = alert.get('reason', '')
            is_sample = any(indicator in location or indicator in reason for indicator in sample_indicators)
            
            if is_sample:
                # Delete this sample alert
                alert_id = alert.get('_id')
                try:
                    delete_res = requests.post(
                        f"{API_URL}/api/alerts/{alert_id}/resolve",
                        json={"reason": "Clearing sample data - auto-cleanup"}
                    )
                    if delete_res.ok:
                        print(f"✅ Resolved sample alert: {location}")
                        sample_count += 1
                except Exception as e:
                    print(f"⚠️  Could not resolve alert {alert_id}: {e}")
            else:
                user_count += 1
                print(f"ℹ️  Keeping user-generated alert: {location}")
        
        print(f"\n✅ Cleanup complete!")
        print(f"  - Sample alerts resolved/removed: {sample_count}")
        print(f"  - User-generated alerts kept: {user_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("CLEARING SAMPLE ALERTS FROM DATABASE")
    print("=" * 60)
    clear_sample_alerts()
    print("\n✅ Database cleanup complete!")
    print("💡 New alerts will be generated automatically from user-submitted reports.\n")
