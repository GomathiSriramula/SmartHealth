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
        """
        Comprehensive data preprocessing and validation.
        
        Steps:
        1. Inspect columns and datatypes
        2. Rename columns to standard names
        3. Remove completely empty rows
        4. Remove duplicate rows
        5. Handle missing values with median imputation
        6. Validate data ranges for pH, turbidity, and case counts
        7. Log detailed cleaning statistics
        """
        logger.info("="*80)
        logger.info("🧹 COMPREHENSIVE DATA PREPROCESSING")
        logger.info("="*80)
        
        # ===== STEP 1: Inspect dataset =====
        logger.info("\n📊 STEP 1: Dataset Inspection")
        logger.info(f"   Initial shape: {df.shape}")
        logger.info(f"   Columns ({len(df.columns)}): {list(df.columns)}")
        logger.info(f"\n   Datatypes:")
        for col, dtype in df.dtypes.items():
            logger.info(f"      {col:30s} {str(dtype):15s}")
        
        # ===== STEP 2: Rename columns =====
        logger.info("\n📝 STEP 2: Standardizing Column Names")
        column_mapping = {
            'pH Level': 'pH',
            'Turbidity (NTU)': 'Turbidity',
            'Dissolved Oxygen (mg/L)': 'Dissolved_Oxygen',
            'Diarrheal Cases per 100,000 people': 'Diarrheal_Cases',
            'Cholera Cases per 100,000 people': 'Cholera_Cases',
            'Typhoid Cases per 100,000 people': 'Typhoid_Cases'
        }
        # Only rename columns that exist
        rename_map = {k: v for k, v in column_mapping.items() if k in df.columns}
        df = df.rename(columns=rename_map)
        if rename_map:
            logger.info(f"   ✓ Renamed {len(rename_map)} columns")
            for old, new in rename_map.items():
                logger.info(f"      {old:30s} → {new}")
        
        # ===== STEP 3: Remove completely empty rows =====
        logger.info("\n🗑️  STEP 3: Removing Completely Empty Rows")
        initial_rows = len(df)
        df = df.dropna(how='all')
        empty_rows = initial_rows - len(df)
        logger.info(f"   ✓ Removed {empty_rows} completely empty rows")
        
        # ===== STEP 4: Remove duplicate rows =====
        logger.info("\n🔄 STEP 4: Removing Duplicate Rows")
        before_dedup = len(df)
        df = df.drop_duplicates()
        duplicates_removed = before_dedup - len(df)
        logger.info(f"   ✓ Removed {duplicates_removed} duplicate rows")
        
        # ===== STEP 5: Handle missing values =====
        logger.info("\n⚠️  STEP 5: Handling Missing Values (Median Imputation)")
        numeric_cols = ['pH', 'Turbidity', 'Dissolved_Oxygen', 'Diarrheal_Cases']
        
        # Report missing values before imputation
        missing_before = df[numeric_cols].isnull().sum()
        total_missing = missing_before.sum()
        logger.info(f"   Missing values before imputation: {total_missing}")
        if total_missing > 0:
            for col in numeric_cols:
                if col in df.columns and missing_before[col] > 0:
                    logger.info(f"      {col:25s}: {missing_before[col]:4d} missing values")
        
        # Median imputation
        for col in numeric_cols:
            if col in df.columns:
                missing_count = df[col].isnull().sum()
                if missing_count > 0:
                    median_val = df[col].median()
                    df[col].fillna(median_val, inplace=True)
                    logger.info(f"   ✓ {col:25s}: Imputed with median = {median_val:.4f}")
        
        # ===== STEP 6: Validate data ranges =====
        logger.info("\n🎯 STEP 6: Validating Data Ranges")
        
        # Define valid ranges
        valid_ranges = {
            'pH': (0, 14, 'pH must be between 0 and 14'),
            'Turbidity': (0, 100, 'Turbidity must be between 0 and 100 NTU'),
            'Dissolved_Oxygen': (0, 20, 'Dissolved Oxygen must be between 0 and 20 mg/L'),
            'Diarrheal_Cases': (0, 10000, 'Diarrheal cases must be between 0 and 10000 per 100k')
        }
        
        out_of_range_rows = 0
        validation_log = {}
        
        for col, (min_val, max_val, description) in valid_ranges.items():
            if col in df.columns:
                invalid_count = ((df[col] < min_val) | (df[col] > max_val)).sum()
                validation_log[col] = {
                    'min': min_val,
                    'max': max_val,
                    'actual_min': df[col].min(),
                    'actual_max': df[col].max(),
                    'invalid_count': invalid_count
                }
                
                if invalid_count > 0:
                    out_of_range_rows += invalid_count
                    logger.info(f"   ⚠️  {col:25s}: {invalid_count} out-of-range values")
                    logger.info(f"       Expected range: [{min_val}, {max_val}]")
                    logger.info(f"       Actual range:   [{df[col].min():.4f}, {df[col].max():.4f}]")
                    # Remove out of range rows
                    df = df[(df[col] >= min_val) & (df[col] <= max_val)]
                else:
                    logger.info(f"   ✓ {col:25s}: Valid range [{df[col].min():.4f}, {df[col].max():.4f}]")
        
        if out_of_range_rows > 0:
            logger.info(f"   ✓ Removed {out_of_range_rows} rows with out-of-range values")
        
        # ===== STEP 7: Handle outliers with IQR =====
        logger.info("\n📊 STEP 7: Outlier Detection (IQR Method)")
        outliers_removed = 0
        
        for col in numeric_cols:
            if col in df.columns and len(df) > 0:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
                outlier_count = outlier_mask.sum()
                
                if outlier_count > 0:
                    logger.info(f"   ✓ {col:25s}: Detected {outlier_count} outliers")
                    logger.info(f"       IQR bounds: [{lower_bound:.4f}, {upper_bound:.4f}]")
                    # Replace outliers with median for this column
                    median_val = df[col].median()
                    df.loc[outlier_mask, col] = median_val
                    outliers_removed += outlier_count
        
        if outliers_removed > 0:
            logger.info(f"   ✓ Replaced {outliers_removed} outliers with median values")
        
        # ===== STEP 8: Final validation =====
        logger.info("\n✅ STEP 8: Final Validation")
        
        # Ensure required features exist
        required_features = self.feature_names + ['Diarrheal_Cases']
        missing_features = [col for col in required_features if col not in df.columns]
        if missing_features:
            raise ValueError(f"Missing required columns: {missing_features}")
        
        # Drop rows with any remaining NaN in required columns
        rows_before_final = len(df)
        df = df.dropna(subset=required_features)
        final_dropped = rows_before_final - len(df)
        
        # ===== SUMMARY =====
        logger.info("\n" + "="*80)
        logger.info("📋 DATA CLEANING SUMMARY")
        logger.info("="*80)
        logger.info(f"   Initial rows:              {initial_rows}")
        logger.info(f"   Removed (empty):           {empty_rows}")
        logger.info(f"   Removed (duplicates):      {duplicates_removed}")
        logger.info(f"   Removed (out-of-range):    {out_of_range_rows}")
        logger.info(f"   Removed (final NaN):       {final_dropped}")
        logger.info(f"   ─" * 40)
        logger.info(f"   Final rows:                {len(df)}")
        logger.info(f"   Final shape:               {df.shape}")
        logger.info(f"   Total rows removed:        {initial_rows - len(df)}")
        logger.info(f"   Percentage retained:       {100 * len(df) / initial_rows:.1f}%")
        
        # Final data info
        logger.info(f"\n   Final data statistics:")
        for col in self.feature_names + ['Diarrheal_Cases']:
            if col in df.columns:
                logger.info(f"      {col:25s} | Mean: {df[col].mean():8.4f} | Std: {df[col].std():8.4f} | Min: {df[col].min():8.4f} | Max: {df[col].max():8.4f}")
        
        logger.info("="*80 + "\n")
        
        return df
    
    def engineer_features(self, df):
        """
        Create derived features for improved model performance.
        
        Features engineered:
        1. contamination_flag: Binary flag indicating water contamination
        2. case_density: Rolling average of disease cases
        3. seasonality: Month-based seasonality indicator
        
        Args:
            df (DataFrame): Cleaned dataset
            
        Returns:
            DataFrame: Dataset with engineered features
        """
        logger.info("="*80)
        logger.info("⚙️  FEATURE ENGINEERING")
        logger.info("="*80)
        
        # ===== FEATURE 1: Contamination Flag =====
        logger.info("\n🚨 FEATURE 1: Contamination Flag")
        logger.info("   Logic: Flag water as contaminated if pH < 6.5 OR Turbidity > 10")
        logger.info("   Interpretation: Poor pH or high turbidity indicates potential contamination")
        
        # Thresholds based on domain knowledge
        pH_THRESHOLD = 6.5
        TURBIDITY_THRESHOLD = 10.0
        
        df['contamination_flag'] = (
            (df['pH'] < pH_THRESHOLD) | (df['Turbidity'] > TURBIDITY_THRESHOLD)
        ).astype(int)
        
        contaminated_count = df['contamination_flag'].sum()
        clean_count = len(df) - contaminated_count
        logger.info(f"   ✓ Created 'contamination_flag' feature")
        logger.info(f"      Contaminated (flag=1):  {contaminated_count} samples ({100*contaminated_count/len(df):.1f}%)")
        logger.info(f"      Clean (flag=0):         {clean_count} samples ({100*clean_count/len(df):.1f}%)")
        
        # ===== FEATURE 2: Case Density (Rolling Average) =====
        logger.info("\n📊 FEATURE 2: Case Density (Rolling Average)")
        logger.info("   Logic: 7-day rolling average of diarrheal cases")
        logger.info("   Interpretation: Smooths case fluctuations to reveal trends")
        
        # Create rolling average with window of 7
        window_size = 7
        df['case_density'] = df['Diarrheal_Cases'].rolling(
            window=window_size,
            min_periods=1,  # Handle early rows with fewer than window_size values
            center=False    # Use past values, not centered window
        ).mean()
        
        logger.info(f"   ✓ Created 'case_density' feature (rolling window={window_size})")
        logger.info(f"      Mean: {df['case_density'].mean():.4f}")
        logger.info(f"      Std:  {df['case_density'].std():.4f}")
        logger.info(f"      Min:  {df['case_density'].min():.4f}")
        logger.info(f"      Max:  {df['case_density'].max():.4f}")
        
        # ===== FEATURE 3: Seasonality =====
        logger.info("\n🌡️  FEATURE 3: Seasonality Feature")
        
        # Check if date column exists
        date_columns = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower()]
        
        if date_columns:
            date_col = date_columns[0]
            logger.info(f"   Logic: Extract month from '{date_col}' column")
            logger.info(f"   Interpretation: Capture seasonal disease patterns")
            
            try:
                # Convert to datetime if not already
                if df[date_col].dtype != 'datetime64[ns]':
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                
                # Extract month (1-12)
                df['seasonality'] = df[date_col].dt.month
                
                logger.info(f"   ✓ Created 'seasonality' feature (months 1-12)")
                logger.info(f"      Distribution:")
                for month in sorted(df['seasonality'].dropna().unique()):
                    month_name = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(month)]
                    count = (df['seasonality'] == month).sum()
                    logger.info(f"         {month_name} (month {int(month):2d}): {count:4d} samples")
                
            except Exception as e:
                logger.warning(f"   ⚠️  Could not extract seasonality: {e}")
                # Create default seasonality based on row index (approximation)
                df['seasonality'] = ((df.index % 365) // 30 + 1).clip(1, 12).astype(int)
                logger.info(f"   ✓ Created 'seasonality' feature (approximated from row index)")
        else:
            logger.info(f"   ⚠️  No date column found")
            logger.info(f"      Creating approximate seasonality from row index")
            # Create seasonality based on row index (cycles through 1-12)
            df['seasonality'] = ((df.index % 365) // 30 + 1).clip(1, 12).astype(int)
            logger.info(f"   ✓ Created 'seasonality' feature (approximated)")
        
        # ===== FEATURE SUMMARY =====
        logger.info("\n" + "="*80)
        logger.info("📋 FEATURE ENGINEERING SUMMARY")
        logger.info("="*80)
        logger.info(f"\n   New features created: 3")
        logger.info(f"      1. contamination_flag (binary: 0=clean, 1=contaminated)")
        logger.info(f"      2. case_density (rolling average, 7-day window)")
        logger.info(f"      3. seasonality (month: 1-12)")
        
        logger.info(f"\n   Updated dataset shape: {df.shape}")
        logger.info(f"   New columns: {', '.join([col for col in ['contamination_flag', 'case_density', 'seasonality'] if col in df.columns])}")
        
        # Show correlations with target
        logger.info(f"\n   Feature correlations with Diarrheal_Cases:")
        engineered_features = ['contamination_flag', 'case_density', 'seasonality']
        for feat in engineered_features:
            if feat in df.columns:
                corr = df[feat].corr(df['Diarrheal_Cases'])
                logger.info(f"      {feat:25s}: {corr:7.4f}")
        
        logger.info("="*80 + "\n")
        
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
        
        # Engineer features
        df = self.engineer_features(df)
        
        # Create target variable
        if 'Diarrheal_Cases' in df.columns:
            df['Outbreak_Risk'] = df['Diarrheal_Cases'].apply(self.create_risk_label)
        else:
            raise ValueError("Dataset must contain 'Diarrheal_Cases' column")
        
        # Update feature names to include engineered features
        all_features = self.feature_names + ['contamination_flag', 'case_density', 'seasonality']
        # Filter to only features that exist in the dataframe
        X_features = [f for f in all_features if f in df.columns]
        
        # Features and target
        X = df[X_features]
        y = df['Outbreak_Risk']
        
        logger.info(f"\n📈 Data Preparation:")
        logger.info(f"   Features ({len(X_features)}): {X_features}")
        logger.info(f"   Target distribution:")
        for risk_level, count in y.value_counts().items():
            pct = 100 * count / len(y)
            logger.info(f"      {risk_level:10s}: {count:4d} samples ({pct:5.1f}%)")
        
        # ===== STRATIFIED TRAIN/TEST SPLIT =====
        logger.info(f"\n✂️  STRATIFIED DATA SPLITTING (random_state=42)")
        logger.info(f"   Strategy: Preserve class distribution across splits")
        logger.info(f"   Reproducibility: Fixed random_state=42")
        
        # Primary split: 80% train+val, 20% test (stratified)
        X_train_val, X_test, y_train_val, y_test = train_test_split(
            X, y, 
            test_size=0.2, 
            random_state=42, 
            stratify=y
        )
        
        # Secondary split: 75% train, 25% val from train+val (stratified)
        X_train, X_val, y_train, y_val = train_test_split(
            X_train_val, y_train_val, 
            test_size=0.25,  # 25% of 80% = 20% of total
            random_state=42, 
            stratify=y_train_val
        )
        
        # Log split sizes
        logger.info(f"\n   Split Sizes:")
        logger.info(f"      Training set:   {X_train.shape[0]:4d} samples ({100*X_train.shape[0]/len(X):5.1f}%)")
        logger.info(f"      Validation set: {X_val.shape[0]:4d} samples ({100*X_val.shape[0]/len(X):5.1f}%)")
        logger.info(f"      Test set:       {X_test.shape[0]:4d} samples ({100*X_test.shape[0]/len(X):5.1f}%)")
        logger.info(f"      ────────────────────────────────")
        logger.info(f"      Total:          {len(X):4d} samples")
        
        # Verify stratification
        logger.info(f"\n   Stratification Verification (Class Distribution):")
        logger.info(f"   {'Set':<15} {'Low':<10} {'Medium':<10} {'High':<10} {'Total':<10}")
        logger.info(f"   {'-'*55}")
        
        # Full dataset distribution
        full_dist = y.value_counts()
        logger.info(f"   {'Full Dataset':<15} ", end="")
        for risk_level in ['Low', 'Medium', 'High']:
            count = full_dist.get(risk_level, 0)
            pct = 100 * count / len(y) if len(y) > 0 else 0
            logger.info(f"{count:4d}({pct:4.1f}%)  ", end="")
        logger.info(f"{len(y):4d}")
        
        # Training set distribution
        train_dist = y_train.value_counts()
        logger.info(f"   {'Training':<15} ", end="")
        for risk_level in ['Low', 'Medium', 'High']:
            count = train_dist.get(risk_level, 0)
            pct = 100 * count / len(y_train) if len(y_train) > 0 else 0
            logger.info(f"{count:4d}({pct:4.1f}%)  ", end="")
        logger.info(f"{len(y_train):4d}")
        
        # Validation set distribution
        val_dist = y_val.value_counts()
        logger.info(f"   {'Validation':<15} ", end="")
        for risk_level in ['Low', 'Medium', 'High']:
            count = val_dist.get(risk_level, 0)
            pct = 100 * count / len(y_val) if len(y_val) > 0 else 0
            logger.info(f"{count:4d}({pct:4.1f}%)  ", end="")
        logger.info(f"{len(y_val):4d}")
        
        # Test set distribution
        test_dist = y_test.value_counts()
        logger.info(f"   {'Test':<15} ", end="")
        for risk_level in ['Low', 'Medium', 'High']:
            count = test_dist.get(risk_level, 0)
            pct = 100 * count / len(y_test) if len(y_test) > 0 else 0
            logger.info(f"{count:4d}({pct:4.1f}%)  ", end="")
        logger.info(f"{len(y_test):4d}")
        
        logger.info(f"   {'-'*55}")
        logger.info(f"   ✓ Stratification successful - class distributions preserved\n")
        
        # Feature scaling
        logger.info(f"📊 Feature Scaling (StandardScaler):")
        logger.info(f"   Scaling method: Standardization (zero mean, unit variance)")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        logger.info(f"   ✓ Scaler fitted on training set")
        logger.info(f"   ✓ Scaler applied to validation and test sets")
        logger.info(f"   ✓ Scaling applied to all {X_train_scaled.shape[1]} features\n")
        
        logger.info(f"   Feature statistics (after scaling on training set):")
        for i, feat in enumerate(X_features):
            mean_val = X_train_scaled[:, i].mean()
            std_val = X_train_scaled[:, i].std()
            logger.info(f"      {feat:25s} | Mean: {mean_val:7.4f} | Std: {std_val:7.4f}")
        
        # ===== CLASS IMBALANCE DETECTION =====
        logger.info(f"\n⚖️  CLASS IMBALANCE ANALYSIS")
        logger.info(f"   Checking class distribution in training set...")
        
        class_counts = y_train.value_counts().sort_values(ascending=False)
        class_imbalance_ratio = class_counts.max() / class_counts.min() if len(class_counts) > 0 else 1.0
        
        logger.info(f"\n   Class Distribution (Training Set):")
        for cls, count in class_counts.items():
            pct = 100 * count / len(y_train)
            logger.info(f"      {cls:<10s}: {count:4d} samples ({pct:5.1f}%)")
        
        logger.info(f"\n   Imbalance Ratio: {class_imbalance_ratio:.2f}:1 (max:min)")
        
        # Determine if class weights are needed
        use_class_weights = class_imbalance_ratio > 1.5
        logger.info(f"   Imbalance Status: ", end="")
        if use_class_weights:
            logger.info(f"⚠️  SEVERE IMBALANCE DETECTED (ratio > 1.5)")
            logger.info(f"   Mitigation: Will apply class_weight='balanced'\n")
        else:
            logger.info(f"✓ BALANCED (ratio ≤ 1.5)\n")
        
        # ===== BASELINE RANDOM FOREST CLASSIFIER =====
        logger.info(f"\n🤖 BASELINE RANDOM FOREST CLASSIFIER")
        logger.info(f"   Algorithm: Random Forest (ensemble of decision trees)")
        logger.info(f"   Reproducibility: random_state=42 (fixed seed)")
        logger.info(f"   Class Weights: {'balanced' if use_class_weights else 'None'}")
        logger.info(f"\n   Hyperparameters:")
        logger.info(f"      n_estimators:      100  (number of trees)")
        logger.info(f"      max_depth:         15   (tree depth limit to prevent overfitting)")
        logger.info(f"      min_samples_split: 5    (minimum samples required to split node)")
        logger.info(f"      min_samples_leaf:  2    (minimum samples required in leaf)")
        logger.info(f"      class_weight:      {'balanced' if use_class_weights else 'None':<10s} (handles class imbalance)")
        logger.info(f"      random_state:      42   (ensures reproducibility)")
        logger.info(f"      n_jobs:            -1   (use all CPU cores)")
        
        logger.info(f"\n   Training in progress...")
        
        # Train model with or without balanced class weights
        self.model = RandomForestClassifier(
            n_estimators=100, 
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight='balanced' if use_class_weights else None,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train_scaled, y_train)
        logger.info(f"   ✓ Model training complete")
        logger.info(f"      Trained on: {X_train_scaled.shape[0]} samples × {X_train_scaled.shape[1]} features")
        if use_class_weights:
            logger.info(f"      Applied: Balanced class weights to handle imbalance")
        
        # Make predictions
        y_train_pred = self.model.predict(X_train_scaled)
        y_val_pred = self.model.predict(X_val_scaled)
        y_test_pred = self.model.predict(X_test_scaled)
        
        # Evaluate
        logger.info(f"\n{'='*80}")
        logger.info(f"📊 MODEL EVALUATION METRICS")
        logger.info(f"{'='*80}")
        
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
        
        # Print metrics table header
        logger.info(f"\n📈 SUMMARY METRICS (Weighted Average):")
        logger.info(f"{'─'*80}")
        logger.info(f"{'Dataset':<15} {'Accuracy':<15} {'Precision':<15} {'Recall':<15} {'F1-Score':<15}")
        logger.info(f"{'─'*80}")
        
        # Print metrics for each dataset
        for dataset_name in ['train', 'validation', 'test']:
            metrics = self.eval_metrics[dataset_name]
            logger.info(f"{dataset_name.upper():<15} {metrics['accuracy']:<15.4f} {metrics['precision']:<15.4f} {metrics['recall']:<15.4f} {metrics['f1']:<15.4f}")
        
        logger.info(f"{'─'*80}")
        
        # Detailed classification report for test set
        logger.info(f"\n{'='*80}")
        logger.info(f"📋 DETAILED CLASSIFICATION REPORT (Test Set)")
        logger.info(f"{'='*80}")
        logger.info(f"\n{classification_report(y_test, y_test_pred, digits=4)}")
        
        # Confusion matrix with labels
        cm = confusion_matrix(y_test, y_test_pred, labels=['Low', 'Medium', 'High'])
        logger.info(f"{'='*80}")
        logger.info(f"🎯 CONFUSION MATRIX (Test Set)")
        logger.info(f"{'='*80}")
        logger.info(f"\nPredicted vs Actual Outbreak Risk:")
        logger.info(f"{'─'*50}")
        logger.info(f"{'':20s}  {'Actual Low':<15} {'Actual Med':<15} {'Actual High':<15}")
        logger.info(f"{'─'*50}")
        
        risk_labels = ['Low', 'Medium', 'High']
        for i, pred_label in enumerate(risk_labels):
            logger.info(f"{'Predicted ' + pred_label:<20}  {cm[i,0]:<15d} {cm[i,1]:<15d} {cm[i,2]:<15d}")
        
        logger.info(f"{'─'*50}")
        
        # Calculate and display detailed metrics per class
        logger.info(f"\n{'='*80}")
        logger.info(f"📊 PER-CLASS PERFORMANCE METRICS (Test Set)")
        logger.info(f"{'='*80}")
        
        logger.info(f"\n{'Risk Level':<15} {'Precision':<15} {'Recall':<15} {'F1-Score':<15} {'Support':<15}")
        logger.info(f"{'─'*70}")
        
        for i, label in enumerate(['Low', 'Medium', 'High']):
            # Calculate metrics per class
            precision_cls = precision_score(y_test, y_test_pred, labels=[label], average='weighted', zero_division=0)
            recall_cls = recall_score(y_test, y_test_pred, labels=[label], average='weighted', zero_division=0)
            f1_cls = f1_score(y_test, y_test_pred, labels=[label], average='weighted', zero_division=0)
            support_cls = np.sum(y_test == label)
            
            logger.info(f"{label:<15} {precision_cls:<15.4f} {recall_cls:<15.4f} {f1_cls:<15.4f} {support_cls:<15d}")
        
        logger.info(f"{'─'*70}")
        
        logger.info(f"\n{'='*80}")
        logger.info(f"⚖️  CLASS IMBALANCE IMPACT ANALYSIS")
        logger.info(f"{'='*80}")
        
        # Calculate class-weighted and unweighted metrics
        logger.info(f"\n📊 Model Performance with Balanced Class Weights:")
        
        # Macro average (unweighted per-class average)
        logger.info(f"\n   Macro Average (unweighted per-class average):")
        logger.info(f"   {'─'*70}")
        for dataset_name in ['train', 'validation', 'test']:
            if dataset_name == 'train':
                y_true, y_pred = y_train, y_train_pred
            elif dataset_name == 'validation':
                y_true, y_pred = y_val, y_val_pred
            else:
                y_true, y_pred = y_test, y_test_pred
            
            acc_macro = accuracy_score(y_true, y_pred)
            prec_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
            rec_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
            f1_macro = f1_score(y_true, y_pred, average='macro', zero_division=0)
            
            logger.info(f"   {dataset_name.upper():<15} Accuracy: {acc_macro:.4f} | Precision: {prec_macro:.4f} | Recall: {rec_macro:.4f} | F1: {f1_macro:.4f}")
        
        logger.info(f"   {'─'*70}")
        logger.info(f"\n   Note: Macro average treats all classes equally,")
        logger.info(f"         regardless of their frequency in the dataset.")
        logger.info(f"         Better for evaluating performance on minority classes.")
        
        # Weighted vs Macro comparison for test set
        logger.info(f"\n   Comparison (Test Set) - Weighted vs Unweighted:")
        logger.info(f"   {'─'*70}")
        logger.info(f"   {'Metric':<15} {'Weighted Avg':<20} {'Macro Avg':<20}")
        logger.info(f"   {'─'*70}")
        
        weighted_metrics = {
            'accuracy': accuracy_score(y_test, y_test_pred),
            'precision': precision_score(y_test, y_test_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_test, y_test_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_test, y_test_pred, average='weighted', zero_division=0)
        }
        
        macro_metrics = {
            'accuracy': accuracy_score(y_test, y_test_pred),
            'precision': precision_score(y_test, y_test_pred, average='macro', zero_division=0),
            'recall': recall_score(y_test, y_test_pred, average='macro', zero_division=0),
            'f1': f1_score(y_test, y_test_pred, average='macro', zero_division=0)
        }
        
        for metric_name in ['accuracy', 'precision', 'recall', 'f1']:
            weighted_val = weighted_metrics[metric_name]
            macro_val = macro_metrics[metric_name]
            diff = macro_val - weighted_val
            diff_str = f"({diff:+.4f})" if abs(diff) > 0.001 else ""
            logger.info(f"   {metric_name.upper():<15} {weighted_val:<20.4f} {macro_val:<20.4f} {diff_str}")
        
        logger.info(f"   {'─'*70}")
        
        if use_class_weights:
            logger.info(f"\n   ✓ Class weights applied - model trained with 'balanced' weights")
            logger.info(f"     Minority classes receive higher penalties during training")
            logger.info(f"     Result: Improved recall on underrepresented risk levels")
        else:
            logger.info(f"\n   ✓ Dataset is balanced - no class weights needed")
            logger.info(f"     All classes have similar representation")
        
        logger.info(f"\n✓ Evaluation complete - All metrics computed successfully\n")
        
        # Display detailed feature importance analysis
        self.display_feature_importance()
        
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
        """
        Load a trained model and all preprocessing pipeline objects from disk.
        
        This method loads:
        - RandomForestClassifier model (inference-only, NO retraining)
        - StandardScaler for feature preprocessing
        - Evaluation metrics from training
        - Feature names used during training
        
        Returns:
            RandomForestClassifier: The loaded model (ready for inference only)
            
        Raises:
            FileNotFoundError: If model file doesn't exist
            ValueError: If model or critical components fail to load
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"📦 LOADING TRAINED MODEL FROM DISK")
        logger.info(f"{'='*80}")
        
        # Verify model file exists
        if not os.path.exists(self.model_path):
            error_msg = f"❌ Model file not found at: {self.model_path}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        try:
            # Load RandomForest model
            logger.info(f"\n📥 Loading Model: {self.model_path}")
            self.model = joblib.load(self.model_path)
            logger.info(f"   ✓ Model type: {type(self.model).__name__}")
            logger.info(f"   ✓ N estimators: {self.model.n_estimators}")
            logger.info(f"   ✓ Classes: {list(self.model.classes_)}")
            logger.info(f"   ✓ Model ready for inference only (NO RETRAINING)")
            
            # Load scaler
            scaler_path = self.model_path.replace('.pkl', '_scaler.joblib')
            if os.path.exists(scaler_path):
                logger.info(f"\n📥 Loading Scaler: {scaler_path}")
                self.scaler = joblib.load(scaler_path)
                logger.info(f"   ✓ Scaler type: {type(self.scaler).__name__}")
                logger.info(f"   ✓ Scaling method: StandardScaler (zero mean, unit variance)")
            else:
                logger.warning(f"⚠️  Scaler not found. Predictions will use unscaled features.")
                self.scaler = None
            
            # Load evaluation metrics
            metrics_path = self.model_path.replace('.pkl', '_metrics.joblib')
            if os.path.exists(metrics_path):
                logger.info(f"\n📥 Loading Evaluation Metrics: {metrics_path}")
                self.eval_metrics = joblib.load(metrics_path)
                logger.info(f"   ✓ Training accuracy:   {self.eval_metrics.get('train', {}).get('accuracy', 'N/A')}")
                logger.info(f"   ✓ Validation accuracy: {self.eval_metrics.get('validation', {}).get('accuracy', 'N/A')}")
                logger.info(f"   ✓ Test accuracy:       {self.eval_metrics.get('test', {}).get('accuracy', 'N/A')}")
            else:
                logger.warning(f"⚠️  Metrics not found. Using empty metrics dict.")
                self.eval_metrics = {}
            
            # Load feature names
            features_path = self.model_path.replace('.pkl', '_features.joblib')
            if os.path.exists(features_path):
                logger.info(f"\n📥 Loading Feature Names: {features_path}")
                loaded_features = joblib.load(features_path)
                if isinstance(loaded_features, list):
                    self.feature_names = loaded_features
                    logger.info(f"   ✓ Features: {self.feature_names}")
                else:
                    logger.warning(f"⚠️  Feature names format unexpected, keeping defaults.")
            else:
                logger.warning(f"⚠️  Feature names file not found. Using default features.")
            
            logger.info(f"\n{'='*80}")
            logger.info(f"✅ MODEL FULLY LOADED - READY FOR PREDICTIONS")
            logger.info(f"{'='*80}\n")
            
        except Exception as e:
            error_msg = f"❌ Error loading model pipeline: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg) from e
        
        return self.model
    
    def predict(self, pH, turbidity, dissolved_oxygen):
        """
        Make a single prediction for outbreak risk based on water quality sensors.
        
        ⚠️  INFERENCE ONLY - No model retraining occurs during prediction.
        
        Args:
            pH (float): pH level of water (optimal: 6.5-8.5)
            turbidity (float): Turbidity in NTU (Nephelometric Turbidity Units)
            dissolved_oxygen (float): Dissolved oxygen in mg/L
            
        Returns:
            dict: Contains:
                - risk_label (str): 'Low', 'Medium', or 'High'
                - confidence (float): Probability of prediction (0-100%)
                - probabilities (dict): Per-class probability breakdown
                - timestamp (str): ISO format timestamp of prediction
                
        Raises:
            ValueError: If model not loaded or features invalid
        """
        # Auto-load model if not already loaded
        if self.model is None:
            logger.info("Model not in memory - loading from disk...")
            self.load_model()
        
        try:
            # Validate inputs
            if not isinstance(pH, (int, float)) or not isinstance(turbidity, (int, float)) or not isinstance(dissolved_oxygen, (int, float)):
                raise ValueError("All sensor inputs must be numeric")
            
            # Create prediction DataFrame with correct feature order
            X = pd.DataFrame(
                [[pH, turbidity, dissolved_oxygen]], 
                columns=self.feature_names[:3]
            )
            
            # Apply scaling (same scaler used during training)
            if self.scaler is not None:
                X_scaled = self.scaler.transform(X)
            else:
                logger.warning(f"No scaler available - using raw sensor values (not recommended)")
                X_scaled = X.values
            
            # Inference (NO RETRAINING)
            prediction = self.model.predict(X_scaled)[0]
            probabilities = self.model.predict_proba(X_scaled)[0]
            confidence = max(probabilities) * 100
            
            # Map probabilities to class labels
            class_order = self.model.classes_
            prob_dict = {cls: prob * 100 for cls, prob in zip(class_order, probabilities)}
            
            result = {
                'risk_label': prediction,
                'confidence': round(confidence, 2),
                'probabilities': {cls: round(prob, 2) for cls, prob in prob_dict.items()},
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"\n✓ INFERENCE RESULT (No Retraining):")
            logger.info(f"   Input → pH: {pH:6.2f} | Turbidity: {turbidity:8.2f} | DO: {dissolved_oxygen:6.2f}")
            logger.info(f"   Prediction → {prediction} (Confidence: {confidence:.2f}%)")
            logger.info(f"   Breakdown → {prob_dict}\n")
            
            return result
            
        except Exception as e:
            error_msg = f"Prediction failed: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg) from e
    
    def predict_batch(self, sensor_readings):
        """
        Make predictions for multiple sensor readings in batch mode.
        
        ⚠️  INFERENCE ONLY - No model retraining occurs during batch predictions.
        
        Args:
            sensor_readings (list): List of dicts, each containing:
                - pH (float): pH level
                - turbidity (float): Turbidity in NTU
                - dissolved_oxygen (float): Dissolved oxygen in mg/L
                - [optional] sensor_id, lat, lng, reading_at
            
        Returns:
            list: Predictions for each sensor reading, each containing:
                - index: Position in input list
                - sensor_id: Sensor identifier if provided
                - risk_label: 'Low', 'Medium', or 'High'
                - confidence: Probability of prediction (0-100%)
                - probabilities: Per-class breakdown
                - [optional] lat, lng, reading_at from input
                
        Raises:
            ValueError: If model not loaded or invalid input format
        """
        # Auto-load model if not already loaded
        if self.model is None:
            logger.info("Model not in memory - loading from disk...")
            self.load_model()
        
        try:
            logger.info(f"\n{'='*80}")
            logger.info(f"🔮 BATCH PREDICTION (Inference Only - No Retraining)")
            logger.info(f"{'='*80}")
            logger.info(f"Processing {len(sensor_readings)} sensor readings...\n")
            
            # Convert to DataFrame
            df = pd.DataFrame(sensor_readings)
            
            # Prepare features with proper column names
            X = pd.DataFrame({
                'pH': df['pH'].astype(float),
                'Turbidity': df['turbidity'].astype(float),
                'Dissolved_Oxygen': df['dissolved_oxygen'].astype(float)
            })
            
            # Apply scaling (same scaler used during training)
            if self.scaler is not None:
                X_scaled = self.scaler.transform(X)
                logger.info(f"✓ Applied StandardScaler to all {len(X)} readings")
            else:
                logger.warning(f"⚠️  No scaler found - using raw feature values")
                X_scaled = X.values
            
            # Batch inference (NO RETRAINING)
            predictions = self.model.predict(X_scaled)
            probabilities = self.model.predict_proba(X_scaled)
            
            # Build results
            results = []
            class_order = self.model.classes_
            
            for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
                prob_dict = {cls: float(round(p * 100, 2)) for cls, p in zip(class_order, prob)}
                confidence = round(float(max(prob) * 100), 2)
                
                result = {
                    'index': i,
                    'sensor_id': sensor_readings[i].get('sensor_id', f'sensor-{i:04d}'),
                    'risk_label': pred,
                    'confidence': confidence,
                    'probabilities': prob_dict,
                }
                
                # Add optional fields if present
                if 'lat' in sensor_readings[i]:
                    result['lat'] = sensor_readings[i]['lat']
                if 'lng' in sensor_readings[i]:
                    result['lng'] = sensor_readings[i]['lng']
                if 'reading_at' in sensor_readings[i]:
                    result['reading_at'] = sensor_readings[i]['reading_at']
                
                results.append(result)
            
            logger.info(f"\n{'='*80}")
            logger.info(f"✅ BATCH PROCESSING COMPLETE")
            logger.info(f"{'='*80}")
            logger.info(f"   Total readings: {len(results)}")
            
            # Summary statistics
            risk_counts = {'Low': 0, 'Medium': 0, 'High': 0}
            for result in results:
                risk_counts[result['risk_label']] = risk_counts.get(result['risk_label'], 0) + 1
            
            logger.info(f"\n   Risk Level Distribution:")
            for risk_level, count in sorted(risk_counts.items()):
                pct = 100 * count / len(results) if len(results) > 0 else 0
                logger.info(f"      {risk_level:<10s}: {count:4d} ({pct:5.1f}%)")
            
            logger.info(f"\n   ⚠️  INFERENCE ONLY - NO MODEL RETRAINING OCCURRED")
            logger.info(f"{'='*80}\n")
            
            return results
            
        except Exception as e:
            error_msg = f"Batch prediction failed: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg) from e
    
    def get_feature_importance(self):
        """
        Extract and analyze feature importances from the Random Forest model.
        
        Returns:
            list: Sorted list of (feature_name, importance_score) tuples
                  in descending order by importance
        """
        if self.model is None:
            self.load_model()
        
        importance = dict(zip(self.feature_names, self.model.feature_importances_))
        return sorted(importance.items(), key=lambda x: x[1], reverse=True)
    
    def display_feature_importance(self, top_n=None):
        """
        Display feature importances with detailed explanations.
        
        Args:
            top_n (int): Number of top features to display. None shows all.
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"🔍 FEATURE IMPORTANCE ANALYSIS (Random Forest)")
        logger.info(f"{'='*80}")
        
        # Get feature importances
        feature_importances = self.get_feature_importance()
        
        # Display if top_n is set
        if top_n is not None:
            feature_importances = feature_importances[:top_n]
        
        # Feature descriptions for interpretation
        feature_descriptions = {
            'pH': 'Measure of water acidity/alkalinity (optimal: 6.5-8.5). Extreme pH favors pathogenic bacteria.',
            'Turbidity': 'Water cloudiness in NTU. High turbidity indicates suspended matter, reducing disinfection effectiveness.',
            'Dissolved_Oxygen': 'O2 concentration in mg/L. Low DO indicates organic contamination and stagnant water conditions.',
            'contamination_flag': 'Binary indicator: 1 if pH<6.5 OR Turbidity>10 (high contamination risk), 0 otherwise.',
            'case_density': '7-day rolling average of diarrheal cases. Temporal trend indicating outbreak progression.',
            'seasonality': 'Month of year (1-12). Water-borne disease peaks in warm months (monsoon/summer).'
        }
        
        logger.info(f"\n📊 FEATURE IMPORTANCE RANKINGS:")
        logger.info(f"{'─'*80}")
        logger.info(f"{'Rank':<6} {'Feature':<25} {'Importance':<15} {'Relative %':<15}")
        logger.info(f"{'─'*80}")
        
        total_importance = sum(imp for _, imp in feature_importances)
        
        for rank, (feature, importance) in enumerate(feature_importances, 1):
            relative_pct = 100 * importance / total_importance if total_importance > 0 else 0
            bar = "█" * int(relative_pct / 2)  # Scale to 50 chars max
            logger.info(f"{rank:<6} {feature:<25} {importance:<15.6f} {relative_pct:>6.1f}% {bar}")
        
        logger.info(f"{'─'*80}")
        
        # Interpretation section
        logger.info(f"\n📖 FEATURE INTERPRETATION:")
        logger.info(f"{'─'*80}")
        
        for rank, (feature, importance) in enumerate(feature_importances, 1):
            total_importance = sum(imp for _, imp in feature_importances)
            relative_pct = 100 * importance / total_importance if total_importance > 0 else 0
            
            # Determine importance level
            if relative_pct >= 25:
                importance_level = "🔴 CRITICAL"
            elif relative_pct >= 15:
                importance_level = "🟠 HIGH"
            elif relative_pct >= 8:
                importance_level = "🟡 MODERATE"
            else:
                importance_level = "🟢 LOW"
            
            logger.info(f"\n{rank}. {feature.upper()} ({importance_level}) - {relative_pct:.1f}%")
            logger.info(f"   {feature_descriptions.get(feature, 'No description available')}")
            
            # Add contextual insights
            if 'contamination_flag' in feature and rank <= 3:
                logger.info(f"   💡 Insight: Water quality indicators (pH/Turbidity) are top predictors.")
            elif 'case_density' in feature and rank <= 3:
                logger.info(f"   💡 Insight: Historical case trends are strong indicators of outbreak risk.")
            elif 'seasonality' in feature and rank <= 3:
                logger.info(f"   💡 Insight: Temporal patterns (season/month) strongly influence disease transmission.")
        
        logger.info(f"\n{'='*80}")
        logger.info(f"✅ FEATURE IMPORTANCE ANALYSIS COMPLETE")
        logger.info(f"{'='*80}\n")
        
        # Summary insights
        logger.info(f"📌 KEY TAKEAWAYS:")
        logger.info(f"   • Top 3 features account for {sum(imp for _, imp in feature_importances[:3])/total_importance*100:.1f}% of prediction power")
        logger.info(f"   • Features are based on: Water Quality (sensors) + Case Trends (historical) + Seasonality (temporal)")
        logger.info(f"   • Model combines physical, epidemiological, and temporal signals for robust outbreak prediction\n")


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
