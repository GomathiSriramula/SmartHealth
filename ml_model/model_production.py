"""
Production-ready ML model for water-borne disease outbreak prediction.

Features:
- Comprehensive data cleaning (missing values, outliers)
- Feature scaling for better model performance
- Train/validation/test split with stratification
- Detailed evaluation metrics and reporting
- Persistent model and preprocessing objects via joblib
- Single and batch prediction capabilities
- Minimal logging for debugging
"""

import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import joblib
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DiseaseOutbreakModel:
    """Production-ready ML model for outbreak risk prediction."""
    
    def __init__(self, model_path='./models/disease_model.pkl'):
        self.model_path = model_path
        self.model = None
        self.scaler = None
        self.feature_names = ['pH', 'Turbidity', 'Dissolved_Oxygen']
        self.risk_thresholds = {'Low': 50, 'High': 200}
        self.eval_metrics = {}
        logger.info(f"Model initialized - Path: {model_path}")
        
    def prepare_data(self, df):
        """Prepare and clean the dataset with comprehensive data cleaning."""
        logger.info("🧹 Starting data cleaning process...")
        
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
        
        # Remove completely empty rows
        initial_rows = len(df)
        df = df.dropna(how='all')
        logger.info(f"   Removed {initial_rows - len(df)} completely empty rows")
        
        # Numeric columns to clean
        numeric_cols = ['pH', 'Turbidity', 'Dissolved_Oxygen', 'Diarrheal_Cases']
        
        logger.info(f"   Initial dataset shape: {df.shape}")
        missing_summary = df[numeric_cols].isnull().sum()
        if missing_summary.sum() > 0:
            logger.info(f"   Missing values before cleaning:\n{missing_summary}")
        
        # Handle missing values using multiple strategies
        for col in numeric_cols:
            if col in df.columns:
                initial_missing = df[col].isnull().sum()
                
                # Remove outliers using IQR method
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outlier_count = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
                df.loc[(df[col] < lower_bound) | (df[col] > upper_bound), col] = np.nan
                
                # Fill missing values with median
                median_val = df[col].median()
                df[col].fillna(median_val, inplace=True)
                
                logger.info(f"   ✓ {col:20s} | Median: {median_val:8.2f} | Missing: {initial_missing} | Outliers: {outlier_count}")
        
        # Drop rows with any remaining missing values in feature columns
        rows_before = len(df)
        df = df.dropna(subset=self.feature_names + ['Diarrheal_Cases'])
        rows_dropped = rows_before - len(df)
        
        logger.info(f"   Final dataset shape: {df.shape} (dropped {rows_dropped} rows)")
        
        return df
    
    def create_risk_label(self, cases):
        """Create risk labels based on diarrheal cases."""
        if cases < self.risk_thresholds['Low']:
            return 'Low'
        elif cases < self.risk_thresholds['High']:
            return 'Medium'
        else:
            return 'High'
    
    def train(self, csv_path, save_model=True):
        """
        Train the model on the dataset with comprehensive evaluation.
        
        Args:
            csv_path (str): Path to CSV file with training data
            save_model (bool): Whether to save model and preprocessing objects
            
        Returns:
            RandomForestClassifier: Trained model
        """
        logger.info("="*80)
        logger.info("🎓 SmartHealth ML Model Training Pipeline (Production)")
        logger.info("="*80)
        
        # Load dataset
        logger.info(f"📊 Loading dataset from {csv_path}")
        df = pd.read_csv(csv_path)
        logger.info(f"   Loaded: {df.shape[0]} rows × {df.shape[1]} columns")
        
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
        
        logger.info(f"\n📈 Data Preparation:")
        logger.info(f"   Features: {self.feature_names}")
        logger.info(f"   Target distribution:")
        for risk_level, count in y.value_counts().items():
            pct = 100 * count / len(y)
            logger.info(f"      {risk_level:10s}: {count:4d} samples ({pct:5.1f}%)")
        
        # Split data with stratification
        logger.info(f"\n✂️  Data Splitting (Stratified):")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        X_train, X_val, y_train, y_val = train_test_split(
            X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
        )
        
        logger.info(f"   Training set:   {X_train.shape[0]} samples (60%)")
        logger.info(f"   Validation set: {X_val.shape[0]} samples (20%)")
        logger.info(f"   Test set:       {X_test.shape[0]} samples (20%)")
        
        # Feature scaling
        logger.info(f"\n📊 Feature Scaling (StandardScaler):")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        logger.info(f"   Scaling applied to all features")
        logger.info(f"   Feature statistics (scaled):")
        for i, feat in enumerate(self.feature_names):
            logger.info(f"      {feat:20s} | Mean: {X_train_scaled[:, i].mean():7.3f} | Std: {X_train_scaled[:, i].std():7.3f}")
        
        # Train Random Forest
        logger.info(f"\n🤖 Training Random Forest Classifier:")
        logger.info(f"   n_estimators=100, max_depth=15, min_samples_split=5")
        
        self.model = RandomForestClassifier(
            n_estimators=100, 
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train_scaled, y_train)
        logger.info(f"   ✓ Model training complete")
        
        # Make predictions
        y_train_pred = self.model.predict(X_train_scaled)
        y_val_pred = self.model.predict(X_val_scaled)
        y_test_pred = self.model.predict(X_test_scaled)
        
        # Evaluate
        logger.info(f"\n📊 Model Evaluation Metrics:")
        logger.info(f"\n{'Dataset':<15} {'Accuracy':<12} {'Precision':<12} {'Recall':<12} {'F1-Score':<12}")
        logger.info("-" * 63)
        
        # Training metrics
        self.eval_metrics['train'] = {
            'accuracy': accuracy_score(y_train, y_train_pred),
            'precision': precision_score(y_train, y_train_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_train, y_train_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_train, y_train_pred, average='weighted', zero_division=0)
        }
        
        # Validation metrics
        self.eval_metrics['validation'] = {
            'accuracy': accuracy_score(y_val, y_val_pred),
            'precision': precision_score(y_val, y_val_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_val, y_val_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_val, y_val_pred, average='weighted', zero_division=0)
        }
        
        # Test metrics
        self.eval_metrics['test'] = {
            'accuracy': accuracy_score(y_test, y_test_pred),
            'precision': precision_score(y_test, y_test_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_test, y_test_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_test, y_test_pred, average='weighted', zero_division=0)
        }
        
        # Print metrics table
        for dataset_name in ['train', 'validation', 'test']:
            metrics = self.eval_metrics[dataset_name]
            logger.info(f"{dataset_name.upper():<15} {metrics['accuracy']:<12.4f} {metrics['precision']:<12.4f} {metrics['recall']:<12.4f} {metrics['f1']:<12.4f}")
        
        # Detailed classification report
        logger.info(f"\n📋 Detailed Classification Report (Test Set):")
        logger.info(f"\n{classification_report(y_test, y_test_pred)}")
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_test_pred)
        logger.info(f"🎯 Confusion Matrix (Test Set):")
        logger.info(f"{cm}")
        
        # Feature importance
        logger.info(f"\n🔍 Feature Importance (Random Forest):")
        for feat, importance in self.get_feature_importance():
            bar = "█" * int(importance * 50)
            logger.info(f"   {feat:20s} {bar} {importance:.4f}")
        
        # Save models
        if save_model:
            os.makedirs(os.path.dirname(self.model_path) or '.', exist_ok=True)
            
            # Save model
            joblib.dump(self.model, self.model_path)
            logger.info(f"\n✅ Model saved: {self.model_path}")
            
            # Save scaler
            scaler_path = self.model_path.replace('.pkl', '_scaler.joblib')
            joblib.dump(self.scaler, scaler_path)
            logger.info(f"✅ Scaler saved: {scaler_path}")
            
            # Save metrics
            metrics_path = self.model_path.replace('.pkl', '_metrics.joblib')
            joblib.dump(self.eval_metrics, metrics_path)
            logger.info(f"✅ Metrics saved: {metrics_path}")
            
            # Save features
            features_path = self.model_path.replace('.pkl', '_features.joblib')
            joblib.dump(self.feature_names, features_path)
            logger.info(f"✅ Features saved: {features_path}")
        
        logger.info(f"\n{'='*80}")
        logger.info(f"✅ Training Pipeline Complete!")
        logger.info(f"{'='*80}\n")
        
        return self.model
    
    def load_model(self):
        """Load a trained model and all preprocessing objects."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        
        # Load model
        self.model = joblib.load(self.model_path)
        logger.info(f"✅ Model loaded from {self.model_path}")
        
        # Load scaler
        scaler_path = self.model_path.replace('.pkl', '_scaler.joblib')
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)
            logger.info(f"✅ Scaler loaded")
        
        # Load metrics
        metrics_path = self.model_path.replace('.pkl', '_metrics.joblib')
        if os.path.exists(metrics_path):
            self.eval_metrics = joblib.load(metrics_path)
        
        # Load features
        features_path = self.model_path.replace('.pkl', '_features.joblib')
        if os.path.exists(features_path):
            self.feature_names = joblib.load(features_path)
        
        return self.model
    
    def predict(self, pH, turbidity, dissolved_oxygen):
        """
        Make a single prediction.
        
        Args:
            pH (float): pH level of water
            turbidity (float): Turbidity in NTU
            dissolved_oxygen (float): Dissolved oxygen in mg/L
            
        Returns:
            dict: risk_label, confidence, probabilities
        """
        if self.model is None:
            self.load_model()
        
        # Create DataFrame
        X = pd.DataFrame(
            [[pH, turbidity, dissolved_oxygen]], 
            columns=self.feature_names
        )
        
        # Scale if scaler is available
        if self.scaler is not None:
            X_scaled = self.scaler.transform(X)
        else:
            X_scaled = X.values
        
        # Predict
        prediction = self.model.predict(X_scaled)[0]
        probabilities = self.model.predict_proba(X_scaled)[0]
        confidence = max(probabilities) * 100
        
        # Class mapping
        class_order = self.model.classes_
        prob_dict = {cls: prob * 100 for cls, prob in zip(class_order, probabilities)}
        
        logger.info(f"Prediction: pH={pH}, Turbidity={turbidity}, DO={dissolved_oxygen} → {prediction} ({confidence:.2f}%)")
        
        return {
            'risk_label': prediction,
            'confidence': round(confidence, 2),
            'probabilities': {cls: round(prob, 2) for cls, prob in prob_dict.items()}
        }
    
    def predict_batch(self, sensor_readings):
        """
        Make predictions for multiple sensor readings.
        
        Args:
            sensor_readings (list): List of dicts with pH, turbidity, conductivity
            
        Returns:
            list: Predictions with risk_label and confidence
        """
        if self.model is None:
            self.load_model()
        
        # Convert to DataFrame
        df = pd.DataFrame(sensor_readings)
        
        # Prepare features
        X = pd.DataFrame({
            'pH': df['pH'],
            'Turbidity': df.get('turbidity', 0),
            'Dissolved_Oxygen': df.get('conductivity', 0) / 100
        })
        
        # Scale if scaler is available
        if self.scaler is not None:
            X_scaled = self.scaler.transform(X)
        else:
            X_scaled = X.values
        
        # Predict
        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)
        
        results = []
        class_order = self.model.classes_
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            prob_dict = {cls: float(p * 100) for cls, p in zip(class_order, prob)}
            results.append({
                'index': i,
                'sensor_id': sensor_readings[i].get('sensor_id', f'unknown-{i}'),
                'risk_label': pred,
                'confidence': round(float(max(prob) * 100), 2),
                'probabilities': prob_dict,
                'lat': sensor_readings[i].get('lat'),
                'lng': sensor_readings[i].get('lng'),
                'reading_at': sensor_readings[i].get('reading_at')
            })
        
        logger.info(f"Batch prediction: {len(results)} records processed")
        return results
    
    def get_feature_importance(self):
        """Get feature importance from the model."""
        if self.model is None:
            self.load_model()
        
        importance = dict(zip(self.feature_names, self.model.feature_importances_))
        return sorted(importance.items(), key=lambda x: x[1], reverse=True)


# Example usage
if __name__ == "__main__":
    model = DiseaseOutbreakModel()
    
    try:
        model.load_model()
        
        # Test single prediction
        result = model.predict(pH=6.5, turbidity=8.0, dissolved_oxygen=5.0)
        print(f"\n🔮 Test Prediction:")
        print(f"   Risk Level: {result['risk_label']}")
        print(f"   Confidence: {result['confidence']:.2f}%")
        print(f"   Probabilities: {result['probabilities']}")
        
    except FileNotFoundError:
        print("⚠️  No trained model found. Please train the model first.")
