# Report Count Limit Increase - 10,000 Reports

## Change Summary
Increased the maximum report count limit from **1,000** to **10,000** reports per user.

## What Was Changed

### 1. Backend - Increased API Limit ✅
**File**: `backend2/routes/reports.js`

**Before:**
```javascript
const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 1000); // Max 1,000
```

**After:**
```javascript
const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 10000); // Max 10,000 🔑
```

### 2. Frontend - Request Higher Limit ✅
**File**: `frontend/src/components/Dashboard.tsx`

**Before:**
```typescript
const url = `${API_URL}/reports?reporter_id=${encodeURIComponent(username)}`;
// Default limit: 100
```

**After:**
```typescript
const url = `${API_URL}/reports?reporter_id=${encodeURIComponent(username)}&limit=10000`;
// Explicit limit: 10,000 🔑
```

## Impact

### User Experience
- ✅ Users can now have up to **10,000 reports** in their dashboard
- ✅ Total Reports count can display up to **10,000**
- ✅ All reports visible in Overview and Reports tabs
- ✅ No pagination needed for most use cases

### Performance Considerations

#### For 10,000 Reports:
- **Database Query**: MongoDB can handle this efficiently with proper indexing
- **Network Transfer**: ~10-20MB of data (depends on report size)
- **Browser Rendering**: Modern browsers can handle this, but may have slight delay
- **Memory Usage**: ~20-40MB in browser memory

#### Recommendations for Large Datasets:
If users regularly exceed 5,000+ reports, consider:
1. **Pagination**: Implement "Load More" or page-based navigation
2. **Virtual Scrolling**: Only render visible reports in the list
3. **Date Filtering**: Add filters to show recent reports (last 30/90 days)
4. **Search/Filter**: Allow users to filter by symptoms, date range, etc.

## API Behavior

### GET /reports Endpoint

**Query Parameters:**
- `reporter_id` (string): Filter by username
- `limit` (number): Max reports to return (default: 100, max: 10,000)
- `skip` (number): Number of reports to skip (for pagination)

**Examples:**

```bash
# Get first 100 reports for user (default)
GET /reports?reporter_id=alice

# Get up to 10,000 reports for user
GET /reports?reporter_id=alice&limit=10000

# Pagination: Get reports 1000-1100
GET /reports?reporter_id=alice&skip=1000&limit=100
```

## Testing

### Test 1: Upload Large CSV
1. Create a CSV with 5,000 reports
2. Upload via CSV Upload tab
3. Verify all 5,000 appear in dashboard
4. Check Total Reports shows: **5,000**

### Test 2: Multiple Uploads
1. Upload CSV with 2,000 reports
2. Upload another CSV with 3,000 reports
3. Manual submit 100 reports
4. Total should show: **5,100**

### Test 3: Performance Check
1. Upload 10,000 reports
2. Measure dashboard load time
3. Should load within 3-5 seconds
4. Check browser memory usage

## Limits

### Current Limits:
| Type | Previous | New |
|------|----------|-----|
| API Max Limit | 1,000 | **10,000** |
| Frontend Request | 100 (default) | **10,000** |
| CSV Upload | No limit | No limit |
| Per Report Size | ~1-2KB | ~1-2KB |

### Database Limits:
- **MongoDB**: No practical limit (millions of documents)
- **Disk Space**: ~1GB per 500,000 reports (approximate)

## Future Enhancements

If users need more than 10,000 reports:

### Option 1: Increase Limit Further
```javascript
// Backend
const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 50000); // 50K

// Frontend
const url = `${API_URL}/reports?reporter_id=${username}&limit=50000`;
```

### Option 2: Implement Pagination
```typescript
const [page, setPage] = useState(1);
const pageSize = 100;

const fetchReports = async (page: number) => {
  const skip = (page - 1) * pageSize;
  const url = `${API_URL}/reports?reporter_id=${username}&limit=${pageSize}&skip=${skip}`;
  // ...
};
```

### Option 3: Virtual Scrolling
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={reports.length}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ReportItem report={reports[index]} />
    </div>
  )}
</FixedSizeList>
```

### Option 4: Add Date Range Filter
```typescript
const [dateRange, setDateRange] = useState({ start: null, end: null });

const url = `${API_URL}/reports?reporter_id=${username}&limit=10000&start_date=${start}&end_date=${end}`;
```

## Monitoring

To monitor performance with large datasets:

### Backend Logging:
```javascript
router.get("/reports", async (req, res) => {
  const startTime = Date.now();
  // ... fetch reports ...
  const duration = Date.now() - startTime;
  console.log(`📊 Fetched ${docs.length} reports in ${duration}ms`);
  // ...
});
```

### Frontend Logging:
```typescript
const fetchReports = async () => {
  const startTime = performance.now();
  // ... fetch data ...
  const duration = performance.now() - startTime;
  console.log(`📊 Loaded ${data.length} reports in ${duration.toFixed(2)}ms`);
};
```

## Troubleshooting

### Issue: Dashboard slow with many reports

**Solutions:**
1. Check network speed: Large dataset download
2. Add pagination or virtual scrolling
3. Implement "Load More" button instead of loading all
4. Add date filters to reduce dataset

### Issue: Browser memory high

**Solutions:**
1. Reduce limit back to 5,000
2. Implement pagination
3. Use virtual scrolling for long lists
4. Clear old data when fetching new

### Issue: Timeout errors

**Solutions:**
1. Increase backend timeout settings
2. Add database indexing on `reporter_id`
3. Implement streaming responses
4. Use pagination

## Database Indexing

For optimal performance with large datasets, ensure indexes exist:

```javascript
// In MongoDB
db.case_reports.createIndex({ reporter_id: 1, created_at: -1 });
db.case_reports.createIndex({ reported_at: -1 });
```

This speeds up queries significantly:
- Filter by `reporter_id`: O(1) lookup
- Sort by `created_at`: Indexed sort
- Combined: Fast filtered + sorted queries

## Summary

✅ **Maximum report count increased to 10,000**
✅ **Backend supports up to 10,000 reports per request**
✅ **Frontend explicitly requests 10,000 reports**
✅ **No breaking changes - backward compatible**
✅ **Performance: Acceptable for most use cases**

### Before ❌
```
Max reports per user: 1,000
Total Reports count: Capped at 1,000
Large CSV uploads: Only first 1,000 visible
```

### After ✅
```
Max reports per user: 10,000
Total Reports count: Can show up to 10,000
Large CSV uploads: All reports visible (up to 10K)
```

---

**The dashboard can now handle up to 10,000 reports per user!** 🎉

Users can:
- ✅ Upload large CSV files (thousands of reports)
- ✅ Manually submit thousands of reports
- ✅ See accurate Total Reports count up to 10,000
- ✅ View all reports in Overview and Reports tabs
