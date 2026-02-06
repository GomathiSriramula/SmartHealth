"""
Reusable ML Module for Disease Outbreak Prediction.

This module provides a clean, production-ready interface for the ML model
with JSON input/output and comprehensive error handling.

Usage:
    from ml_module import MLModule, InvalidInputError
    
    ml = MLModule()
    result = ml.predict_from_json({
        'pH': 7.0,
        'turbidity': 5.0,
        'dissolved_oxygen': 6.0
    })
    
    # Returns:
    # {
    #     'success': True,
    #     'risk_label': 'Medium',
    #     'confidence': 78.45,
    #     'probabilities': {
    #         'Low': 15.23,
    #         'Medium': 78.45,
    #         'High': 6.32
    #     },
    #     'timestamp': '2026-02-06T...'
    # }
"""

import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from model import DiseaseOutbreakModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class InvalidInputError(Exception):
    """Raised when input validation fails."""
    pass


class MLModule:
    """
    Reusable ML module for outbreak risk prediction.
    
    Provides a clean JSON interface with comprehensive error handling
    and input validation.
    """
    
    # Required fields for single prediction
    REQUIRED_FIELDS = {'pH', 'turbidity', 'dissolved_oxygen'}
    
    # Field aliases (frontend might use different names)
    FIELD_ALIASES = {
        'ph': 'pH',
        'Turbidity': 'turbidity',
        'Dissolved_Oxygen': 'dissolved_oxygen',
        'dissolved oxygen': 'dissolved_oxygen',
        'do': 'dissolved_oxygen',
    }
    
    # Field constraints
    FIELD_CONSTRAINTS = {
        'pH': {'min': 0, 'max': 14, 'description': 'pH level (0-14)'},
        'turbidity': {'min': 0, 'max': 100, 'description': 'Turbidity in NTU (0-100)'},
        'dissolved_oxygen': {'min': 0, 'max': 15, 'description': 'Dissolved oxygen in mg/L (0-15)'},
    }
    
    def __init__(self, model_path: str = './models/disease_model.pkl'):
        """
        Initialize the ML module.
        
        Args:
            model_path: Path to trained model file
        """
        self.model = DiseaseOutbreakModel(model_path=model_path)
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self) -> bool:
        """
        Load model from disk.
        
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        try:
            self.model.load_model()
            self.model_loaded = True
            logger.info("✓ ML module initialized successfully")
            return True
        except FileNotFoundError as e:
            logger.error(f"❌ Model file not found: {str(e)}")
            self.model_loaded = False
            return False
        except Exception as e:
            logger.error(f"❌ Error loading model: {str(e)}")
            self.model_loaded = False
            return False
    
    def _normalize_field_name(self, field: str) -> str:
        """
        Normalize field names to standard format.
        
        Args:
            field: Field name (case-insensitive)
            
        Returns:
            str: Normalized field name
        """
        # Try exact match first
        if field in self.REQUIRED_FIELDS:
            return field
        
        # Try case-insensitive
        lower_field = field.lower()
        if lower_field in self.FIELD_ALIASES:
            return self.FIELD_ALIASES[lower_field]
        
        # Try reverse match
        for alias, standard in self.FIELD_ALIASES.items():
            if lower_field == alias.lower():
                return standard
        
        return field  # Return original if no match
    
    def _validate_field(self, field_name: str, value: Any) -> Tuple[bool, Optional[str]]:
        """
        Validate a single field.
        
        Args:
            field_name: Name of field
            value: Value to validate
            
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        # Check type
        if not isinstance(value, (int, float)):
            return False, f"Field '{field_name}' must be numeric (got {type(value).__name__})"
        
        # Check for NaN or infinity
        try:
            if not (-float('inf') < float(value) < float('inf')):
                return False, f"Field '{field_name}' is not a valid number (infinity/NaN)"
        except (ValueError, TypeError):
            return False, f"Field '{field_name}' value is invalid"
        
        # Check constraints
        if field_name in self.FIELD_CONSTRAINTS:
            constraints = self.FIELD_CONSTRAINTS[field_name]
            min_val = constraints.get('min', float('-inf'))
            max_val = constraints.get('max', float('inf'))
            desc = constraints.get('description', field_name)
            
            if value < min_val or value > max_val:
                return False, f"Field '{field_name}' out of range: {desc} (got {value})"
        
        return True, None
    
    def _validate_input(self, input_dict: Dict[str, Any]) -> Tuple[bool, Optional[str], Dict[str, float]]:
        """
        Validate and normalize input dictionary.
        
        Args:
            input_dict: Input data
            
        Returns:
            Tuple[bool, Optional[str], Dict]: (is_valid, error_message, normalized_dict)
        """
        if not isinstance(input_dict, dict):
            return False, f"Input must be a dictionary (got {type(input_dict).__name__})", {}
        
        if not input_dict:
            return False, "Input dictionary is empty", {}
        
        # Normalize field names
        normalized = {}
        provided_fields = set()
        
        for key, value in input_dict.items():
            normalized_key = self._normalize_field_name(key)
            provided_fields.add(normalized_key)
            
            # Skip unknown fields
            if normalized_key not in self.REQUIRED_FIELDS and normalized_key not in self.FIELD_ALIASES.values():
                logger.warning(f"⚠️  Unknown field '{key}' - ignoring")
                continue
            
            normalized[normalized_key] = value
        
        # Check for missing required fields
        missing_fields = self.REQUIRED_FIELDS - provided_fields
        if missing_fields:
            missing_str = ', '.join(sorted(missing_fields))
            return False, f"Missing required fields: {missing_str}", {}
        
        # Validate each field
        validated = {}
        for field_name in self.REQUIRED_FIELDS:
            value = normalized.get(field_name)
            
            is_valid, error_msg = self._validate_field(field_name, value)
            if not is_valid:
                return False, error_msg, {}
            
            validated[field_name] = float(value)
        
        return True, None, validated
    
    def predict_from_json(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a prediction from JSON-compatible input.
        
        Handles:
        - Missing fields (returns error)
        - Invalid field names (normalizes aliases)
        - Invalid data types (converts if possible)
        - Out-of-range values (returns error)
        - Unknown fields (ignores with warning)
        
        Args:
            input_dict: Dictionary with pH, turbidity, dissolved_oxygen
            
        Returns:
            dict: Response with success status, predictions, or error details
                
        Example:
            >>> result = ml.predict_from_json({
            ...     'pH': 7.0,
            ...     'turbidity': 5.0,
            ...     'dissolved_oxygen': 6.0
            ... })
            >>> print(result)
            {
                'success': True,
                'risk_label': 'Medium',
                'confidence': 78.45,
                'probabilities': {...},
                'timestamp': '...'
            }
        """
        logger.info(f"Processing prediction request: {input_dict}")
        
        # Check model is loaded
        if not self.model_loaded:
            logger.error("Model not loaded")
            return {
                'success': False,
                'error': 'Model not initialized',
                'error_code': 'MODEL_NOT_LOADED',
                'message': 'Model failed to load from disk. Please check configuration.'
            }
        
        # Validate and normalize input
        is_valid, error_msg, validated_input = self._validate_input(input_dict)
        
        if not is_valid:
            logger.warning(f"Input validation failed: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'error_code': 'INVALID_INPUT',
                'message': f'Input validation failed: {error_msg}',
                'required_fields': list(self.REQUIRED_FIELDS),
                'field_constraints': self.FIELD_CONSTRAINTS
            }
        
        # Make prediction
        try:
            prediction = self.model.predict(
                pH=validated_input['pH'],
                turbidity=validated_input['turbidity'],
                dissolved_oxygen=validated_input['dissolved_oxygen']
            )
            
            logger.info(f"✓ Prediction successful: {prediction['risk_label']} ({prediction['confidence']:.2f}%)")
            
            return {
                'success': True,
                'risk_label': prediction['risk_label'],
                'confidence': prediction['confidence'],
                'probabilities': prediction['probabilities'],
                'timestamp': prediction['timestamp'],
                'input': validated_input
            }
        
        except Exception as e:
            logger.error(f"❌ Prediction error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'PREDICTION_ERROR',
                'message': f'Model prediction failed: {str(e)}'
            }
    
    def batch_predict_from_json(self, input_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Make batch predictions from JSON input.
        
        Args:
            input_list: List of input dictionaries
            
        Returns:
            dict: Response with success status and predictions or errors
        """
        logger.info(f"Processing batch prediction: {len(input_list)} readings")
        
        # Check model is loaded
        if not self.model_loaded:
            return {
                'success': False,
                'error': 'Model not initialized',
                'error_code': 'MODEL_NOT_LOADED'
            }
        
        if not isinstance(input_list, list):
            return {
                'success': False,
                'error': f'Input must be a list (got {type(input_list).__name__})',
                'error_code': 'INVALID_INPUT'
            }
        
        if not input_list:
            return {
                'success': False,
                'error': 'Input list is empty',
                'error_code': 'INVALID_INPUT'
            }
        
        # Prepare batch data
        batch_data = []
        errors = []
        
        for i, input_dict in enumerate(input_list):
            is_valid, error_msg, validated_input = self._validate_input(input_dict)
            
            if not is_valid:
                errors.append({
                    'index': i,
                    'error': error_msg,
                    'input': input_dict
                })
            else:
                batch_data.append(validated_input)
        
        # If some inputs are invalid, return partial results
        if errors and not batch_data:
            return {
                'success': False,
                'error': 'All inputs are invalid',
                'error_code': 'INVALID_INPUT',
                'errors': errors
            }
        
        # Make predictions
        try:
            sensor_readings = [
                {
                    'pH': data['pH'],
                    'turbidity': data['turbidity'],
                    'dissolved_oxygen': data['dissolved_oxygen']
                }
                for data in batch_data
            ]
            
            predictions = self.model.predict_batch(sensor_readings)
            
            logger.info(f"✓ Batch prediction successful: {len(predictions)} predictions")
            
            return {
                'success': True,
                'predictions': predictions,
                'count': len(predictions),
                'errors': errors if errors else None
            }
        
        except Exception as e:
            logger.error(f"❌ Batch prediction error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'PREDICTION_ERROR',
                'partial_results': errors
            }
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the model.
        
        Returns:
            dict: Model information and constraints
        """
        return {
            'model_loaded': self.model_loaded,
            'required_fields': list(self.REQUIRED_FIELDS),
            'field_aliases': self.FIELD_ALIASES,
            'field_constraints': self.FIELD_CONSTRAINTS,
            'valid_risk_labels': ['Low', 'Medium', 'High'],
            'confidence_range': [0, 100],
            'probability_format': 'percentage (0-100)'
        }
    
    def validate_json(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate input without making a prediction.
        
        Useful for frontend validation before sending request.
        
        Args:
            input_dict: Input to validate
            
        Returns:
            dict: Validation result with error details if invalid
        """
        is_valid, error_msg, validated_input = self._validate_input(input_dict)
        
        if is_valid:
            return {
                'valid': True,
                'message': 'Input is valid',
                'normalized_input': validated_input
            }
        else:
            return {
                'valid': False,
                'error': error_msg,
                'required_fields': list(self.REQUIRED_FIELDS),
                'field_constraints': self.FIELD_CONSTRAINTS
            }


# Module initialization
_ml_module: Optional[MLModule] = None


def initialize_module(model_path: str = './models/disease_model.pkl') -> MLModule:
    """
    Initialize the global ML module instance.
    
    Args:
        model_path: Path to trained model
        
    Returns:
        MLModule: The initialized module
    """
    global _ml_module
    _ml_module = MLModule(model_path=model_path)
    return _ml_module


def get_module() -> Optional[MLModule]:
    """
    Get the global ML module instance.
    
    Returns:
        MLModule: The module instance, or None if not initialized
    """
    return _ml_module


def predict(input_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Make a prediction using the global module instance.
    
    Args:
        input_dict: Input data
        
    Returns:
        dict: Prediction result or error
    """
    if _ml_module is None:
        return {
            'success': False,
            'error': 'Module not initialized',
            'error_code': 'MODULE_NOT_INITIALIZED'
        }
    
    return _ml_module.predict_from_json(input_dict)


def batch_predict(input_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Make batch predictions using the global module instance.
    
    Args:
        input_list: List of input data
        
    Returns:
        dict: Batch prediction result or error
    """
    if _ml_module is None:
        return {
            'success': False,
            'error': 'Module not initialized',
            'error_code': 'MODULE_NOT_INITIALIZED'
        }
    
    return _ml_module.batch_predict_from_json(input_list)


# Example usage
if __name__ == "__main__":
    logger.info("\n" + "="*80)
    logger.info("ML MODULE TEST")
    logger.info("="*80 + "\n")
    
    # Initialize module
    ml = MLModule()
    
    # Test 1: Valid prediction
    logger.info("Test 1: Valid prediction")
    logger.info("-" * 80)
    result = ml.predict_from_json({
        'pH': 7.0,
        'turbidity': 5.0,
        'dissolved_oxygen': 6.0
    })
    logger.info(f"Result: {json.dumps(result, indent=2)}\n")
    
    # Test 2: Missing field
    logger.info("Test 2: Missing required field")
    logger.info("-" * 80)
    result = ml.predict_from_json({
        'pH': 7.0,
        'turbidity': 5.0
        # missing dissolved_oxygen
    })
    logger.info(f"Result: {json.dumps(result, indent=2)}\n")
    
    # Test 3: Invalid value
    logger.info("Test 3: Out of range value")
    logger.info("-" * 80)
    result = ml.predict_from_json({
        'pH': 20.0,  # Invalid: > 14
        'turbidity': 5.0,
        'dissolved_oxygen': 6.0
    })
    logger.info(f"Result: {json.dumps(result, indent=2)}\n")
    
    # Test 4: Field alias
    logger.info("Test 4: Field name alias")
    logger.info("-" * 80)
    result = ml.predict_from_json({
        'ph': 7.0,  # Alias for pH
        'Turbidity': 5.0,  # Different case
        'do': 6.0  # Alias for dissolved_oxygen
    })
    logger.info(f"Result: {json.dumps(result, indent=2)}\n")
    
    # Test 5: Batch prediction
    logger.info("Test 5: Batch prediction")
    logger.info("-" * 80)
    result = ml.batch_predict_from_json([
        {'pH': 7.0, 'turbidity': 5.0, 'dissolved_oxygen': 6.0},
        {'pH': 6.5, 'turbidity': 8.0, 'dissolved_oxygen': 5.0},
        {'pH': 7.5, 'turbidity': 2.0, 'dissolved_oxygen': 8.0},
    ])
    logger.info(f"Result: {json.dumps(result, indent=2)}\n")
    
    # Test 6: Model info
    logger.info("Test 6: Model information")
    logger.info("-" * 80)
    info = ml.get_model_info()
    logger.info(f"Info: {json.dumps(info, indent=2)}\n")
    
    logger.info("="*80)
    logger.info("✅ ALL TESTS COMPLETED")
    logger.info("="*80 + "\n")
