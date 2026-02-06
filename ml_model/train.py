import os
import sys
import pandas as pd
from model import DiseaseOutbreakModel

def main():
    print("\n" + "="*70)
    print("🎓 SmartHealth ML Model Training & Evaluation Pipeline")
    print("="*70)
    
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
        
        print("\n" + "="*70)
        print("✅ Training & Evaluation Complete!")
        print("="*70)
        print(f"\n📦 Model Artifacts:")
        print(f"   Model file: {model.model_path}")
        print(f"   Metrics file: {model.model_path.replace('.pkl', '_metrics.joblib')}")
        
        print(f"\n📊 Model Performance Summary:")
        if model.eval_metrics:
            test_metrics = model.eval_metrics.get('test', {})
            print(f"   Test Set Accuracy: {test_metrics.get('accuracy', 0):.4f}")
            print(f"   Test Set Precision: {test_metrics.get('precision', 0):.4f}")
            print(f"   Test Set Recall: {test_metrics.get('recall', 0):.4f}")
            print(f"   Test Set F1-Score: {test_metrics.get('f1', 0):.4f}")
        
        print(f"\n🔮 Next Steps:")
        print(f"   1. Run predictions: python predict.py")
        print(f"   2. Start monitoring: python monitor.py")
        print(f"   3. Test integration: python test_integration.py")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
