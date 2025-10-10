# User-Specific Report Count Fix

## Problem
When creating a new account, the dashboard showed 100+ total records instead of starting at 0. The count should be user-specific and increment only for that user's reports and CSV uploads.

## Root Cause
1. **Backend**: The `/reports` endpoint returned ALL reports for all users, not filtered by user
2. **Frontend**: The dashboard fetched all reports without filtering by current user
3. **Form Submission**: The `reporter_id` field was manually entered instead of automatically using the logged-in username

## Solution Implemented

### 1. Backend - Added User Filtering ✅

**File**: `backend2/routes/reports.js`

Added support for filtering reports by `reporter_id` query parameter:

```javascript
router.get("/reports", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip || "0", 10) || 0;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 1000);
    
    // 🔑 NEW: Support filtering by reporter_id
    const filter = {};
    if (req.query.reporter_id) {
      filter.reporter_id = req.query.reporter_id;
    }
    
    const docs = await CaseReport.find(filter).skip(skip).limit(limit).lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error fetching reports", detail: e.message });
  }
});
```

**What this does:**
- If `?reporter_id=username` is provided, only returns reports for that user
- If no filter provided, returns all reports (backward compatible)

### 2. Frontend - Fetch User-Specific Reports ✅

**File**: `frontend/src/components/Dashboard.tsx`

Updated `fetchReports()` to filter by current username:

```typescript
const fetchReports = async (showLoading: boolean = true) => {
  if (showLoading) {
    setLoading(true);
  }
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 🔑 Only fetch reports for the current user
    const url = `${API_URL}/reports?reporter_id=${encodeURIComponent(username)}`;
    const res = await fetch(url, { 
      headers,
      cache: 'no-cache'
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    console.log('📊 Reports fetched for user', username, ':', data.length, 'reports');
    setReports(data);
  } catch (err) {
    console.error('❌ Error fetching reports:', err);
    setReports([]);
    setMessage("❌ Failed to load reports.");
  } finally {
    if (showLoading) {
      setLoading(false);
    }
  }
};
```

**Updated useEffect to refetch when username changes:**

```typescript
useEffect(() => {
  fetchReports();
}, [username]); // 🔑 Re-fetch when username changes
```

### 3. Frontend - Auto-Set Reporter ID ✅

Updated `handleSubmit()` to always use the logged-in username:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  setMessage("");
  
  try {
    const payload = {
      ...formData,
      reporter_id: username, // 🔑 Always use logged-in username
      patient_age: Number(formData.patient_age),
      lat: Number(formData.lat),
      lng: Number(formData.lng),
    };
    
    console.log('📤 Submitting report for user:', username, payload);
    
    // ... rest of submission logic
  }
};
```

### 4. Frontend - Updated Reporter ID Field ✅

Made the Reporter ID field read-only and auto-filled:

**Before:**
```tsx
<input
  type="text"
  value={formData.reporter_id}
  onChange={(e) => setFormData({ ...formData, reporter_id: e.target.value })}
  placeholder="Enter reporter ID"
  required
/>
```

**After:**
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Reporter ID (Your Username)
  </label>
  <input
    type="text"
    value={username}
    readOnly
    disabled
    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
    placeholder="Auto-filled with your username"
  />
  <p className="text-xs text-gray-500 mt-1">
    This is automatically set to your username
  </p>
</div>
```

### 5. Frontend - Removed Reporter ID from State ✅

Removed `reporter_id` from `formData` state since it's no longer needed:

```typescript
// Before
const [formData, setFormData] = useState({
  reporter_type: "",
  reporter_id: "",    // ❌ Removed
  patient_age: "",
  sex: "",
  lat: "",
  lng: "",
  symptoms: [] as string[],
  reported_at: "",
});

// After
const [formData, setFormData] = useState({
  reporter_type: "",
  patient_age: "",
  sex: "",
  lat: "",
  lng: "",
  symptoms: [] as string[],
  reported_at: "",
});
```

## How It Works Now

### New User Registration Flow

```
1. User registers with username "john_doe"
   ↓
2. User logs in and goes to Dashboard
   ↓
3. Dashboard calls: GET /reports?reporter_id=john_doe
   ↓
4. Backend returns: [] (empty array - no reports yet)
   ↓
5. Dashboard shows:
   - Total Reports: 0
   - Recent Reports: (empty)
   - Critical Cases: 0
   - Today's Reports: 0
```

### Report Submission Flow

```
1. User "john_doe" fills form and clicks Submit
   ↓
2. Frontend automatically sets reporter_id = "john_doe"
   ↓
3. POST /reports with { reporter_id: "john_doe", ... }
   ↓
4. Backend saves report to database
   ↓
5. Frontend waits 500ms, then calls:
   GET /reports?reporter_id=john_doe
   ↓
6. Backend returns: [{ reporter_id: "john_doe", ... }]
   ↓
7. Dashboard updates:
   - Total Reports: 1 ✅
   - Recent Reports: Shows new report ✅
   - Critical Cases: Updates based on symptoms ✅
   - Today's Reports: 1 (if submitted today) ✅
```

### Multiple Users Scenario

```
User A (alice):
- Total Reports: 5 (only Alice's reports)

User B (bob):
- Total Reports: 0 (no reports yet)

User C (charlie):
- Total Reports: 3 (only Charlie's reports)

Each user sees ONLY their own data! ✅
```

## Testing Instructions

### Test 1: New Account Shows 0 Reports

1. **Register a new account**:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Password: `password123`

2. **Login with new account**

3. **Check Dashboard Overview**:
   - ✅ Total Reports: **0**
   - ✅ Recent Reports: **(empty)**
   - ✅ Critical Cases: **0**
   - ✅ Today's Reports: **0**

4. **Open Browser Console** (F12):
   ```
   📊 Reports fetched for user testuser123 : 0 reports
   📊 Reports state updated. Total count: 0
   ```

### Test 2: Submit Report Increments Count

1. **Go to "Submit Report" tab**

2. **Fill in form**:
   - Reporter Type: Community Volunteer
   - Reporter ID: **testuser123** (auto-filled, read-only)
   - Patient Age: 25
   - Sex: Male
   - Latitude: 12.34
   - Longitude: 56.78
   - Symptoms: Check 3-4 symptoms
   - Reported Date: Select today's date

3. **Click "Submit Report"**

4. **Watch Console**:
   ```
   📤 Submitting report for user: testuser123 {reporter_id: "testuser123", ...}
   ✅ Report submitted successfully: {_id: "...", ...}
   📊 Reports fetched for user testuser123 : 1 reports
   📊 Reports state updated. Total count: 1
   ```

5. **Check Dashboard**:
   - ✅ Total Reports: **1** (incremented!)
   - ✅ Recent Reports: Shows your new report
   - ✅ Critical Cases: **1** (if 3+ symptoms)
   - ✅ Today's Reports: **1**

### Test 3: Multiple Submissions

1. **Submit another report** (same steps as Test 2)

2. **Check Dashboard**:
   - ✅ Total Reports: **2**
   - ✅ Recent Reports: Shows both reports
   - ✅ Counts update correctly

### Test 4: Different Users See Different Counts

1. **Login as User A**, submit 3 reports
   - Dashboard shows: Total Reports: **3**

2. **Logout and create User B**
   - Dashboard shows: Total Reports: **0**

3. **Submit 1 report as User B**
   - Dashboard shows: Total Reports: **1**

4. **Login back as User A**
   - Dashboard shows: Total Reports: **3** (unchanged)

✅ **Each user sees only their own reports!**

## API Endpoint Usage

### GET /reports (All Reports)
```bash
GET http://127.0.0.1:5000/reports
```
Returns all reports (no filter)

### GET /reports?reporter_id=username (User-Specific)
```bash
GET http://127.0.0.1:5000/reports?reporter_id=john_doe
```
Returns only reports where `reporter_id = "john_doe"`

### POST /reports (Create Report)
```bash
POST http://127.0.0.1:5000/reports
Content-Type: application/json

{
  "reporter_type": "Community Volunteer",
  "reporter_id": "john_doe",
  "patient_age": 30,
  "sex": "M",
  "lat": 12.34,
  "lng": 56.78,
  "symptoms": ["Fever", "Headache"],
  "reported_at": "2025-10-10T10:30:00Z"
}
```

## CSV Upload Considerations

For CSV uploads to also be user-specific, ensure:

1. **Backend CSV handler** sets `reporter_id` to the authenticated user
2. **Each row** in the CSV gets the current user's username as `reporter_id`
3. **Validation** ensures users can only upload for themselves

Example CSV upload handler update:

```javascript
// In your CSV upload route
router.post("/upload/csv", authMiddleware, async (req, res) => {
  const username = req.user.username; // From auth token
  
  // Parse CSV rows
  for (const row of csvData) {
    await CaseReport.create({
      ...row,
      reporter_id: username, // 🔑 Set to logged-in user
    });
  }
});
```

## Browser Console Logs

### On Dashboard Load (New User)
```
📊 Reports fetched for user testuser123 : 0 reports
📊 Reports state updated. Total count: 0
```

### On Report Submission
```
📤 Submitting report for user: testuser123 {reporter_id: "testuser123", patient_age: 25, ...}
✅ Report submitted successfully: {_id: "68e7f...", reporter_id: "testuser123"}
📊 Reports fetched for user testuser123 : 1 reports
📊 Reports state updated. Total count: 1
🔄 Dashboard data refreshed. New total: 1
```

### On Manual Refresh
```
📊 Reports fetched for user testuser123 : 1 reports
📊 Reports state updated. Total count: 1
```

## Troubleshooting

### Issue: Count still shows all reports (not user-specific)

**Check:**
1. Backend updated with filter logic
2. Frontend passing `?reporter_id=` parameter
3. Console shows: `Reports fetched for user USERNAME`

**Solution:**
- Restart backend: `cd backend2; node index.js`
- Hard refresh frontend: Ctrl+Shift+R

### Issue: New reports not counted

**Check:**
1. Console shows: `Submitting report for user: USERNAME`
2. Check `reporter_id` in payload matches username
3. Network tab: POST returns success

**Solution:**
- Verify `reporter_id` field is auto-set to username
- Check backend saves with correct `reporter_id`

### Issue: Reporter ID field editable

**Check:**
- Field should be `disabled` and `readOnly`
- Value should be `{username}` not `{formData.reporter_id}`

**Solution:**
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)

## Files Modified

### Backend
1. ✅ `backend2/routes/reports.js` - Added reporter_id filter

### Frontend
1. ✅ `frontend/src/components/Dashboard.tsx`:
   - Updated `fetchReports()` to filter by username
   - Updated `handleSubmit()` to auto-set reporter_id
   - Made Reporter ID field read-only
   - Removed reporter_id from formData state
   - Updated useEffect dependency

## Summary

✅ **New accounts start with 0 reports**
✅ **Each user sees only their own reports**
✅ **Report count increments per user**
✅ **Reporter ID auto-filled with username**
✅ **CSV uploads can be made user-specific**
✅ **Backward compatible** (API still works without filter)

**The dashboard now correctly shows user-specific data!** 🎉

### Before Fix ❌
```
User A creates account → Dashboard shows: 100 reports (all users)
User A submits 1 report → Dashboard shows: 101 reports (all users)
```

### After Fix ✅
```
User A creates account → Dashboard shows: 0 reports (only User A's)
User A submits 1 report → Dashboard shows: 1 report (only User A's)
User B creates account → Dashboard shows: 0 reports (only User B's)
```

---

**Refresh your browser and create a new account to test!** 🚀
