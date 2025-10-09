import os
import sys
import pandas as pd
from model import DiseaseOutbreakModel

def main():
    print("\n" + "="*60)
    print("🎓 SmartHealth ML Model Training")
    print("="*60)
    
    # Get dataset path
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    else:
        csv_path = input("\n📁 Enter path to training dataset (CSV): ").strip()
    
    if not os.path.exists(csv_path):
        print(f"\n❌ File not found: {csv_path}")
        return
    
    # Initialize model
    model = DiseaseOutbreakModel()
    
    # Train model
    try:
        model.train(csv_path, save_model=True)
        
        print("\n" + "="*60)
        print("✅ Training Complete!")
        print("="*60)
        print(f"📦 Model saved to: {model.model_path}")
        print("\n🔮 You can now run predictions using:")
        print("   python predict.py")
        print("\n📊 Or start monitoring service:")
        print("   python monitor.py")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
