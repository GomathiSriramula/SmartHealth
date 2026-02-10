#!/usr/bin/env python3
"""Test with detailed logging"""

import requests
import json

API_URL = "http://127.0.0.1:5000"

pred_data = {
    "predictionType": "Disease Outbreak",
    "location": "DebugLocation",
    "riskLevel": "high",
    "details": "Test",
    "confidence": 85,
}

print("[1] Creating first prediction...")
res1 = requests.post(f"{API_URL}/predictions", json=pred_data)
print(f"Status: {res1.status_code}")
data1 = res1.json()
print("Full response:")
print(json.dumps(data1, indent=2))

print("\n[2] Creating second prediction...")
res2 = requests.post(f"{API_URL}/predictions", json=pred_data)
print(f"Status: {res2.status_code}")
data2 = res2.json()
print("Full response:")
print(json.dumps(data2, indent=2))
