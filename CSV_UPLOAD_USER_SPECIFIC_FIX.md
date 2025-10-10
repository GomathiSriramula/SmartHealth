# CSV Upload User-Specific Fix

## Problem
When users uploaded CSV files with case reports, the uploaded reports were not:
1. Appearing in the user's dashboard (Overview and Reports tabs)
2. Incrementing the "Total Reports" count for that user
3. Being associated with the logged-in user

## Root Cause
1. **Backend**: CSV upload route (`/upload/case-reports`) didn't have authentication
2. **Backend**: Used `reporter_id` from CSV file instead of authenticated user
3. **Frontend**: CSVUpload component didn't pass auth token
4. **Frontend**: Dashboard didn't refresh after successful CSV upload

## Solution Implemented

### 1. Backend - Added Authentication ✅

**File**: `backend2/routes/uploads.js`

**Added auth middleware import:**
```javascript
const { authMiddleware } = require("../utils/auth");
```

**Updated route with authentication:**
```javascript
router.post("/upload/case-reports", authMiddleware, upload.single("file"), async (req, res) => {
  // Now requires Bearer token in Authorization header
  const authenticatedUsername = req.user.username; // Get from auth token
  
  // ... rest of the route
});
```

### 2. Backend - Override reporter_id ✅

**Changed to always use authenticated username:**

```javascript
// Before - Used reporter_id from CSV (could be any value)
const caseReport = {
  reporter_type: data.reporter_type.trim(),
  reporter_id: data.reporter_id.trim(), // ❌ From CSV
  patient_age: parseInt(data.patient_age),
  // ...
};

// After - Always use logged-in user's username
const caseReport = {
  reporter_type: data.reporter_type.trim(),
  reporter_id: authenticatedUsername, // ✅ From auth token
  patient_age: parseInt(data.patient_age),
  // ...
};
```

**Key changes:**
- ✅ `reporter_id` from CSV is **ignored**
- ✅ All uploaded reports automatically get the logged-in user's username
- ✅ Users can only upload reports for themselves
- ✅ Added logging: `console.log('📤 CSV Upload: User', authenticatedUsername, ...)`

### 3. Frontend - Pass Token to CSVUpload ✅

**File**: `frontend/src/components/Dashboard.tsx`

```typescript
// Before - No props
<CSVUpload />

// After - Pass token and refresh callback
<CSVUpload 
  token={token} 
  onUploadSuccess={() => fetchReports(false)}
/>
```

### 4. Frontend - Update CSVUpload Component ✅

**File**: `frontend/src/components/CSVUpload.tsx`

**Added props interface:**
```typescript
interface CSVUploadProps {
  token: string;
  onUploadSuccess?: () => void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ token, onUploadSuccess }) => {
  // ...
}
```

**Send auth token in upload request:**
```typescript
const handleUpload = async () => {
  // ...
  
  const headers: HeadersInit = {};
  // 🔑 Add authorization header
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log('📤 Uploading CSV file:', selectedFile.name);

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers, // Include auth token
    body: formData,
  });
  
  // ...
};
```

**Trigger dashboard refresh after upload:**
```typescript
// After successful upload
console.log('✅ CSV upload successful:', data.summary);

// Refresh stats
fetchStats();

// 🔑 Trigger dashboard refresh to update report counts
if (onUploadSuccess && uploadType === 'case-reports') {
  console.log('🔄 Triggering dashboard refresh after CSV upload');
  // Wait for backend to finish processing
  setTimeout(() => {
    onUploadSuccess(); // Calls fetchReports(false) in Dashboard
  }, 500);
}
```

## How It Works Now

### CSV Upload Flow

```
1. User "alice" logs in and goes to CSV Upload tab
   ↓
2. User selects CSV file with case reports
   ↓
3. User clicks "Upload Case Reports"
   ↓
4. Frontend sends:
   - File data (multipart/form-data)
   - Authorization: Bearer <alice's_token>
   ↓
5. Backend authenticates token → Gets username "alice"
   ↓
6. Backend processes CSV:
   - Parses each row
   - Sets reporter_id = "alice" (ignores CSV value)
   - Validates data
   - Saves to database
   ↓
7. Backend returns: { successful: 10, failed: 0 }
   ↓
8. Frontend shows success message
   ↓
9. Frontend waits 500ms, then calls:
   GET /reports?reporter_id=alice
   ↓
10. Dashboard updates:
    - Total Reports: +10 (increased by number of CSV rows)
    - Recent Reports: Shows new reports
    - Critical Cases: Updates based on symptoms
    ✅ All CSV reports appear in user's dashboard!
```

### CSV File Format

**CSV columns (reporter_id can be present but will be ignored):**
```csv
reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
Community Volunteer,any_value,25,M,17.45,78.39,Fever|Headache,2025-11-01T10:30Z
ASHA Worker,ignored,32,F,17.46,78.40,Diarrhea,2025-11-02T14:15Z
```

**Note:** The `reporter_id` column in the CSV is **optional** and will be **overridden** with the logged-in user's username.

**Simplified CSV (reporter_id column can be omitted):**
```csv
reporter_type,patient_age,sex,lat,lng,symptoms,reported_at
Community Volunteer,25,M,17.45,78.39,Fever|Headache,2025-11-01T10:30Z
ASHA Worker,32,F,17.46,78.40,Diarrhea,2025-11-02T14:15Z
```

## Testing Instructions

### Test 1: CSV Upload Appears in Dashboard

1. **Login as User A** (e.g., `alice`)

2. **Check current report count**:
   - Go to Overview tab
   - Note the "Total Reports" count (e.g., 3)

3. **Go to CSV Upload tab**

4. **Prepare a test CSV file** (`test_reports.csv`):
```csv
reporter_type,patient_age,sex,lat,lng,symptoms,reported_at
Community Volunteer,25,M,17.45,78.39,Fever|Headache,2025-10-10T10:30Z
ASHA Worker,32,F,17.46,78.40,Diarrhea|Vomiting,2025-10-10T11:00Z
Clinic Staff,45,M,17.47,78.41,Nausea,2025-10-10T12:00Z
```

5. **Upload the file**:
   - Select "Case Reports" type
   - Choose file
   - Click "Upload Case Reports"

6. **Watch console** (F12):
```
📤 Uploading CSV file: test_reports.csv Type: case-reports
✅ CSV upload successful: { successful: 3, failed: 0 }
🔄 Triggering dashboard refresh after CSV upload
📊 Reports fetched for user alice : 6 reports
📊 Reports state updated. Total count: 6
```

7. **Go to Overview tab**:
   - ✅ Total Reports: **6** (3 original + 3 from CSV)
   - ✅ Recent Reports: Shows the 3 new reports
   - ✅ Critical Cases: Updated (if any had 3+ symptoms)

8. **Go to Reports tab**:
   - ✅ See all 6 reports in the table
   - ✅ All reports show `reporter_id: alice`

### Test 2: Different Users See Different Uploads

1. **Login as User A** (alice), upload 5 reports via CSV
   - Dashboard shows: Total Reports: **5**

2. **Logout and login as User B** (bob), upload 3 reports via CSV
   - Dashboard shows: Total Reports: **3** (doesn't see Alice's 5)

3. **Login back as User A** (alice)
   - Dashboard shows: Total Reports: **5** (doesn't see Bob's 3)

✅ **Each user sees only their own uploaded reports!**

### Test 3: Manual Submission + CSV Upload

1. **Login and manually submit 2 reports** via form
   - Total Reports: **2**

2. **Upload CSV with 3 reports**
   - Total Reports: **5** (2 manual + 3 CSV)

3. **Go to Reports tab**:
   - ✅ See all 5 reports
   - ✅ All have same `reporter_id` (your username)

## Browser Console Logs

### On CSV Upload
```
📤 Uploading CSV file: test_reports.csv Type: case-reports
✅ CSV upload successful: {totalRows: 3, successful: 3, failed: 0}
🔄 Triggering dashboard refresh after CSV upload
📊 Reports fetched for user alice : 6 reports
📊 Reports state updated. Total count: 6
```

### Backend Logs
```
📤 CSV Upload: User alice uploading case reports
[Processing CSV rows...]
Inserted 3 case reports
```

## API Changes

### POST /upload/case-reports

**Before:**
```bash
POST http://127.0.0.1:5000/upload/case-reports
Content-Type: multipart/form-data

[CSV file with any reporter_id values]
```

**After:**
```bash
POST http://127.0.0.1:5000/upload/case-reports
Authorization: Bearer <token>  # 🔑 NOW REQUIRED
Content-Type: multipart/form-data

[CSV file - reporter_id ignored, uses authenticated user]
```

**Response:**
```json
{
  "message": "CSV file processed successfully",
  "summary": {
    "totalRows": 10,
    "successful": 10,
    "failed": 0
  },
  "errors": []
}
```

## Dashboard Refresh Mechanism

```
CSV Upload Success
    ↓
Call onUploadSuccess() callback
    ↓
Execute: fetchReports(false)
    ↓
GET /reports?reporter_id=alice
    ↓
setReports(newData)
    ↓
React re-renders
    ↓
totalReports = reports.length (recalculates)
    ↓
Overview tab shows updated count ✅
Reports tab shows new reports ✅
```

## Security Improvements

### Before ❌
```
- Anyone could upload CSV without authentication
- Could set any reporter_id in CSV
- Could upload reports for other users
- No user isolation
```

### After ✅
```
- ✅ Authentication required (Bearer token)
- ✅ reporter_id automatically set to logged-in user
- ✅ Users can only upload their own reports
- ✅ Complete user isolation
- ✅ Audit trail (knows who uploaded what)
```

## Troubleshooting

### Issue: CSV upload shows "401 Unauthorized"

**Cause:** Not logged in or token expired

**Solution:**
1. Logout and login again
2. Ensure token is being passed in CSVUpload
3. Check console for auth errors

### Issue: Reports uploaded but not showing in dashboard

**Check:**
1. Console shows: `🔄 Triggering dashboard refresh`
2. Network tab shows GET /reports after upload
3. Response includes the new reports

**Solution:**
- Hard refresh browser (Ctrl+Shift+R)
- Check backend logs for errors
- Verify reports saved with correct reporter_id

### Issue: "Missing required fields" error

**Check CSV format:**
- ✅ Required columns: `reporter_type, patient_age, sex, lat, lng, symptoms, reported_at`
- ✅ Symptoms use pipe separator: `Fever|Headache|Nausea`
- ✅ Dates in ISO format: `2025-10-10T10:30:00Z`
- ✅ Sex values: `M`, `F`, or `O`

### Issue: Total count increases but reports don't show

**Cause:** Dashboard filtering by wrong username

**Solution:**
1. Check console: `Reports fetched for user XXXXX`
2. Verify username matches logged-in user
3. Logout and login again

## Files Modified

### Backend
1. ✅ `backend2/routes/uploads.js`
   - Added `authMiddleware` import
   - Added authentication to POST /upload/case-reports
   - Override `reporter_id` with authenticated username
   - Made `reporter_id` optional in CSV validation
   - Added console logging

### Frontend
1. ✅ `frontend/src/components/Dashboard.tsx`
   - Pass `token` prop to CSVUpload
   - Pass `onUploadSuccess` callback to CSVUpload

2. ✅ `frontend/src/components/CSVUpload.tsx`
   - Added `CSVUploadProps` interface
   - Accept `token` and `onUploadSuccess` props
   - Send Authorization header in upload request
   - Call `onUploadSuccess()` after successful upload
   - Added console logging

## Summary

✅ **CSV uploads now user-specific**
✅ **Reports appear in uploader's dashboard**
✅ **Total Reports count increments correctly**
✅ **Both Overview and Reports tabs show uploaded data**
✅ **Automatic dashboard refresh after upload**
✅ **Authentication required for uploads**
✅ **Complete user isolation**

### Before Fix ❌
```
User uploads CSV → Reports saved with any reporter_id
Dashboard doesn't update → No reports visible
Count stays same → Manual refresh needed
```

### After Fix ✅
```
User uploads CSV → Reports saved with user's username
Dashboard auto-refreshes → All reports visible
Count increments → Immediate feedback
Overview + Reports tabs → Show uploaded data
```

---

**Refresh your browser and try uploading a CSV file!** 🚀

The uploaded reports will:
1. ✅ Automatically use your username as reporter_id
2. ✅ Appear in your Overview tab
3. ✅ Appear in your Reports tab
4. ✅ Increment your Total Reports count
5. ✅ Update Critical Cases and Today's Reports
