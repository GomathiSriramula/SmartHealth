# Role-Based Data Isolation - Quick Validation Guide

**Created:** February 10, 2026  
**Purpose:** Validate role-based data isolation across all GET endpoints  
**Status:** Implementation Complete ✅

---

## What Was Implemented

### ✅ Authentication Layer
- `authMiddleware` on every protected GET endpoint
- Fetches user from database (includes adminLocation)
- Returns 401 if unauthenticated

### ✅ Authorization Layer (locationGuard pattern applied to GET)
- **ADMIN:** Location filter = assigned village (case-insensitive regex)
- **USER/OPERATOR:** No location filter (see all records)
- **ADMIN without location:** Return 500 (not allowed to proceed)

### ✅ Cross-Village Protection (ID endpoints)
- `:id` endpoints return 403 if ADMIN accesses wrong village
- Returns message: `"You can only access X from your assigned village"`
- Prevents enumeration attacks (403 instead of 404)

### ✅ Consistent Response Formats
- GET responses unchanged by role
- Same JSON structure for all users
- No breaking API changes

---

## Endpoints Validated

### Predictions API
| Endpoint | Method | Auth | Admin Filter | ID Protect |
|----------|--------|------|--------------|-----------|
| /api/predictions | GET | ✅ | ✅ | N/A |
| /api/predictions/:id | GET | ✅ | N/A | ✅ |
| /api/predictions/stats/summary | GET | ✅ | ✅ | N/A |

### Alerts API
| Endpoint | Method | Auth | Admin Filter | ID Protect |
|----------|--------|------|--------------|-----------|
| /api/alerts | GET | ✅ | ✅ | N/A |
| /api/alerts/:id | GET | ✅ | N/A | ✅ |
| /api/alerts/stats/summary | GET | ✅ | ✅ | N/A |

---

## How to Validate

### Option 1: Run Automated Test Suite (Recommended)

**Requirements:**
- Node.js installed
- Backend running on http://localhost:5000
- MongoDB accessible

**Execute:**
```bash
cd d:\SmartHealthFullProject
npm install axios  # if not already installed
node test_role_based_isolation.js
```

**What it tests:**
1. Creates 4 test users (2 ADMIN in different villages, 1 USER, 1 OPERATOR)
2. Creates 4 test predictions (2 in Rampur, 2 in Delhi)
3. Validates role-based filtering on all GET endpoints
4. Checks cross-village access is denied (403)
5. Verifies response format consistency

**Expected Output:**
```
✅ rampur_user (USER): Got 4 predictions (all villages)
✅ rampur_admin (ADMIN): Got 2 predictions (Rampur only)
✅ delhi_admin (ADMIN): Got 2 predictions (Delhi only)
✅ Can access own village:id prediction (200)
✅ Blocked from accessing different village:id (403)
✅ Response format identical for USER and ADMIN
```

---

### Option 2: Manual Testing with curl

#### Step 1: Register Test Users
```bash
# Register USER
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "testuser@test.com",
    "role": "USER"
  }'

# Register ADMIN (Rampur)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "rampur_admin",
    "password": "password123",
    "email": "rampur_admin@test.com",
    "role": "ADMIN",
    "state": "State1",
    "district": "District1",
    "village": "Rampur"
  }'

# Register ADMIN (Delhi)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "delhi_admin",
    "password": "password123",
    "email": "delhi_admin@test.com",
    "role": "ADMIN",
    "state": "State2",
    "district": "District2",
    "village": "Delhi"
  }'
```

#### Step 2: Get Auth Tokens
```bash
# Login USER
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@test.com", "password": "password123"}' \
  | jq '.token' > token_user.txt

# Login ADMIN (Rampur)
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "rampur_admin@test.com", "password": "password123"}' \
  | jq '.token' > token_rampur_admin.txt

# Login ADMIN (Delhi)
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "delhi_admin@test.com", "password": "password123"}' \
  | jq '.token' > token_delhi_admin.txt
```

#### Step 3: Create Test Data
```bash
# Create Rampur prediction
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat token_user.txt)" \
  -d '{
    "predictionType": "Water Quality",
    "location": "Rampur",
    "riskLevel": "high",
    "details": "Test prediction Rampur",
    "confidence": 85
  }' | jq '.prediction.id' > pred_rampur_id.txt

# Create Delhi prediction
curl -X POST http://localhost:5000/api/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat token_user.txt)" \
  -d '{
    "predictionType": "Water Quality",
    "location": "Delhi",
    "riskLevel": "medium",
    "details": "Test prediction Delhi",
    "confidence": 75
  }' | jq '.prediction.id' > pred_delhi_id.txt
```

#### Step 4: Validate Isolation

**USER should see all predictions:**
```bash
curl -H "Authorization: Bearer $(cat token_user.txt)" \
  http://localhost:5000/api/predictions | jq '.predictions | length'
# Expected: 2 (or more if other data exists)
```

**Rampur ADMIN should see only Rampur:**
```bash
curl -H "Authorization: Bearer $(cat token_rampur_admin.txt)" \
  http://localhost:5000/api/predictions | jq '.predictions[].location'
# Expected: ["Rampur", "Rampur"] (or similar, only Rampur)
```

**Rampur ADMIN accessing Delhi prediction should fail:**
```bash
curl -H "Authorization: Bearer $(cat token_rampur_admin.txt)" \
  http://localhost:5000/api/predictions/$(cat pred_delhi_id.txt)
# Expected: 403 Forbidden
# Response: {"error": "Forbidden", "detail": "You can only access predictions..."}
```

**USER accessing any prediction should succeed:**
```bash
curl -H "Authorization: Bearer $(cat token_user.txt)" \
  http://localhost:5000/api/predictions/$(cat pred_delhi_id.txt) | jq '.success'
# Expected: true
```

---

## Validation Checklist

### Authentication
- [ ] GET /api/predictions without token returns 401
- [ ] GET /api/predictions with invalid token returns 401
- [ ] GET /api/predictions with valid token returns 200

### Authorization (Role-Based Filtering)
- [ ] USER sees all predictions (all villages)
- [ ] OPERATOR sees all predictions (all villages)
- [ ] ADMIN sees only their village predictions
- [ ] ADMIN(Rampur) cannot see Delhi predictions

### Cross-Village Protection
- [ ] GET /predictions/rampur-id as USER returns 200
- [ ] GET /predictions/delhi-id as USER returns 200
- [ ] GET /predictions/rampur-id as ADMIN(Rampur) returns 200
- [ ] GET /predictions/delhi-id as ADMIN(Rampur) returns **403 Forbidden**
- [ ] GET /predictions/delhi-id as ADMIN(Delhi) returns 200
- [ ] GET /predictions/rampur-id as ADMIN(Delhi) returns **403 Forbidden**

### Statistics Filtering
- [ ] GET /predictions/stats shows 4 predictions for USER
- [ ] GET /predictions/stats shows 2 predictions for ADMIN(Rampur)
- [ ] GET /predictions/stats shows 2 predictions for ADMIN(Delhi)

### Same for Alerts
- [ ] GET /api/alerts filters by admin village
- [ ] GET /api/alerts/:id returns 403 for cross-village ADMIN access
- [ ] GET /api/alerts/stats/summary filters correctly

### Response Format
- [ ] User response has same keys as Admin response
- [ ] No additional fields added for Admin
- [ ] Pagination fields (skip, limit) consistent
- [ ] Error response format consistent across endpoints

---

## Violations to Look For

### Critical (STOP deployment if found)
```
❌ ADMIN sees predictions from other villages
   → Data leakage vulnerability
   → Security hole

❌ GET /predictions/:id returns 200 for cross-village ADMIN
   → Direct unauthorized access
   → Must return 403
```

### High (Fix before deployment)
```
❌ GET /predictions/stats shows wrong totals for ADMIN
   → Incorrect data reporting
   → Admin trust issue

❌ Response format differs by role
   → API breaking change
   → Client compatibility issue
```

### Medium (Address in follow-up)
```
⚠️  Error messages reveal system details
   → Could help attackers
   → Review error response content
```

---

## Success Criteria

**All tests PASS if:**
1. ✅ USER and OPERATOR see all records (no filtering)
2. ✅ ADMIN sees only their village records
3. ✅ ADMIN cross-village :id access returns 403 (not 200 or 404)
4. ✅ Statistics count only visible records
5. ✅ Response format identical regardless of role
6. ✅ Error messages clear and consistent

**Any violation found:**
- Document the endpoint and specific test case
- Create GitHub issue with details
- Do not merge to main branch
- Fix and re-test

---

## Test Files Provided

1. **test_role_based_isolation.js**
   - Automated test suite
   - Tests all 6 GET endpoints
   - Creates test data and users
   - Validates isolation rules
   - Run: `node test_role_based_isolation.js`

2. **ROLE_BASED_ISOLATION_TEST_PLAN.md**
   - Detailed test strategy
   - Expected behaviors
   - Isolation rules
   - Remediation checklist

3. **ROLE_BASED_ISOLATION_AUDIT.md**
   - Code review findings
   - Implementation details
   - Security validation
   - Performance notes

4. **ROLE_BASED_ISOLATION_QUICK_GUIDE.md** (this file)
   - Quick reference
   - How to validate
   - Checklist
   - Success criteria

---

## Deployment Steps

1. **Dev Environment**
   ```bash
   npm test  # Run test_role_based_isolation.js
   ```

2. **Staging Environment**
   - Deploy code changes
   - Run full integration tests
   - Verify with real data
   - Check performance

3. **Production Environment**
   - Deploy to production
   - Monitor error logs (403 responses)
   - Track access patterns
   - Verify no data anomalies

---

## Support

If tests fail:
1. Check [ROLE_BASED_ISOLATION_AUDIT.md](ROLE_BASED_ISOLATION_AUDIT.md) for implementation details
2. Review [ROLE_BASED_ISOLATION_TEST_PLAN.md](ROLE_BASED_ISOLATION_TEST_PLAN.md) for expected behaviors
3. Verify backend is running and database is accessible
4. Check MongoDB connection in .env
5. Ensure test users can be created (no duplicate emails)

---

## Questions?

Refer to:
- [backend2/routes/predictionsApi.js](backend2/routes/predictionsApi.js) - Implementation
- [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js) - Implementation
- [backend2/utils/auth.js](backend2/utils/auth.js) - Authentication
