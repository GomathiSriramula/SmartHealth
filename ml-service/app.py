import os
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

app = Flask(__name__)

SYMPTOMS_LIST = [
    "Diarrhea",
    "Vomiting",
    "Nausea",
    "Abdominal Pain",
    "Fever",
    "Dehydration",
    "Headache",
    "Fatigue",
    "Muscle Cramps",
    "Blood in Stool",
    "Loss of Appetite"
]

# Map of display labels for feature importances
FEATURE_LABELS = {
    "patient_age": "Patient Age",
    "sex_num": "Patient Sex",
    "severity_num": "Reporter Severity Evaluation"
}
for sym in SYMPTOMS_LIST:
    FEATURE_LABELS[f"symptom_{sym.lower()}"] = f"Symptom: {sym}"

def encode_report(age, sex, severity, symptoms):
    # Numerical age
    age_val = float(age) if age is not None else 35.0
    
    # Categorical sex
    sex_val = 0  # M
    if str(sex).upper() in ['FEMALE', 'F']:
        sex_val = 1
    elif str(sex).upper() in ['OTHER', 'O']:
        sex_val = 2
        
    # Categorical severity
    sev_map = {'mild': 0, 'moderate': 1, 'severe': 2, 'critical': 3}
    sev_val = sev_map.get(str(severity).lower().strip(), 0)
    
    # Binary symptoms
    symptom_features = []
    symptoms_lower = [s.lower().strip() for s in symptoms] if symptoms else []
    for sym in SYMPTOMS_LIST:
        has_sym = 0
        for s_report in symptoms_lower:
            if sym.lower() in s_report or s_report in sym.lower():
                has_sym = 1
                break
        symptom_features.append(has_sym)
        
    return [age_val, sex_val, sev_val] + symptom_features

def generate_synthetic_data(num_samples=1000):
    np.random.seed(42)
    data = []
    for _ in range(num_samples):
        age = np.random.randint(1, 90)
        sex = np.random.choice(['M', 'F', 'O'])
        severity = np.random.choice(['Mild', 'Moderate', 'Severe', 'Critical'], p=[0.4, 0.3, 0.2, 0.1])
        
        # Choose some random symptoms
        num_symptoms = np.random.randint(0, 5)
        symptoms = list(np.random.choice(SYMPTOMS_LIST, size=min(num_symptoms, len(SYMPTOMS_LIST)), replace=False))
        
        # Determine synthetic ground truth risk score
        score = 0
        
        # High-risk symptoms (25 points each)
        high_risk_syms = ['diarrhea', 'dehydration', 'blood in stool']
        # Medium-risk symptoms (10 points each)
        med_risk_syms = ['nausea', 'vomiting', 'abdominal pain', 'fever', 'fatigue', 'headache', 'loss of appetite']
        
        for s in symptoms:
            s_lower = s.lower()
            if any(hrs in s_lower for hrs in high_risk_syms):
                score += 25
            elif any(mrs in s_lower for mrs in med_risk_syms):
                score += 10
                
        # Severity contribution
        sev_lower = severity.lower()
        if sev_lower in ['critical', 'severe']:
            score += 40
        elif sev_lower == 'moderate':
            score += 20
            
        # Add random noise
        score += np.random.randint(-5, 6)
        score = max(0, min(100, score))
        
        # Determine label
        if score >= 70:
            label = 2  # high
        elif score >= 45:
            label = 1  # medium
        else:
            label = 0  # low
            
        data.append((age, sex, severity, symptoms, label))
        
    X = []
    y = []
    for age, sex, severity, symptoms, label in data:
        X.append(encode_report(age, sex, severity, symptoms))
        y.append(label)
        
    return np.array(X), np.array(y)

# Train the Random Forest on startup
print("[ML Startup] Generating synthetic data...")
X_data, y_data = generate_synthetic_data(1500)
X_train, X_test, y_train, y_test = train_test_split(X_data, y_data, test_size=0.2, random_state=42)

print("[ML Startup] Training Random Forest model...")
model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model.fit(X_train, y_train)

# Evaluate model
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
importances = model.feature_importances_
print(f"[ML Startup] Random Forest model training complete. Test Accuracy: {accuracy * 100:.2f}%")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "model": "Random Forest Outbreak Risk Classifier",
        "version": "random-forest-v1.0"
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True)
        age = data.get('patient_age')
        sex = data.get('sex')
        severity = data.get('severity')
        symptoms = data.get('symptoms', [])
        
        # Encode inputs
        encoded = encode_report(age, sex, severity, symptoms)
        X_input = np.array([encoded])
        
        # Predict class & probabilities
        pred_class = int(model.predict(X_input)[0])
        probabilities = model.predict_proba(X_input)[0]
        
        # Determine risk level
        risk_map = {0: 'low', 1: 'medium', 2: 'high'}
        predicted_risk = risk_map[pred_class]
        
        # Determine confidence score (probability of selected class)
        confidence_score = int(round(probabilities[pred_class] * 100))
        
        # Find contributing factors
        factors = []
        # Age check
        if age is not None and (age < 12 or age > 60):
            factors.append(("patient_age", importances[0]))
        # Severity check
        sev_lower = str(severity).lower().strip()
        if sev_lower in ['critical', 'severe', 'moderate']:
            factors.append(("severity_num", importances[2] * (2 if sev_lower in ['critical', 'severe'] else 1)))
        # Symptoms checks
        symptoms_lower = [s.lower().strip() for s in symptoms]
        for idx, sym in enumerate(SYMPTOMS_LIST):
            has_sym = 0
            for s_report in symptoms_lower:
                if sym.lower() in s_report or s_report in sym.lower():
                    has_sym = 1
                    break
            if has_sym == 1:
                factors.append((f"symptom_{sym.lower()}", importances[3 + idx]))
                
        # Sort factors by impact
        factors.sort(key=lambda x: x[1], reverse=True)
        top_factors = [FEATURE_LABELS[f[0]] for f in factors[:3]]
        
        # Fallback if no active factors found
        if not top_factors:
            top_factors = ["Default Symptom Baseline Assessment"]
            
        reasoning = (
            f"The Random Forest model predicted {predicted_risk.upper()} risk with {confidence_score}% confidence. "
            f"Primary factors driving this analysis are: {', '.join(top_factors)}."
        )
        
        return jsonify({
            "riskLevel": predicted_risk,
            "confidence": confidence_score,
            "reasoning": reasoning,
            "topFactors": top_factors,
            "modelVersion": "random-forest-v1.0"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5005))
    app.run(host='0.0.0.0', port=port)
