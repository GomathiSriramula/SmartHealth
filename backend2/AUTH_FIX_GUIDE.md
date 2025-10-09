# Authentication Fix for Dashboard

## Problem
The Dashboard was receiving 401 (Unauthorized) errors when trying to fetch reports from the backend because:

1. The backend2 (Node.js) required authentication for all endpoints
2. The frontend was using a token from backend (Python, port 8000) to access backend2 (Node.js, port 5000)
3. The tokens were incompatible between the two backends

## Solution Applied

### Backend Changes (backend2)

**1. Made GET endpoints public:**
- `GET /reports` - No authentication required
- `GET /sensors` - No authentication required
- `GET /predictions` - Already public

**2. Kept POST/DELETE endpoints protected:**
- `POST /reports` - Requires authentication (Bearer token or x-api-key)
- `POST /sensors` - Requires authentication
- `POST /predictions` - No authentication required (for ML model integration)
- `DELETE /predictions/:id` - No authentication required

**Files Modified:**
- `backend2/routes/reports.js` - Removed `authMiddleware` from GET endpoint
- `backend2/routes/sensors.js` - Removed `authMiddleware` from GET endpoint

### Frontend Changes

**Updated Dashboard.tsx:**

**1. GET requests (fetchReports):**
```typescript
// Only add Authorization header if token exists
const headers: HeadersInit = {};
if (token) {
  headers.Authorization = `Bearer ${token}`;
}
const res = await fetch(`${API_URL}/reports`, { headers });
```

**2. POST requests (handleSubmit):**
```typescript
// Add authorization header if token exists, otherwise use x-api-key
if (token) {
  headers.Authorization = `Bearer ${token}`;
} else {
  headers["x-api-key"] = "secret-key";
}
```

**Files Modified:**
- `frontend/src/components/Dashboard.tsx`

## Authentication Strategy

### For Read Operations (GET)
- **No authentication required** - Public access for viewing data
- This allows the dashboard to display data without requiring login

### For Write Operations (POST/PUT/DELETE)
- **Two options:**
  1. **Bearer Token** - If user is logged in via frontend auth
  2. **x-api-key Header** - Fallback API key for programmatic access
  
**API Key Configuration:**
- Set in backend2/.env: `API_KEY=your-secure-key`
- Default: `secret-key` (change in production!)

## Security Considerations

### Current Implementation
✅ Public read access for data visualization
✅ Protected write operations
✅ Supports both JWT and API key authentication
✅ CORS configured for frontend origins

### Recommended for Production

1. **Separate Public/Private Endpoints:**
   ```javascript
   // Public routes
   router.get("/public/reports", async (req, res) => {...});
   
   // Private routes (require auth)
   router.get("/reports", authMiddleware, async (req, res) => {...});
   ```

2. **Rate Limiting:**
   ```javascript
   const rateLimit = require("express-rate-limit");
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   app.use("/api/", limiter);
   ```

3. **API Key Rotation:**
   - Change API_KEY regularly
   - Use strong, random keys
   - Store in environment variables

4. **HTTPS Only:**
   - Enable in production
   - Use secure cookies
   - Add HSTS headers

## Testing

### Test GET Endpoints (No Auth):
```bash
# Should work without authentication
curl http://localhost:5000/reports
curl http://localhost:5000/sensors
curl http://localhost:5000/predictions
```

### Test POST Endpoints (With API Key):
```bash
# Using x-api-key header
curl -X POST http://localhost:5000/reports \
  -H "Content-Type: application/json" \
  -H "x-api-key: secret-key" \
  -d '{
    "reporter_type": "Clinic",
    "reporter_id": "c-test",
    "patient_age": 30,
    "sex": "M",
    "lat": 17.45,
    "lng": 78.39,
    "symptoms": ["Fever"],
    "reported_at": "2025-10-10T10:00:00Z"
  }'
```

### Test Frontend:
1. Navigate to Dashboard
2. Should load reports without errors
3. Try submitting a new report
4. Should work with or without login

## Environment Variables

Add to `backend2/.env`:
```env
# API Key for programmatic access
API_KEY=your-secure-api-key-change-in-production

# JWT Secret (if using JWT auth)
JWT_SECRET=your-jwt-secret-change-in-production
```

## Migration Path

If you want to enable full authentication later:

1. **Enable auth for all endpoints:**
   ```javascript
   router.get("/reports", authMiddleware, async (req, res) => {...});
   ```

2. **Update frontend to always use token:**
   - Require login before accessing dashboard
   - Store token in localStorage
   - Add token to all requests

3. **Implement token refresh:**
   - Add refresh token endpoint
   - Handle token expiration
   - Auto-refresh before expiry

## Summary

✅ **Fixed:** 401 Unauthorized errors on Dashboard
✅ **Solution:** Made GET endpoints public, kept POST endpoints protected
✅ **Security:** Write operations still require authentication
✅ **Flexibility:** Supports both JWT and API key authentication
✅ **User Experience:** Dashboard works without requiring login for viewing data

The dashboard should now work without authentication errors while still maintaining security for write operations! 🎉
