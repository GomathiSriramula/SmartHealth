"""
Simple ML training script for water quality disease prediction
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix
import joblib
import os

print("\n" + "="*80)
print("🎓 SmartHealth ML Model Training - Simple Version")
print("="*80)

# Load data
DATA_FILE = 'data/sample_water_disease_data.csv'
print(f"\n📊 Loading data from {DATA_FILE}...")
df = pd.read_csv(DATA_FILE)
print(f"   Dataset shape: {df.shape}")

# Rename columns
df.columns = ['pH', 'Turbidity', 'Dissolved_Oxygen', 'Diarrheal_Cases', 'Cholera_Cases', 'Typhoid_Cases']

# Create risk categories based on diarrheal cases
def create_risk_label(cases):
    if cases < 50:
        return 'Low'
    elif cases < 200:
        return 'Medium'
    else:
        return 'High'

df['Risk'] = df['Diarrheal_Cases'].apply(create_risk_label)

# Features and target
X = df[['pH', 'Turbidity', 'Dissolved_Oxygen']]
y = df['Risk']

print(f"\n📈 Risk Distribution:")
for risk_level, count in y.value_counts().items():
    pct = 100 * count / len(y)
    print(f"   {risk_level:10s}: {count:4d} samples ({pct:5.1f}%)")

# Split data
print(f"\n✂️  Splitting data (70% train, 30% test)...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)
print(f"   Training set:   {X_train.shape[0]} samples")
print(f"   Test set:       {X_test.shape[0]} samples")

# Scale features
print(f"\n📊 Scaling features...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train model
print(f"\n🤖 Training RandomForest Classifier...")
print(f"   Parameters: n_estimators=100, max_depth=15, random_state=42")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=15,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train_scaled, y_train)
print(f"   ✓ Training complete!")

# Predictions
y_train_pred = model.predict(X_train_scaled)
y_test_pred = model.predict(X_test_scaled)

# Evaluation
print(f"\n" + "="*80)
print("📊 MODEL PERFORMANCE METRICS")
print("="*80)

train_acc = accuracy_score(y_train, y_train_pred)
train_prec = precision_score(y_train, y_train_pred, average='weighted', zero_division=0)
train_rec = recall_score(y_train, y_train_pred, average='weighted', zero_division=0)
train_f1 = f1_score(y_train, y_train_pred, average='weighted', zero_division=0)

test_acc = accuracy_score(y_test, y_test_pred)
test_prec = precision_score(y_test, y_test_pred, average='weighted', zero_division=0)
test_rec = recall_score(y_test, y_test_pred, average='weighted', zero_division=0)
test_f1 = f1_score(y_test, y_test_pred, average='weighted', zero_division=0)

print(f"\n{'Dataset':<15} {'Accuracy':<12} {'Precision':<12} {'Recall':<12} {'F1-Score':<12}")
print("-" * 63)
print(f"{'TRAIN':<15} {train_acc:<12.4f} {train_prec:<12.4f} {train_rec:<12.4f} {train_f1:<12.4f}")
print(f"{'TEST':<15} {test_acc:<12.4f} {test_prec:<12.4f} {test_rec:<12.4f} {test_f1:<12.4f}")

print(f"\n📋 Detailed Classification Report (Test Set):")
print(classification_report(y_test, y_test_pred))

print(f"🎯 Confusion Matrix (Test Set):")
cm = confusion_matrix(y_test, y_test_pred)
print(cm)
print(f"   (Rows: True labels, Columns: Predicted labels)")
print(f"   (Order: High, Low, Medium)")

# Feature importance
print(f"\n🔍 Feature Importance:")
for feature, importance in zip(['pH', 'Turbidity', 'Dissolved_Oxygen'], model.feature_importances_):
    bar = "█" * int(importance * 50)
    print(f"   {feature:20s} {bar} {importance:.4f} ({importance*100:.1f}%)")

# Save model
os.makedirs('models', exist_ok=True)
model_file = 'models/water_quality_model.pkl'
scaler_file = 'models/water_quality_scaler.pkl'

joblib.dump(model, model_file)
joblib.dump(scaler, scaler_file)
print(f"\n💾 Model saved:")
print(f"   Model:  {model_file}")
print(f"   Scaler: {scaler_file}")

print(f"\n" + "="*80)
print("✅ TRAINING COMPLETE!")
print("="*80)
print(f"\n📊 KEY RESULTS:")
print(f"   ✓ Test Accuracy:  {test_acc*100:.2f}%")
print(f"   ✓ Test Precision: {test_prec*100:.2f}%")
print(f"   ✓ Test Recall:    {test_rec*100:.2f}%")
print(f"   ✓ Test F1-Score:  {test_f1*100:.2f}%")
print("="*80 + "\n")
