import os
import time
import schedule
from datetime import datetime
from dotenv import load_dotenv
from predict import PredictionService

# Load environment variables
load_dotenv()

class MonitoringService:
    def __init__(self):
        self.prediction_service = PredictionService()
        self.check_interval = int(os.getenv('CHECK_INTERVAL_SECONDS', 300))
        
    def monitor_job(self):
        """Job to run periodically"""
        print("\n" + "🔄 " * 30)
        print(f"⏰ Scheduled check at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("🔄 " * 30)
        
        try:
            self.prediction_service.run_prediction_pipeline()
        except Exception as e:
            print(f"❌ Error in monitoring job: {e}")
            import traceback
            traceback.print_exc()
        
        print(f"\n⏰ Next check in {self.check_interval} seconds...")
    
    def start(self):
        """Start the monitoring service"""
        print("\n" + "="*60)
        print("🚀 SmartHealth ML Monitoring Service Started")
        print("="*60)
        print(f"⏰ Check interval: {self.check_interval} seconds ({self.check_interval/60:.1f} minutes)")
        print(f"🔗 Backend URL: {self.prediction_service.backend_url}")
        print(f"🤖 Model: {self.prediction_service.model.model_path}")
        print("="*60)
        
        # Run immediately on start
        print("\n🔄 Running initial check...")
        self.monitor_job()
        
        # Schedule periodic checks
        schedule.every(self.check_interval).seconds.do(self.monitor_job)
        
        print(f"\n✅ Monitoring service is running...")
        print("   Press Ctrl+C to stop")
        
        # Keep running
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n🛑 Monitoring service stopped by user")
            print("="*60)


if __name__ == "__main__":
    monitor = MonitoringService()
    monitor.start()
