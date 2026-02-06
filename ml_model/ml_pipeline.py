#!/usr/bin/env python3
"""
Production-ready ML pipeline for water-borne disease outbreak prediction.

Handles:
- Data loading and validation
- Preprocessing and feature engineering
- Model training with class imbalance handling
- Evaluation and metrics
- Model persistence
- Single and batch predictions
"""

import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)
import joblib
import logging
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_DIR, 'data')
MODELS_DIR = os.path.join(PROJECT_DIR, 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

# File paths
DATA_FILE = os.path.join(DATA_DIR, 'sample_water_disease_data.csv')
MODEL_FILE = os.path.join(MODELS_DIR, 'disease_model.pkl')
SCALER_FILE = os.path.join(MODELS_DIR, 'scaler.pkl')
METADATA_FILE = os.path.join(MODELS_DIR, 'metadata.json')


class MLPipeline:
    """Production ML pipeline for disease outbreak prediction."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.metrics = {}
        self.class_weights = None
        logger.info("ML Pipeline initialized")

    def load_data(self, filepath):
        """Load and validate data."""
        logger.info(f"Loading data from {filepath}")
        df = pd.read_csv(filepath)
        logger.info(f"Data shape: {df.shape}")
        logger.info(f"Columns: {list(df.columns)}")
        logger.info(f"Data types:\n{df.dtypes}")
        logger.info(f"Missing values:\n{df.isnull().sum()}")
        return df

    def preprocess(self, df):
        """
        Data preprocessing pipeline:
        1. Handle missing values
        2. Create features
        3. Prepare target
        """
        logger.info("Starting data preprocessing")
        df = df.copy()

        # Handle missing values with median imputation for numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if df[col].isnull().sum() > 0:
                median_val = df[col].median()
                df[col].fillna(median_val, inplace=True)
                logger.info(f"Imputed {col} with median: {median_val}")

        # Ensure we have required columns for features
        # If pH is missing, use a default safe value
        if 'pH' not in df.columns:
            df['pH'] = 7.0
            logger.warning("pH column not found, using default value 7.0")

        # If Turbidity is missing, use a default value
        if 'Turbidity' not in df.columns:
            df['Turbidity'] = 5.0
            logger.warning("Turbidity column not found, using default value 5.0")

        # If Dissolved_Oxygen is missing, use a default value
        if 'Dissolved_Oxygen' not in df.columns:
            df['Dissolved_Oxygen'] = 6.0
            logger.warning("Dissolved_Oxygen column not found, using default value 6.0")

        # Feature engineering
        # 1. Contamination flag (high turbidity indicates potential contamination)
        df['contamination_flag'] = (df['Turbidity'] > 10).astype(int)

        # 2. Seasonality (if date available, extract month for seasonal pattern)
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['month'] = df['date'].dt.month
            # Seasonal indicator: rainy seasons (Jun-Oct in tropics) have higher risk
            df['seasonality'] = df['month'].isin([6, 7, 8, 9, 10]).astype(int)
        else:
            df['seasonality'] = 0

        # 3. Case density (if case_count available)
        if 'case_count' in df.columns:
            df['case_density'] = df['case_count'] > df['case_count'].median()
            df['case_density'] = df['case_density'].astype(int)
        else:
            df['case_density'] = 0

        logger.info("Feature engineering complete")
        logger.info(f"Features created: contamination_flag, seasonality, case_density")
        return df

    def prepare_features_and_target(self, df):
        """Prepare feature matrix and target variable."""
        # Features
        feature_cols = ['pH', 'Turbidity', 'Dissolved_Oxygen',
                       'contamination_flag', 'case_density', 'seasonality']
        X = df[feature_cols].copy()
        
        # Target: outcome or risk_level
        # Try different possible target column names
        target_col = None
        for col in ['outcome', 'risk_level', 'Risk_Level', 'outbreak', 'Outbreak']:
            if col in df.columns:
                target_col = col
                break

        if target_col is None:
            # Create synthetic target based on heuristics if not available
            logger.warning("No target column found, creating synthetic target")
            # High risk if: high turbidity + case density
            y = ((df['Turbidity'] > 10) & (df.get('case_count', 0) > 50)).astype(int)
        else:
            y = df[target_col].copy()
            # Convert categorical target to binary/multiclass if needed
            if y.dtype == 'object':
                # Map string labels to integers
                unique_vals = y.unique()
                label_map = {val: idx for idx, val in enumerate(sorted(unique_vals))}
                y = y.map(label_map)
                logger.info(f"Target mapping: {label_map}")

        logger.info(f"Features shape: {X.shape}")
        logger.info(f"Target shape: {y.shape}")
        logger.info(f"Target distribution:\n{y.value_counts()}")

        self.feature_names = feature_cols
        return X, y

    def handle_class_imbalance(self, y):
        """Calculate class weights for imbalanced data."""
        # Calculate class distribution
        unique, counts = np.unique(y, return_counts=True)
        distribution = dict(zip(unique, counts))
        logger.info(f"Class distribution: {distribution}")

        # Calculate imbalance ratio
        min_count = min(counts)
        max_count = max(counts)
        imbalance_ratio = max_count / min_count
        logger.info(f"Imbalance ratio: {imbalance_ratio:.2f}")

        # Use balanced class weights if significant imbalance
        if imbalance_ratio > 1.5:
            logger.info("Significant class imbalance detected, using balanced weights")
            self.class_weights = 'balanced'
        else:
            self.class_weights = None
            logger.info("Class distribution is balanced")

    def train(self, X, y):
        """Train the model with proper splits and evaluation."""
        logger.info("Starting model training")

        # Handle class imbalance
        self.handle_class_imbalance(y)

        # Train/test split with stratification
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=0.2,
            random_state=42,
            stratify=y
        )

        logger.info(f"Train set: {X_train.shape}, Test set: {X_test.shape}")
        logger.info(f"Train target distribution: {np.bincount(y_train.astype(int))}")
        logger.info(f"Test target distribution: {np.bincount(y_test.astype(int))}")

        # Feature scaling
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train Random Forest with class balancing
        logger.info("Training RandomForestClassifier")
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            class_weight=self.class_weights,
            n_jobs=-1,
            verbose=0
        )
        self.model.fit(X_train_scaled, y_train)
        logger.info("Model training complete")

        # Evaluate
        self._evaluate(X_train_scaled, y_train, X_test_scaled, y_test)

        return self.model

    def _evaluate(self, X_train, y_train, X_test, y_test):
        """Evaluate model on train and test sets."""
        logger.info("Evaluating model")

        # Predictions
        y_train_pred = self.model.predict(X_train)
        y_test_pred = self.model.predict(X_test)

        # Calculate metrics
        train_acc = accuracy_score(y_train, y_train_pred)
        test_acc = accuracy_score(y_test, y_test_pred)
        test_precision = precision_score(y_test, y_test_pred, average='weighted', zero_division=0)
        test_recall = recall_score(y_test, y_test_pred, average='weighted', zero_division=0)
        test_f1 = f1_score(y_test, y_test_pred, average='weighted', zero_division=0)

        self.metrics = {
            'train_accuracy': float(train_acc),
            'test_accuracy': float(test_acc),
            'test_precision': float(test_precision),
            'test_recall': float(test_recall),
            'test_f1': float(test_f1),
            'training_samples': len(y_train),
            'test_samples': len(y_test),
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"Train Accuracy: {train_acc:.4f}")
        logger.info(f"Test Accuracy: {test_acc:.4f}")
        logger.info(f"Test Precision (weighted): {test_precision:.4f}")
        logger.info(f"Test Recall (weighted): {test_recall:.4f}")
        logger.info(f"Test F1-Score (weighted): {test_f1:.4f}")

        # Confusion matrix
        cm = confusion_matrix(y_test, y_test_pred)
        logger.info(f"Confusion Matrix:\n{cm}")

        # Classification report
        report = classification_report(y_test, y_test_pred, zero_division=0)
        logger.info(f"Classification Report:\n{report}")

    def save_model(self):
        """Save model and preprocessing objects."""
        if self.model is None:
            logger.error("No model to save. Train model first.")
            return False

        try:
            # Save model
            joblib.dump(self.model, MODEL_FILE)
            logger.info(f"Model saved to {MODEL_FILE}")

            # Save scaler
            joblib.dump(self.scaler, SCALER_FILE)
            logger.info(f"Scaler saved to {SCALER_FILE}")

            # Save metadata
            metadata = {
                'feature_names': self.feature_names,
                'metrics': self.metrics,
                'class_weights': str(self.class_weights),
                'trained_at': datetime.now().isoformat(),
                'model_type': 'RandomForestClassifier',
                'n_estimators': self.model.n_estimators
            }
            with open(METADATA_FILE, 'w') as f:
                json.dump(metadata, f, indent=2)
            logger.info(f"Metadata saved to {METADATA_FILE}")

            return True
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False

    def load_model(self):
        """Load trained model and preprocessing objects."""
        try:
            if not os.path.exists(MODEL_FILE):
                logger.error(f"Model file not found: {MODEL_FILE}")
                return False

            self.model = joblib.load(MODEL_FILE)
            self.scaler = joblib.load(SCALER_FILE)
            
            if os.path.exists(METADATA_FILE):
                with open(METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
                    self.feature_names = metadata.get('feature_names')
                    self.metrics = metadata.get('metrics', {})
                    logger.info(f"Loaded metrics: {self.metrics}")

            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False

    def predict(self, data_dict):
        """
        Make prediction for a single sample.

        Args:
            data_dict: Dict with keys: pH, Turbidity, Dissolved_Oxygen, 
                      (optional) contamination_flag, case_density, seasonality

        Returns:
            dict: {risk: 'LOW'|'MEDIUM'|'HIGH', confidence: float, 
                   probabilities: dict}
        """
        if self.model is None or self.scaler is None:
            return {
                'risk': None,
                'confidence': 0,
                'error': 'Model not loaded'
            }

        try:
            # Extract features
            features = []
            for feat in self.feature_names:
                if feat in data_dict:
                    features.append(float(data_dict[feat]))
                else:
                    # Default values
                    defaults = {
                        'contamination_flag': 0,
                        'case_density': 0,
                        'seasonality': 0
                    }
                    features.append(defaults.get(feat, 0))

            # Convert to numpy array and scale
            X = np.array([features])
            X_scaled = self.scaler.transform(X)

            # Get prediction and probabilities
            pred_class = self.model.predict(X_scaled)[0]
            pred_proba = self.model.predict_proba(X_scaled)[0]

            # Map class to risk level
            class_names = sorted(self.model.classes_)
            risk_levels = ['LOW', 'MEDIUM', 'HIGH']
            risk_label = risk_levels[pred_class] if pred_class < len(risk_levels) else 'UNKNOWN'

            # Confidence is probability of predicted class
            confidence = float(pred_proba[pred_class]) * 100

            # Build probabilities dict
            probabilities = {}
            for idx, prob in enumerate(pred_proba):
                if idx < len(risk_levels):
                    probabilities[risk_levels[idx]] = float(prob) * 100

            return {
                'risk': risk_label,
                'confidence': confidence,
                'probabilities': probabilities,
                'features_used': self.feature_names
            }

        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return {
                'risk': None,
                'confidence': 0,
                'error': str(e)
            }

    def predict_batch(self, data_list):
        """Make predictions for multiple samples."""
        results = []
        for data in data_list:
            result = self.predict(data)
            results.append(result)
        return results

    def get_feature_importance(self):
        """Get feature importance scores."""
        if self.model is None:
            return {}

        importances = self.model.feature_importances_
        importance_dict = dict(zip(self.feature_names, importances))
        # Sort by importance
        importance_dict = dict(sorted(importance_dict.items(), 
                                     key=lambda x: x[1], 
                                     reverse=True))
        return importance_dict


def main():
    """Main training pipeline."""
    logger.info("=" * 60)
    logger.info("SmartHealth ML Pipeline")
    logger.info("=" * 60)

    # Initialize pipeline
    pipeline = MLPipeline()

    # Load data
    if not os.path.exists(DATA_FILE):
        logger.error(f"Data file not found: {DATA_FILE}")
        return False

    df = pipeline.load_data(DATA_FILE)

    # Preprocess
    df = pipeline.preprocess(df)

    # Prepare features and target
    X, y = pipeline.prepare_features_and_target(df)

    # Train model
    pipeline.train(X, y)

    # Save model
    pipeline.save_model()

    # Get feature importance
    importance = pipeline.get_feature_importance()
    logger.info("Feature Importance:")
    for feat, imp in importance.items():
        logger.info(f"  {feat}: {imp:.4f}")

    logger.info("=" * 60)
    logger.info("Training complete!")
    logger.info("=" * 60)

    return True


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
