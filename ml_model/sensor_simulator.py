#!/usr/bin/env python3
"""
SmartHealth IoT Sensor Simulator

Simulates water quality sensors with:
- Realistic water quality fluctuations
- Seasonal patterns
- Random anomalies
- Multiple locations
- Configurable update intervals

Sends simulated readings to backend prediction API
"""

import requests
import json
import random
import time
import sys
import argparse
from datetime import datetime
from dataclasses import dataclass

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

@dataclass
class SensorLocation:
    """Represents a sensor location with baseline water quality"""
    name: str
    ph_baseline: float
    turbidity_baseline: float
    oxygen_baseline: float
    anomaly_probability: float = 0.1  # 10% chance of anomaly
    
    def get_reading(self, anomaly=False):
        """Generate a realistic water quality reading"""
        if anomaly:
            # Anomaly: poor water quality
            ph = self.ph_baseline + random.gauss(0, 1.5)
            turbidity = self.turbidity_baseline + random.uniform(5, 15)
            oxygen = self.oxygen_baseline - random.uniform(2, 5)
        else:
            # Normal variation: ±5-10% from baseline
            ph = self.ph_baseline + random.gauss(0, 0.3)
            turbidity = self.turbidity_baseline + random.gauss(0, 1)
            oxygen = self.oxygen_baseline + random.gauss(0, 0.5)
        
        # Clamp to realistic ranges
        ph = max(5.0, min(9.0, ph))
        turbidity = max(0, min(20, turbidity))
        oxygen = max(1.0, min(15.0, oxygen))
        
        return {
            "pH": round(ph, 2),
            "Turbidity": round(turbidity, 2),
            "Dissolved_Oxygen": round(oxygen, 2),
        }

class SensorSimulator:
    """Simulates multiple water quality sensors"""
    
    # Define sensor locations with baseline water quality
    LOCATIONS = {
        "Main Treatment Plant": SensorLocation(
            name="Main Treatment Plant",
            ph_baseline=7.2,
            turbidity_baseline=2.0,
            oxygen_baseline=8.5,
            anomaly_probability=0.05,
        ),
        "Secondary Plant": SensorLocation(
            name="Secondary Plant",
            ph_baseline=7.0,
            turbidity_baseline=3.0,
            oxygen_baseline=8.0,
            anomaly_probability=0.08,
        ),
        "Distribution Zone A": SensorLocation(
            name="Distribution Zone A",
            ph_baseline=7.3,
            turbidity_baseline=2.5,
            oxygen_baseline=7.8,
            anomaly_probability=0.1,
        ),
        "Distribution Zone B": SensorLocation(
            name="Distribution Zone B",
            ph_baseline=7.1,
            turbidity_baseline=3.5,
            oxygen_baseline=7.5,
            anomaly_probability=0.12,
        ),
        "Monitoring Point X": SensorLocation(
            name="Monitoring Point X",
            ph_baseline=6.9,
            turbidity_baseline=4.0,
            oxygen_baseline=7.2,
            anomaly_probability=0.15,
        ),
    }
    
    def __init__(self, backend_url="http://localhost:5000", interval=10):
        """
        Initialize simulator
        
        Args:
            backend_url: Backend API URL
            interval: Seconds between readings
        """
        self.backend_url = backend_url
        self.interval = interval
        self.reading_count = 0
        self.anomaly_count = 0
        self.error_count = 0
    
    def send_reading(self, location_name, reading):
        """Send a sensor reading to the backend"""
        payload = {
            **reading,
            "location": location_name,
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/ml-predictions/predict",
                json=payload,
                timeout=5,
            )
            
            if response.status_code == 201:
                data = response.json()
                prediction = data.get('prediction', {})
                risk_level = prediction.get('riskLevel', 'unknown').upper()
                confidence = prediction.get('confidence', 0)
                
                # Color code output based on risk
                if risk_level == 'HIGH':
                    color = RED
                elif risk_level == 'MEDIUM':
                    color = YELLOW
                else:
                    color = GREEN
                
                anomaly_marker = " [ANOMALY]" if hasattr(self, '_current_anomaly') and self._current_anomaly else ""
                
                print(
                    f"{color}✓{RESET} {location_name:25} "
                    f"pH:{reading['pH']:5.1f} Turbidity:{reading['Turbidity']:5.1f} O2:{reading['Dissolved_Oxygen']:5.1f} "
                    f"→ {color}{risk_level}{RESET} ({confidence}%){anomaly_marker}"
                )
                
                self.reading_count += 1
                return True
            else:
                print(f"{RED}✗{RESET} {location_name}: Status {response.status_code}")
                self.error_count += 1
                return False
                
        except Exception as e:
            print(f"{RED}✗{RESET} {location_name}: {str(e)}")
            self.error_count += 1
            return False
    
    def run(self, duration=None, max_readings=None):
        """
        Run the simulator
        
        Args:
            duration: Run for N seconds (None = infinite)
            max_readings: Stop after N readings (None = infinite)
        """
        print(f"\n{BLUE}{'='*80}{RESET}")
        print(f"{BLUE}SmartHealth IoT Sensor Simulator{RESET}")
        print(f"{BLUE}{'='*80}{RESET}")
        print(f"Backend URL: {self.backend_url}")
        print(f"Update Interval: {self.interval}s")
        print(f"Locations: {len(self.LOCATIONS)}")
        print(f"{BLUE}{'='*80}{RESET}\n")
        
        start_time = time.time()
        
        try:
            while True:
                # Check stopping conditions
                if max_readings and self.reading_count >= max_readings:
                    break
                if duration and (time.time() - start_time) >= duration:
                    break
                
                # Send reading from each location
                for location_name, sensor in self.LOCATIONS.items():
                    # Randomly trigger anomalies
                    anomaly = random.random() < sensor.anomaly_probability
                    self._current_anomaly = anomaly
                    
                    if anomaly:
                        self.anomaly_count += 1
                    
                    reading = sensor.get_reading(anomaly=anomaly)
                    self.send_reading(location_name, reading)
                
                # Wait for next reading cycle
                print(f"{BLUE}[{datetime.now().strftime('%H:%M:%S')}] Waiting {self.interval}s until next update...{RESET}")
                time.sleep(self.interval)
                
        except KeyboardInterrupt:
            print(f"\n{YELLOW}Simulator stopped by user{RESET}")
        
        self.print_summary()
    
    def print_summary(self):
        """Print simulation summary statistics"""
        print(f"\n{BLUE}{'='*80}{RESET}")
        print(f"{BLUE}Simulation Summary{RESET}")
        print(f"{BLUE}{'='*80}{RESET}")
        print(f"Total Readings: {self.reading_count}")
        print(f"Anomalies Detected: {self.anomaly_count}")
        print(f"Errors: {self.error_count}")
        if self.reading_count > 0:
            success_rate = ((self.reading_count - self.error_count) / self.reading_count) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        print(f"{BLUE}{'='*80}{RESET}\n")

def main():
    parser = argparse.ArgumentParser(
        description="SmartHealth IoT Sensor Simulator"
    )
    parser.add_argument(
        "--backend-url",
        default="http://localhost:5000",
        help="Backend API URL (default: http://localhost:5000)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=10,
        help="Seconds between sensor readings (default: 10)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        help="Run for N seconds then stop",
    )
    parser.add_argument(
        "--max-readings",
        type=int,
        help="Stop after N readings",
    )
    
    args = parser.parse_args()
    
    simulator = SensorSimulator(
        backend_url=args.backend_url,
        interval=args.interval,
    )
    
    simulator.run(duration=args.duration, max_readings=args.max_readings)

if __name__ == "__main__":
    main()
