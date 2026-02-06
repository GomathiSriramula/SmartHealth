"""
Node.js-compatible ML Module Wrapper.

This file provides utilities to call the Python ML module from Node.js backend.
It can be used with:
1. Python subprocess (execSync/spawn)
2. Child process (for background predictions)
3. REST API wrapper around the module

Usage from Node.js:
    const { predictFromJSON, batchPredict } = require('./ml_wrapper.js');
    
    const result = await predictFromJSON({
        pH: 7.0,
        turbidity: 5.0,
        dissolved_oxygen: 6.0
    });
"""

import json
import sys
from typing import Dict, Any, List

# Try to import ml_module
try:
    from ml_module import MLModule, initialize_module, predict, batch_predict
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


class MLWrapper:
    """Wrapper for Node.js integration via subprocess."""
    
    def __init__(self):
        """Initialize wrapper."""
        self.ml = None
        if ML_AVAILABLE:
            self.ml = MLModule()
    
    def predict(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make prediction (subprocess-callable).
        
        Takes JSON input, returns JSON output.
        Can be called from Node.js via subprocess.
        """
        if not ML_AVAILABLE or self.ml is None:
            return {
                'success': False,
                'error': 'ML module not available',
                'error_code': 'ML_NOT_AVAILABLE'
            }
        
        return self.ml.predict_from_json(input_dict)
    
    def batch_predict(self, input_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Make batch predictions (subprocess-callable).
        
        Takes JSON array, returns JSON output.
        Can be called from Node.js via subprocess.
        """
        if not ML_AVAILABLE or self.ml is None:
            return {
                'success': False,
                'error': 'ML module not available',
                'error_code': 'ML_NOT_AVAILABLE'
            }
        
        return self.ml.batch_predict_from_json(input_list)
    
    def validate(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate input without prediction.
        
        Can be called from Node.js via subprocess.
        """
        if not ML_AVAILABLE or self.ml is None:
            return {
                'valid': False,
                'error': 'ML module not available'
            }
        
        return self.ml.validate_json(input_dict)
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Can be called from Node.js via subprocess.
        """
        if not ML_AVAILABLE or self.ml is None:
            return {
                'available': False,
                'error': 'ML module not available'
            }
        
        info = self.ml.get_model_info()
        info['available'] = True
        return info


def main():
    """
    Main entry point for subprocess calls from Node.js.
    
    Usage from Node.js:
        const { execSync } = require('child_process');
        const result = execSync(
            'python ml_wrapper.py predict',
            { input: JSON.stringify({pH: 7.0, turbidity: 5.0, dissolved_oxygen: 6.0}) }
        );
    """
    wrapper = MLWrapper()
    
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Missing command',
            'usage': 'python ml_wrapper.py <command> [input_json]',
            'commands': ['predict', 'batch_predict', 'validate', 'info']
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'predict':
            # Read JSON from stdin
            input_data = json.loads(sys.stdin.read())
            result = wrapper.predict(input_data)
            print(json.dumps(result))
        
        elif command == 'batch_predict':
            # Read JSON array from stdin
            input_data = json.loads(sys.stdin.read())
            result = wrapper.batch_predict(input_data)
            print(json.dumps(result))
        
        elif command == 'validate':
            # Read JSON from stdin
            input_data = json.loads(sys.stdin.read())
            result = wrapper.validate(input_data)
            print(json.dumps(result))
        
        elif command == 'info':
            result = wrapper.get_info()
            print(json.dumps(result))
        
        else:
            print(json.dumps({
                'error': f'Unknown command: {command}',
                'available_commands': ['predict', 'batch_predict', 'validate', 'info']
            }))
            sys.exit(1)
    
    except json.JSONDecodeError as e:
        print(json.dumps({
            'error': f'Invalid JSON input: {str(e)}',
            'error_code': 'JSON_ERROR'
        }))
        sys.exit(1)
    
    except Exception as e:
        print(json.dumps({
            'error': f'Unexpected error: {str(e)}',
            'error_code': 'UNEXPECTED_ERROR'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
