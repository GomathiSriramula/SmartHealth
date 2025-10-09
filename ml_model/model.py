import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle
from datetime import datetime

class DiseaseOutbreakModel:
    def __init__(self, model_path='./models/disease_model.pkl'):
        self.model_path = model_path
        self.model = None
        self.feature_names = ['pH', 'Turbidity', 'Dissolved_Oxygen']
        
    def prepare_data(self, df):
        """Prepare and clean the dataset"""
        # Rename columns if needed
        column_mapping = {
            'pH Level': 'pH',
            'Turbidity (NTU)': 'Turbidity',
            'Dissolved Oxygen (mg/L)': 'Dissolved_Oxygen',
            'Diarrheal Cases per 100,000 people': 'Diarrheal_Cases',
            'Cholera Cases per 100,000 people': 'Cholera_Cases',
            'Typhoid Cases per 100,000 people': 'Typhoid_Cases'
        }
        df = df.rename(columns=column_mapping)
        
        # Fill missing numeric values
        numeric_cols = ['pH', 'Turbidity', 'Dissolved_Oxygen']
        for col in numeric_cols:
            if col in df.columns:
                df[col].fillna(df[col].mean(), inplace=True)
        
        return df
    
    def create_risk_label(self, cases):
        """Create risk labels based on diarrheal cases"""
        if cases < 50:
            return 'Low'
        elif cases < 200:
            return 'Medium'
        else:
            return 'High'
    
    def train(self, csv_path, save_model=True):
        """Train the model on the dataset"""
        print(f"📊 Loading dataset from {csv_path}")
        df = pd.read_csv(csv_path)
        
        print(f"   Dataset shape: {df.shape}")
        print(f"   Columns: {df.columns.tolist()}")
        
        # Prepare data
        df = self.prepare_data(df)
        
        # Create target variable
        if 'Diarrheal_Cases' in df.columns:
            df['Outbreak_Risk'] = df['Diarrheal_Cases'].apply(self.create_risk_label)
        else:
            raise ValueError("Dataset must contain 'Diarrheal_Cases' column")
        
        # Features and target
        X = df[self.feature_names]
        y = df['Outbreak_Risk']
        
        print(f"\n📈 Training model...")
        print(f"   Features: {self.feature_names}")
        print(f"   Target distribution:\n{y.value_counts()}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Train Random Forest
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.model.fit(X_train, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)
        
        print(f"\n✅ Model trained successfully!")
        print(f"   Training accuracy: {train_score:.2%}")
        print(f"   Testing accuracy: {test_score:.2%}")
        
        # Save model
        if save_model:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
            print(f"   Model saved to: {self.model_path}")
        
        return self.model
    
    def load_model(self):
        """Load a trained model"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        
        with open(self.model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        print(f"✅ Model loaded from {self.model_path}")
        return self.model
    
    def predict(self, pH, turbidity, dissolved_oxygen):
        """Make a single prediction"""
        if self.model is None:
            self.load_model()
        
        X = pd.DataFrame([[pH, turbidity, dissolved_oxygen]], 
                        columns=self.feature_names)
        
        prediction = self.model.predict(X)[0]
        probabilities = self.model.predict_proba(X)[0]
        
        # Get confidence
        confidence = max(probabilities) * 100
        
        return {
            'risk_level': prediction,
            'confidence': confidence,
            'probabilities': {
                'High': probabilities[0] * 100 if len(probabilities) > 0 else 0,
                'Low': probabilities[1] * 100 if len(probabilities) > 1 else 0,
                'Medium': probabilities[2] * 100 if len(probabilities) > 2 else 0,
            }
        }
    
    def predict_batch(self, sensor_readings):
        """Make predictions for multiple sensor readings"""
        if self.model is None:
            self.load_model()
        
        # Convert to DataFrame
        df = pd.DataFrame(sensor_readings)
        
        # Ensure required columns exist
        required_cols = ['pH', 'turbidity', 'conductivity']
        for col in required_cols:
            if col not in df.columns:
                # Try alternative names
                if col == 'conductivity':
                    df['conductivity'] = 0  # Default if not available
        
        # Prepare features (use conductivity as proxy for dissolved oxygen)
        X = pd.DataFrame({
            'pH': df['pH'],
            'Turbidity': df['turbidity'],
            'Dissolved_Oxygen': df.get('conductivity', 0) / 100  # Convert conductivity to approximate DO
        })
        
        # Make predictions
        predictions = self.model.predict(X)
        probabilities = self.model.predict_proba(X)
        
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                'index': i,
                'sensor_id': sensor_readings[i].get('sensor_id', f'unknown-{i}'),
                'risk_level': pred,
                'confidence': max(prob) * 100,
                'lat': sensor_readings[i].get('lat'),
                'lng': sensor_readings[i].get('lng'),
                'reading_at': sensor_readings[i].get('reading_at')
            })
        
        return results
    
    def get_feature_importance(self):
        """Get feature importance from the model"""
        if self.model is None:
            self.load_model()
        
        importance = dict(zip(self.feature_names, self.model.feature_importances_))
        return sorted(importance.items(), key=lambda x: x[1], reverse=True)


if __name__ == "__main__":
    # Example usage
    model = DiseaseOutbreakModel()
    
    # Train model (uncomment if you have the dataset)
    # model.train('data/water_pollution_disease.csv')
    
    # Load existing model
    try:
        model.load_model()
        
        # Make a test prediction
        result = model.predict(pH=6.5, turbidity=8.0, dissolved_oxygen=5.0)
        print(f"\n🔮 Test Prediction:")
        print(f"   Risk Level: {result['risk_level']}")
        print(f"   Confidence: {result['confidence']:.2f}%")
        print(f"   Probabilities: {result['probabilities']}")
        
    except FileNotFoundError:
        print("⚠️  No trained model found. Please train the model first.")
