# System Analysis - Quick Reference

## Key Findings

### 1️⃣ Authentication
- **Mechanism:** JWT tokens (7-day expiry)
- **Login:** Email + password
- **Token Storage:** localStorage (`smarthealth_token`)
- **Roles:** ❌ NONE - all users equal

### 2️⃣ Alerts
- **Who Sees Them:** ✅ ALL USERS see SAME alerts
- **Based On:** Location (consecutive HIGH predictions)
- **Scope:** GLOBAL system-wide
- **User Field in Alert:** ❌ NO
- **Filtering:** By location & status only

### 3️⃣ Alert Creation Trigger
```
HIGH-risk prediction at Location X
    + previous HIGH prediction at Location X (within 24h)
    = Alert created (severity: high)
```

### 4️⃣ Reports
- **Who Sees Them:** User sees ONLY their own reports
- **User Field:** `reporter_id` (username)
- **Scope:** User-specific
- **Filtering:** By reporter_id ✅

### 5️⃣ API Endpoints

| Endpoint | Auth | Scope | Filter |
|----------|------|-------|--------|
| POST /auth/login | No | Self | N/A |
| POST /auth/register | No | Self | N/A |
| GET /reports | Optional | All data | By reporter_id |
| GET /alerts | Optional | All data | By location, status |
| POST /alerts/{id}/resolve | Optional | All alerts | By ID |
| POST /ml-predictions/predict | No | Global | N/A |
| GET /ml-predictions | No | All data | By location, riskLevel |

### 6️⃣ Data Model

**User:**
- ❌ NO role field
- ❌ NO region/location field
- ❌ NO preferences field

**Alert:**
- ❌ NO user_id or assignedTo field
- ✅ HAS location field
- ✅ HAS status field (active/resolved)

**Report:**
- ✅ HAS reporter_id (links to user)
- User-specific filtering works ✅

### 7️⃣ What's NOT Implemented

| Feature | Status |
|---------|--------|
| User Roles (admin/operator/viewer) | ❌ |
| Role-Based Access Control (RBAC) | ❌ |
| User-Specific Alerts | ❌ |
| Alert Assignment to User/Team | ❌ |
| Geographic Alerts (by region) | ❌ |
| Custom Notification Rules | ❌ |
| Alert Acknowledgment History | ❌ |
| Multi-Admin Support | ❌ |

### 8️⃣ Critical Architecture Insight

**System treats alerts as:**
- **LOCATION-BASED** (tied to physical location, not user)
- **GLOBAL** (all users see same alerts)
- **NOT OWNED** (no user/team assignment)

**System treats reports as:**
- **USER-BASED** (each user's own data)
- **PRIVATE** (users only see their own)
- **OWNED** (reporter_id field)

## Three Possible Approaches for User-Specific Alerts

### Option A: Keep Alerts Global (Current Model)
- All users see all alerts
- Add `assignedTo` field for tracking who's handling it
- Best for: Small teams, shared responsibility
- Changes needed: Minor (just UI for assignment)

### Option B: Filter Alerts by User Location/Region
- Add `user.region` field
- Filter alerts by: `alert.location IN user.assignedRegions`
- Best for: Geographic regions, field staff
- Changes needed: Moderate (schema + filtering)

### Option C: Full User-Based Alerts
- Add `alert.assignedTo` = [userIds]
- Or add `alert.visibility` = 'public'|'team'|'private'
- Best for: Role-based organization
- Changes needed: Major (schema + RBAC layer)

## Data Flow Comparison

### Reports (Working User-Specific)
```
User "john" logs in
   ↓
GET /reports?reporter_id=john
   ↓
User sees ONLY john's reports ✅
```

### Alerts (Not User-Specific)
```
User "john" logs in
   ↓
GET /alerts?status=active
   ↓
User sees ALL active alerts (same as every other user) ❌
```

## Testing Evidence

- ✅ Alerts correctly generated on 2nd consecutive HIGH prediction
- ✅ Alerts correctly display all users' data
- ✅ Status filters work (active/resolved)
- ✅ Location filters work
- ✅ Email notifications sent
- ❌ No test for user-specific alert viewing

## Files to Review for Changes

**If you want to make alerts user-specific:**

1. [backend2/models/Alert.js](backend2/models/Alert.js) - Add `assignedTo` field
2. [backend2/routes/alertsApi.js](backend2/routes/alertsApi.js) - Add user filtering in GET /alerts
3. [backend2/routes/mlPredictions.js](backend2/routes/mlPredictions.js) - Assign alerts when creating
4. [frontend/src/components/AlertsPanel.tsx](frontend/src/components/AlertsPanel.tsx) - Pass username to fetch

**If you want to add roles:**

1. [backend2/models.js](backend2/models.js) - Add `role` field to User schema
2. [backend2/utils/auth.js](backend2/utils/auth.js) - Create role middleware
3. [backend2/routes/auth.js](backend2/routes/auth.js) - Include role in JWT token
4. ALL route files - Add role checks where needed

## Connection Status

- ✅ Backend running on `http://localhost:5000`
- ✅ Frontend running on `http://localhost:5175`
- ✅ MongoDB connected
- ✅ ML service integrated
- ✅ Email notifications configured

---

**Ready to implement safe changes.** Understanding is complete.
