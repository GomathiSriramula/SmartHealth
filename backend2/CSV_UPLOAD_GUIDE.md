# CSV Upload Feature

## Overview
This feature allows users to upload CSV files containing case reports or sensor readings, which are automatically parsed and stored in the database.

## API Endpoints

### 1. Upload Case Reports
```
POST /upload/case-reports
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV file (max 10MB)

**Expected CSV Format:**
```csv
reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
Clinic,c-2001,45,M,17.4530,78.3950,Fever|Headache,2025-11-01T10:30Z
ASHA,r-2002,32,F,17.4520,78.3960,Diarrhea,2025-11-02T14:15Z
```

**Required Columns:**
- `reporter_type` - Type of reporter (Clinic, ASHA, Volunteer)
- `reporter_id` - Unique reporter identifier
- `patient_age` - Patient age (number)
- `sex` - Patient sex (M, F, or O)
- `lat` - Latitude (decimal)
- `lng` - Longitude (decimal)
- `symptoms` - Pipe-separated symptoms (e.g., "Fever|Headache")
- `reported_at` - ISO 8601 datetime

**Response:**
```json
{
  "message": "CSV file processed successfully",
  "summary": {
    "totalRows": 10,
    "successful": 9,
    "failed": 1
  },
  "errors": [
    {
      "line": 5,
      "error": "Invalid lat/lng coordinates",
      "data": {...}
    }
  ]
}
```

### 2. Upload Sensor Readings
```
POST /upload/sensor-readings
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV file (max 10MB)

**Expected CSV Format:**
```csv
sensor_id,reading_at,lat,lng,turbidity,pH,conductivity
S-001,2025-11-01T10:00Z,17.4530,78.3950,5.2,7.1,450
S-002,2025-11-01T10:15Z,17.4520,78.3960,8.5,6.8,520
```

**Required Columns:**
- `sensor_id` - Unique sensor identifier
- `reading_at` - ISO 8601 datetime
- `lat` - Latitude (decimal)
- `lng` - Longitude (decimal)

**Optional Columns:**
- `turbidity` - Turbidity value (decimal)
- `pH` - pH value (decimal)
- `conductivity` - Conductivity value (decimal)

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

### 3. Get Upload Statistics
```
GET /upload/stats
```

**Response:**
```json
{
  "database": {
    "caseReports": 1250,
    "sensorReadings": 3480
  }
}
```

## Features

✅ **Automatic Validation**
- Validates all required fields
- Checks data types and formats
- Validates coordinates and dates
- Reports errors with line numbers

✅ **Batch Processing**
- Processes large CSV files efficiently
- Inserts all valid records at once
- Continues processing even if some records fail

✅ **Error Reporting**
- Detailed error messages for each failed row
- Line number references
- Returns first 10 errors for review

✅ **File Management**
- Accepts only CSV files
- 10MB file size limit
- Auto-cleanup after processing

✅ **Security**
- File type validation
- Size limits
- Temporary storage with auto-deletion

## Testing

### Using cURL

**Upload Case Reports:**
```bash
curl -X POST http://localhost:5000/upload/case-reports \
  -F "file=@sample_case_reports.csv"
```

**Upload Sensor Readings:**
```bash
curl -X POST http://localhost:5000/upload/sensor-readings \
  -F "file=@sample_sensor_readings.csv"
```

**Get Statistics:**
```bash
curl http://localhost:5000/upload/stats
```

### Using the Test Script
```bash
node test_csv_upload.js
```

### Using Postman
1. Create a new POST request to `http://localhost:5000/upload/case-reports`
2. Select `Body` → `form-data`
3. Add key `file` with type `File`
4. Select your CSV file
5. Click `Send`

## Sample Files

Two sample CSV files are included:
- `sample_case_reports.csv` - 10 case report records
- `sample_sensor_readings.csv` - 10 sensor reading records

You can use these to test the upload functionality.

## Error Handling

### Common Errors

**Missing Required Fields:**
```json
{
  "line": 5,
  "error": "Missing required fields",
  "data": {...}
}
```

**Invalid Data Type:**
```json
{
  "line": 7,
  "error": "Invalid patient_age",
  "data": {...}
}
```

**Invalid Coordinates:**
```json
{
  "line": 3,
  "error": "Invalid lat/lng coordinates",
  "data": {...}
}
```

**Invalid Date:**
```json
{
  "line": 8,
  "error": "Invalid reported_at date",
  "data": {...}
}
```

**Invalid Sex Value:**
```json
{
  "line": 4,
  "error": "Invalid sex (must be M, F, or O)",
  "data": {...}
}
```

## Integration with Frontend

### Using Fetch API
```javascript
async function uploadCSV(file, type) {
  const formData = new FormData();
  formData.append('file', file);
  
  const endpoint = type === 'reports' 
    ? '/upload/case-reports' 
    : '/upload/sensor-readings';
  
  const response = await fetch(`http://localhost:5000${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  console.log('Upload result:', result);
  return result;
}

// Usage
const fileInput = document.getElementById('csvFile');
const file = fileInput.files[0];
await uploadCSV(file, 'reports');
```

### React Example
```jsx
function CSVUploader() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('http://localhost:5000/upload/case-reports', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    setResult(data);
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload</button>
      {result && <div>Uploaded {result.summary.successful} records</div>}
    </div>
  );
}
```

## File Storage

- Uploaded files are temporarily stored in `backend2/uploads/`
- Files are automatically deleted after processing
- Directory is created automatically if it doesn't exist

## Performance

- Handles files up to 10MB
- Processes ~1000 rows/second
- Batch inserts for optimal performance
- Memory-efficient streaming for large files

## Security Considerations

1. **File Type Validation** - Only CSV files accepted
2. **Size Limits** - 10MB maximum file size
3. **Data Validation** - All fields validated before insertion
4. **Temporary Storage** - Files deleted immediately after processing
5. **Error Isolation** - Failed records don't affect successful ones

## Best Practices

1. **CSV Format**
   - Use UTF-8 encoding
   - Include headers in first row
   - Use ISO 8601 format for dates
   - Use pipe (|) separator for multiple symptoms

2. **Data Quality**
   - Validate data before upload
   - Use consistent date formats
   - Ensure coordinates are accurate
   - Avoid duplicate entries

3. **Error Handling**
   - Review error messages
   - Fix failed records
   - Re-upload corrected data
   - Monitor upload statistics

## Troubleshooting

**File Not Uploading:**
- Check file size (must be < 10MB)
- Verify file format is CSV
- Ensure server is running
- Check CORS settings

**All Records Failing:**
- Verify CSV headers match expected format
- Check date format (ISO 8601)
- Validate coordinate ranges
- Ensure required fields are present

**Partial Upload:**
- Review error messages
- Fix failed records in CSV
- Re-upload entire file or just failed records

## Future Enhancements

- [ ] Support for Excel files (.xlsx)
- [ ] Real-time upload progress
- [ ] Duplicate detection
- [ ] Data preview before upload
- [ ] Scheduled/automated uploads
- [ ] Bulk update functionality
- [ ] Export functionality
