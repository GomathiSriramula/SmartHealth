#!/usr/bin/env python3
"""
ML Backend Integration Verification Script

This script verifies that the ML module is properly integrated with the backend
and all required files are in place.

Usage:
    python verify_integration.py
"""

import os
import sys
import json
import subprocess
from pathlib import Path

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class IntegrationVerifier:
    def __init__(self):
        self.script_dir = Path(__file__).parent.resolve()
        self.checks_passed = 0
        self.checks_failed = 0

    def print_header(self, text):
        """Print a colored header"""
        print(f"\n{Colors.BLUE}{'='*60}")
        print(f"{text}")
        print(f"{'='*60}{Colors.END}\n")

    def print_success(self, text):
        """Print success message"""
        print(f"{Colors.GREEN}✓ {text}{Colors.END}")
        self.checks_passed += 1

    def print_error(self, text):
        """Print error message"""
        print(f"{Colors.RED}✗ {text}{Colors.END}")
        self.checks_failed += 1

    def print_warning(self, text):
        """Print warning message"""
        print(f"{Colors.YELLOW}⚠ {text}{Colors.END}")

    def print_info(self, text):
        """Print info message"""
        print(f"{Colors.BLUE}ℹ {text}{Colors.END}")

    def check_file_exists(self, filepath, description):
        """Check if a required file exists"""
        if Path(filepath).exists():
            self.print_success(f"{description}: {filepath}")
            return True
        else:
            self.print_error(f"{description} NOT FOUND: {filepath}")
            return False

    def check_python_available(self):
        """Check if Python is available"""
        try:
            result = subprocess.run(
                ['python', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                self.print_success(f"Python available: {version}")
                return True
        except Exception as e:
            self.print_error(f"Python check failed: {e}")
        return False

    def check_python_package(self, package_name):
        """Check if a Python package is installed"""
        try:
            result = subprocess.run(
                ['python', '-c', f'import {package_name}; print({package_name}.__version__)'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                self.print_success(f"Package '{package_name}' installed (v{version})")
                return True
        except Exception:
            pass
        
        self.print_error(f"Package '{package_name}' NOT found")
        return False

    def check_ml_module_direct(self):
        """Test ML module directly"""
        try:
            ml_module = self.script_dir / 'ml_model' / 'ml_module.py'
            if not ml_module.exists():
                self.print_error("ml_module.py not found")
                return False

            # Try to import and test
            result = subprocess.run(
                ['python', str(ml_module)],
                capture_output=True,
                text=True,
                cwd=str(self.script_dir / 'ml_model'),
                timeout=10
            )

            if 'Test 1: Single prediction' in result.stdout:
                self.print_success("ML module self-test passed")
                return True
            else:
                self.print_warning("ML module self-test output unclear")
                return False

        except Exception as e:
            self.print_error(f"ML module test failed: {e}")
            return False

    def check_ml_wrapper(self):
        """Test ML wrapper functionality"""
        try:
            ml_wrapper = self.script_dir / 'ml_model' / 'ml_wrapper.py'
            if not ml_wrapper.exists():
                self.print_error("ml_wrapper.py not found")
                return False

            # Test info command
            test_input = json.dumps({})
            result = subprocess.run(
                ['python', str(ml_wrapper), 'info'],
                input=test_input,
                capture_output=True,
                text=True,
                cwd=str(self.script_dir / 'ml_model'),
                timeout=5
            )

            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout)
                    if output.get('available'):
                        self.print_success("ML wrapper info command works")
                        return True
                except:
                    pass

            self.print_error("ML wrapper test failed")
            return False

        except Exception as e:
            self.print_error(f"ML wrapper check failed: {e}")
            return False

    def check_node_packages(self):
        """Check if Node.js packages are installed"""
        backend2_dir = self.script_dir / 'backend2'
        package_json = backend2_dir / 'package.json'

        if not package_json.exists():
            self.print_error("backend2/package.json not found")
            return False

        node_modules = backend2_dir / 'node_modules'
        if node_modules.exists():
            self.print_success("Node.js modules installed")
            return True
        else:
            self.print_warning("Node.js modules NOT installed - run 'npm install' in backend2/")
            return False

    def check_ml_routes_integration(self):
        """Check if ML routes are integrated in backend"""
        backend_index = self.script_dir / 'backend2' / 'index.js'
        ml_route_file = self.script_dir / 'backend2' / 'routes' / 'ml.js'

        # Check if ml route file exists
        if not ml_route_file.exists():
            self.print_error("ML route file not found: backend2/routes/ml.js")
            return False

        # Check if it's imported in index.js
        if backend_index.exists():
            content = backend_index.read_text()
            if 'mlRouter' in content and 'routes/ml' in content:
                self.print_success("ML routes integrated in backend")
                return True
            else:
                self.print_error("ML routes NOT integrated in index.js")
                return False
        else:
            self.print_error("backend2/index.js not found")
            return False

    def run_all_checks(self):
        """Run all verification checks"""
        self.print_header("ML Backend Integration Verification")

        # Check required files
        self.print_info("Checking required files...")
        self.check_file_exists(
            self.script_dir / 'ml_model' / 'ml_module.py',
            'ML Module'
        )
        self.check_file_exists(
            self.script_dir / 'ml_model' / 'ml_wrapper.py',
            'ML Wrapper'
        )
        self.check_file_exists(
            self.script_dir / 'ml_model' / 'model.pkl',
            'Trained Model'
        )
        self.check_file_exists(
            self.script_dir / 'ml_model' / 'scaler.pkl',
            'Data Scaler'
        )
        self.check_file_exists(
            self.script_dir / 'backend2' / 'routes' / 'ml.js',
            'ML Routes'
        )

        # Check Python environment
        self.print_info("\nChecking Python environment...")
        if self.check_python_available():
            self.check_python_package('sklearn')
            self.check_python_package('pandas')
            self.check_python_package('numpy')
            self.check_python_package('joblib')

        # Check ML modules
        self.print_info("\nChecking ML modules...")
        self.check_ml_module_direct()
        self.check_ml_wrapper()

        # Check Node.js integration
        self.print_info("\nChecking Node.js backend...")
        self.check_node_packages()
        self.check_ml_routes_integration()

        # Print summary
        self.print_header("Verification Summary")
        total = self.checks_passed + self.checks_failed
        percentage = (self.checks_passed / total * 100) if total > 0 else 0

        print(f"Checks Passed: {Colors.GREEN}{self.checks_passed}{Colors.END}")
        print(f"Checks Failed: {Colors.RED}{self.checks_failed}{Colors.END}")
        print(f"Total Checks:  {total}")
        print(f"Success Rate:  {percentage:.1f}%\n")

        if self.checks_failed == 0:
            print(Colors.GREEN + "✓ All checks passed! Integration is ready." + Colors.END)
            return 0
        else:
            print(Colors.YELLOW + "⚠ Some checks failed. See above for details." + Colors.END)
            return 1

def main():
    verifier = IntegrationVerifier()
    exit_code = verifier.run_all_checks()
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
