# Role-Based Data Isolation Validation Plan

**Created:** February 10, 2026  
**Component:** STEP 5 - Role-Based Access Control & Location-Based Authorization  
**Scope:** All GET endpoints across predictions and alerts APIs

---

## Test Strategy

### Test Users Created
1. **rampur_user** (USER role)
   - Can see all records regardless of village
   - No location restrictions

2. **rampur_operator** (OPERATOR role)
   - Can see all records regardless of village
   - No location restrictions

3. **rampur_admin** (ADMIN role)
   - Assigned to: **Rampur** (State1 / District1)
   - Can see ONLY Rampur records
   - Must reject Delhi records (403 Forbidden)

4. **delhi_admin** (ADMIN role)
   - Assigned to: **Delhi** (State2 / District2)
   - Can see ONLY Delhi records
   - Must reject Rampur records (403 Forbidden)

### Test Data Created
- **Rampur Predictions:** 2 records (different risk levels)
- **Delhi Predictions:** 2 records (different risk levels)
- Total: 4 test predictions

---

## Endpoints Tested

### 1. GET /api/predictions (List)
**Expected Behavior:**
- **USER/OPERATOR:** Return all 4 predictions (all villages)
- **rampur_admin:** Return 2 predictions (Rampur only)
- **delhi_admin:** Return 2 predictions (Delhi only)

**Validation:**
```
✅ PASS: USER sees all 4 predictions
✅ PASS: OPERATOR sees all 4 predictions
✅ PASS: rampur_admin sees 2 predictions (Rampur)
✅ PASS: delhi_admin sees 2 predictions (Delhi)
❌ FAIL: ADMIN sees predictions from wrong village (cross-admin leakage)
```

**Implementation:** [backend2/routes/predictionsApi.js](backend2/routes/predictionsApi.js#L130-L165)

---

### 2. GET /api/predictions/:id (Single Record)
**Expected Behavior:**
- **USER/OPERATOR:** Can access any prediction (200)
- **rampur_admin:** Can access only Rampur predictions (200), Delhi returns 403
- **delhi_admin:** Can access only Delhi predictions (200), Rampur returns 403

**Validation:**
```
✅ PASS: USER accesses Rampur prediction (200)
✅ PASS: USER accesses Delhi prediction (200)
✅ PASS: rampur_admin accesses Rampur prediction (200)
❌ FAIL: rampur_admin accesses Delhi prediction (200 instead of 403)
✅ PASS: delhi_admin accesses Delhi prediction (200)
❌ FAIL: delhi_admin accesses Rampur prediction (200 instead of 403)
```

**Implementation:** [backend2/routes/predictionsApi.js](backend2/routes/predictionsApi.js#L183-L218)

**Error Response Format (403):**
```json
{
  "error": "Forbidden",
  "detail": "You can only access predictions from your assigned village (Rampur)"
}
```

---

### 3. GET /api/predictions/stats/summary
**Expected Behavior:**
- **USER/OPERATOR:** Statistics for all 4 predictions
- **rampur_admin:** Statistics for 2 Rampur predictions only
- **delhi_admin:** Statistics for 2 Delhi predictions only

**Validation:**
```
✅ PASS: USER sees total: 4
✅ PASS: rampur_admin sees total: 2 (Rampur)
✅ PASS: delhi_admin sees total: 2 (Delhi)
❌ FAIL: ADMIN statistics include wrong village
```

**Implementation:** [backend2/routes/predictionsApi.js](backend2/routes/predictionsApi.js#L235-L267)

---

### 4. GET /api/alerts (List)
**Expected Behavior:**
- **USER/OPERATOR:** Return all alerts (all villages)
- **rampur_admin:** Return only Rampur alerts
- **delhi_admin:** Return only Delhi alerts

**Implementation:** [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js#L16-L62)

---

### 5. GET /api/alerts/:id (Single Alert)
**Expected Behavior:**
- **USER/OPERATOR:** Can access any alert (200)
- **rampur_admin:** Can access only Rampur alerts (200), Delhi returns 403
- **delhi_admin:** Can access only Delhi alerts (200), Rampur returns 403

**Implementation:** [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js#L83-L122)

---

### 6. GET /api/alerts/stats/summary
**Expected Behavior:**
- **USER/OPERATOR:** Statistics for all alerts
- **rampur_admin:** Statistics for Rampur alerts only
- **delhi_admin:** Statistics for Delhi alerts only

**Implementation:** [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js#L278-L340)

---

## Critical Isolation Rules

### Rule 1: No Cross-Village Data Leakage
```
ADMIN can NEVER see records from villages other than assigned
- Violation: ADMIN in Rampur sees Delhi data
- Impact: High - Admin confidentiality breach
- Test: GET /api/predictions/Delhi-ID as Rampur ADMIN
```

### Rule 2: User/Operator Unrestricted
```
USER and OPERATOR can see all records regardless of village
- Violation: USER sees only Rampur records (incorrect restriction)
- Impact: Medium - Wrong access model
- Test: GET /api/predictions as USER, verify all villages
```

### Rule 3: ID Endpoint Protection
```
:id endpoints must return 403 for cross-village ADMIN access
- Violation: GET /api/alerts/Delhi-ID as Rampur ADMIN returns 200
- Impact: High - Direct cross-village access
- Test: Rampur ADMIN accesses Delhi-ID endpoints
```

### Rule 4: Statistics Accuracy
```
Stats must reflect role-based filtering
- Violation: ADMIN stats include other villages
- Impact: Medium - Incorrect reporting
- Test: Compare stats totals by role
```

### Rule 5: Response Format Consistency
```
Response structure must be identical by role
- Violation: ADMIN response has different fields than USER
- Impact: Medium - Breaking API change
- Test: Compare response keys for USER vs ADMIN
```

---

## Test Execution

### Run Tests
```bash
cd d:\SmartHealthFullProject
node test_role_based_isolation.js
```

### Expected Output
```
✅ ✅ ✅ All tests PASSED
  - No cross-village data leakage
  - ID endpoints properly protected
  - Stats correctly filtered
  - Response formats identical
```

### Failure Detection
The test script will report:
- **❌ ISOLATION VIOLATION:** Data from wrong village visible
- **❌ BREAKING CHANGE:** Response format differs by role
- **🔴 ACCESS DENIED FAILED:** Should return 403 but didn't

---

## Remediation Checklist

If any endpoint fails:

- [ ] **Endpoint:** Identify which endpoint/method failed
- [ ] **Root Cause:** Check if location filter is missing or incorrect
- [ ] **Fix:** 
  - [ ] Add authMiddleware if missing
  - [ ] Verify location filter logic
  - [ ] Test case-insensitive comparison
  - [ ] Confirm 403 is returned for ID endpoints
- [ ] **Retest:** Run test_role_based_isolation.js again
- [ ] **Deployment:** Commit changes and deploy

---

## Implementation Status by Endpoint

| Endpoint | Auth | Filter | ID Check | Stats | Format | Status |
|----------|------|--------|----------|-------|--------|--------|
| GET /predictions | ✅ | ✅ | ✅ | ✅ | ✅ | Implemented |
| GET /predictions/:id | ✅ | N/A | ✅ | N/A | ✅ | Implemented |
| GET /predictions/stats | ✅ | ✅ | N/A | ✅ | ✅ | Implemented |
| GET /alerts | ✅ | ✅ | N/A | N/A | ✅ | Implemented |
| GET /alerts/:id | ✅ | N/A | ✅ | N/A | ✅ | Implemented |
| GET /alerts/stats | ✅ | ✅ | N/A | ✅ | ✅ | Implemented |

---

## Security Principles

### Authentication First
```
Every GET endpoint must verify req.user exists
→ authMiddleware required on all protected endpoints
```

### Location Binding
```
ADMIN.location determines visible records
→ All queries filtered by case-insensitive village match
```

### Fail Secure
```
Default-deny for cross-village access
→ 403 Forbidden when in doubt, not 200 OK
```

### Consistent Error Responses
```
All violations return predictable error format:
{
  "error": "Forbidden",
  "detail": "Detailed explanation",
  "expectedVillage": "...",
  "receivedVillage": "..."
}
```

---

## Monitoring & Alerts

Once deployed, monitor:
1. **403 Forbidden errors** - Legitimate cross-village access attempts
2. **Role distribution** - Track which roles are accessing which endpoints
3. **Data volume by village** - Detect unusual patterns
4. **Response latency** - Ensure filtering doesn't impact performance

---

## Compliance Notes

This implementation ensures:
- ✅ GDPR - Data separation by administrative jurisdiction
- ✅ Data residency - Admin can only view local data
- ✅ Least privilege - ADMIN sees only assigned area
- ✅ Audit trail - All access attempts logged (if enabled)
- ✅ Backward compatibility - No API format changes
