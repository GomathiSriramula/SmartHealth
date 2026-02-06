#!/bin/bash
# ML Integration Test Script
# Run this script to verify the ML backend integration is working

echo "=========================================="
echo "ML Backend Integration Test Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Backend URL
BACKEND_URL="http://localhost:5000"

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_field=$4
    local test_name=$5

    echo -n "Testing $test_name... "

    if [ -z "$data" ]; then
        # GET request
        response=$(curl -s -X $method "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" 2>/dev/null)
    else
        # POST request
        response=$(curl -s -X $method "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi

    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Response: $response"
        ((TESTS_FAILED++))
    fi
}

# Check if backend is running
echo "Step 1: Checking if backend is running..."
if curl -s "$BACKEND_URL/api/ml/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running on port 5000${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "  Please start the backend: cd backend2 && node index.js"
    exit 1
fi
echo ""

# Test 1: Health Check
echo "Step 2: Testing API endpoints..."
test_endpoint "GET" "/api/ml/health" "" "status" "Health Check Endpoint"

# Test 2: Model Info
test_endpoint "GET" "/api/ml/info" "" "available" "Model Info Endpoint"

# Test 3: Single Prediction - Valid
test_endpoint "POST" "/api/ml/predict" \
    '{"pH": 7.0, "turbidity": 5.0, "dissolved_oxygen": 6.0}' \
    "risk_label" "Valid Single Prediction"

# Test 4: Single Prediction with Sensor ID
test_endpoint "POST" "/api/ml/predict" \
    '{"pH": 7.0, "turbidity": 5.0, "dissolved_oxygen": 6.0, "sensorId": "sensor-123"}' \
    "sensorId" "Prediction with Sensor ID"

# Test 5: Batch Prediction
test_endpoint "POST" "/api/ml/batch" \
    '[{"pH": 7.0, "turbidity": 5.0, "dissolved_oxygen": 6.0}, {"pH": 6.5, "turbidity": 8.0, "dissolved_oxygen": 5.0}]' \
    "predictions" "Batch Prediction"

# Test 6: Validation Endpoint
test_endpoint "POST" "/api/ml/validate" \
    '{"pH": 7.0, "turbidity": 5.0, "dissolved_oxygen": 6.0}' \
    "valid" "Validation Endpoint"

echo ""
echo "Step 3: Testing error handling..."

# Test 7: Missing Field
test_endpoint "POST" "/api/ml/predict" \
    '{"pH": 7.0, "turbidity": 5.0}' \
    "MISSING_FIELDS" "Missing Field Error"

# Test 8: Invalid Value
test_endpoint "POST" "/api/ml/predict" \
    '{"pH": 20.0, "turbidity": 5.0, "dissolved_oxygen": 6.0}' \
    "VALIDATION_ERROR" "Invalid Value Error"

# Test 9: Invalid Request Format
test_endpoint "POST" "/api/ml/batch" \
    '{"invalid": "format"}' \
    "INVALID_REQUEST" "Invalid Request Format"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
