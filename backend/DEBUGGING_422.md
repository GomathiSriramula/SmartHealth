# Fixing 422 Unprocessable Content Error

## What Changed

### 1. **Made Schema More Flexible** (`app/schemas.py`)
- Now accepts `symptoms` as either an array `["fever", "cough"]` OR a comma-separated string `"fever, cough"`
- Now accepts `sex` as lowercase and normalizes it: `"male"` → `"M"`, `"female"` → `"F"`
- Now accepts `reported_at` as ISO string format with flexible parsing
- Added validators to handle common frontend format issues

### 2. **Added Debug Endpoint** (`app/routes/reports.py`)
- New endpoint: `POST /reports/debug` - Shows exactly what data the server receives
- Helps identify format mismatches between frontend and backend

### 3. **Better Error Handling**
- Added try-catch blocks in endpoints
- More descriptive error messages

---

## Expected Request Format

Your frontend should send data to `POST http://127.0.0.1:8000/reports` with:

### Headers:
```
Content-Type: application/json
x-api-key: secret-key
```

### Body (JSON):
```json
{
  "reporter_type": "ASHA",
  "reporter_id": "asha-001",
  "patient_age": 35,
  "sex": "F",
  "lat": 17.447,
  "lng": 78.39,
  "symptoms": ["fever", "cough", "headache"],
  "reported_at": "2025-10-09T12:00:00Z"
}
```

### Field Requirements:

| Field | Type | Required | Valid Values | Notes |
|-------|------|----------|--------------|-------|
| `reporter_type` | string | ✅ Yes | Any string | e.g., "ASHA", "Citizen" |
| `reporter_id` | string | ✅ Yes | Any string | Unique identifier |
| `patient_age` | integer | ✅ Yes | 0-120 | Must be a number, not string |
| `sex` | string | ✅ Yes | "M", "F", "O" | Now accepts "male"/"female" too |
| `lat` | float | ✅ Yes | -90 to 90 | Latitude |
| `lng` | float | ✅ Yes | -180 to 180 | Longitude |
| `symptoms` | array OR string | ✅ Yes | ["fever"] OR "fever, cough" | Array preferred |
| `reported_at` | datetime string | ✅ Yes | ISO 8601 format | e.g., "2025-10-09T12:00:00Z" |

---

## Common Frontend Mistakes That Cause 422

### ❌ Mistake 1: Missing x-api-key header
```javascript
// Wrong
fetch('http://127.0.0.1:8000/reports', {
  method: 'POST',
  body: JSON.stringify(data)
})

// Correct
fetch('http://127.0.0.1:8000/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'secret-key'
  },
  body: JSON.stringify(data)
})
```

### ❌ Mistake 2: Patient age as string
```javascript
// Wrong
{ patient_age: "35" }

// Correct
{ patient_age: 35 }
```

### ❌ Mistake 3: Invalid sex value
```javascript
// Wrong
{ sex: "unknown" }

// Now works (normalized automatically)
{ sex: "male" }  // → "M"
{ sex: "M" }     // → "M"

// Best
{ sex: "M" }
```

### ❌ Mistake 4: Symptoms not an array
```javascript
// Now both work
{ symptoms: ["fever", "cough"] }  // Preferred
{ symptoms: "fever, cough" }      // Also works now
```

### ❌ Mistake 5: Missing required fields
All 8 fields are required. Check that none are `undefined` or `null`.

---

## How to Debug

### Step 1: Restart your FastAPI server
```powershell
# Kill the old process
Stop-Process -Id 26552 -Force

# Restart (if using uvicorn directly)
cd d:\hackaithon\smart-health-ai
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# OR if using docker
docker-compose restart
```

### Step 2: Test with Python script
```powershell
python test_api.py
```

This will show you:
- ✅ If valid requests work
- ✅ What data format the server expects
- ✅ Whether common format issues are handled

### Step 3: Use the debug endpoint from your browser/Postman

**Send to:** `POST http://127.0.0.1:8000/reports/debug`

**Headers:**
```
x-api-key: secret-key
Content-Type: application/json
```

**Body:** (whatever your frontend is sending)

**Response:** Shows exactly what the server received and the expected types

### Step 4: Check browser console for the actual request

In your browser DevTools:
1. Go to Network tab
2. Submit the form
3. Click on the "reports" request
4. Check:
   - **Request Headers**: Is `x-api-key` present?
   - **Request Payload**: What JSON is being sent?
   - **Response**: What's the error message?

---

## Quick Fix for Your Frontend (Dashboard.tsx)

Without seeing your code, here's the likely fix:

```typescript
// Make sure all required fields are included and correct types
const reportData = {
  reporter_type: "ASHA",
  reporter_id: reporterId,
  patient_age: parseInt(age),  // ← Convert to number!
  sex: sex.toUpperCase(),       // ← "M", "F", or "O"
  lat: parseFloat(latitude),    // ← Convert to number!
  lng: parseFloat(longitude),   // ← Convert to number!
  symptoms: symptoms,           // ← Must be array: ["fever", "cough"]
  reported_at: new Date().toISOString()  // ← ISO format
};

const response = await fetch('http://127.0.0.1:8000/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'secret-key'  // ← Don't forget this!
  },
  body: JSON.stringify(reportData)
});

if (!response.ok) {
  const errorData = await response.json();
  console.error('Validation errors:', errorData);
  throw new Error(`Error: ${response.status}`);
}
```

---

## Test URLs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `http://127.0.0.1:8000/reports/debug` | See what server receives (no validation) |
| POST | `http://127.0.0.1:8000/reports` | Submit case report (with validation) |
| GET | `http://127.0.0.1:8000/reports` | List all reports |
| GET | `http://127.0.0.1:8000/docs` | Interactive API documentation |

---

## Still Getting 422?

1. **Check server logs** - The console where uvicorn is running will show validation errors
2. **Use /reports/debug** - It will show you the exact data types received
3. **Share the error** - Copy the full error response from the Network tab
4. **Check API docs** - Visit http://127.0.0.1:8000/docs and try the request there

The interactive docs at `/docs` let you test the API directly and show you the expected format!
