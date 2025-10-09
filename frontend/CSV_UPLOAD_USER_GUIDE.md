# CSV Upload Feature - Frontend Guide

## Overview
The CSV Upload feature has been added to the Dashboard, allowing users to easily upload CSV files containing case reports or sensor readings directly through the web interface.

## Accessing the Feature

1. **Login to Dashboard**
   - Navigate to the application
   - Click "Get Started" or login if required

2. **Open CSV Upload Tab**
   - Look for the sidebar on the left
   - Click on "CSV Upload" tab (📤 icon)

## Features

### 📊 **Database Statistics**
- Real-time display of:
  - Total Case Reports in database
  - Total Sensor Readings in database
- Updates automatically after successful upload

### 📤 **File Upload Options**

**Upload Types:**
- **Case Reports** - Patient health reports from clinics, ASHA workers, and volunteers
- **Sensor Readings** - Water quality sensor data (turbidity, pH, conductivity)

**File Requirements:**
- ✅ Format: CSV only (.csv extension)
- ✅ Size: Maximum 10MB
- ✅ Structure: Must include proper headers
- ✅ Encoding: UTF-8 recommended

### 📥 **Sample Files**
- Click "Download Sample" button to get example CSV files
- Sample files show the exact format required
- Available for both Case Reports and Sensor Readings

### 📈 **Upload Results**
After successful upload, you'll see:
- **Summary Statistics:**
  - Total rows processed
  - Successful records inserted
  - Failed records (with reasons)
  
- **Error Details (if any):**
  - Line number where error occurred
  - Error description
  - Data that caused the error

## How to Use

### Step 1: Prepare Your CSV File

**For Case Reports:**
```csv
reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
Clinic,c-2001,45,M,17.4530,78.3950,Fever|Headache,2025-11-01T10:30Z
ASHA,r-2002,32,F,17.4520,78.3960,Diarrhea,2025-11-02T14:15Z
```

**Required Columns:**
- `reporter_type` - Clinic, ASHA, or Volunteer
- `reporter_id` - Unique identifier (e.g., c-001, r-002, v-003)
- `patient_age` - Number (0-120)
- `sex` - M, F, or O
- `lat` - Latitude (decimal degrees)
- `lng` - Longitude (decimal degrees)
- `symptoms` - Pipe-separated list (e.g., "Fever|Headache|Nausea")
- `reported_at` - ISO 8601 datetime (e.g., 2025-11-01T10:30Z)

**For Sensor Readings:**
```csv
sensor_id,reading_at,lat,lng,turbidity,pH,conductivity
S-001,2025-11-01T10:00Z,17.4530,78.3950,5.2,7.1,450
S-002,2025-11-01T10:15Z,17.4520,78.3960,8.5,6.8,520
```

**Required Columns:**
- `sensor_id` - Unique sensor identifier
- `reading_at` - ISO 8601 datetime
- `lat` - Latitude
- `lng` - Longitude

**Optional Columns:**
- `turbidity` - Water turbidity value
- `pH` - Water pH level
- `conductivity` - Water conductivity

### Step 2: Select Upload Type
1. Choose between "Case Reports" or "Sensor Readings"
2. Radio buttons at the top of the form

### Step 3: Select File
1. Click "Choose File" or drag & drop
2. Selected file name and size will appear
3. File must be .csv format and under 10MB

### Step 4: Upload
1. Click "📤 Upload CSV File" button
2. Progress indicator will show during upload
3. Wait for results to appear

### Step 5: Review Results
- Check the summary statistics
- Review any errors if present
- Database statistics will update automatically
- Upload another file or navigate to other tabs

## Tips for Successful Upload

### ✅ **Best Practices**

1. **Data Quality**
   - Ensure all required fields are present
   - Use consistent date formats (ISO 8601)
   - Validate coordinates before upload
   - Check for typos in categorical fields

2. **File Preparation**
   - Save in UTF-8 encoding
   - Include headers in the first row
   - Remove empty rows
   - Use pipe (|) for multiple symptoms

3. **Testing**
   - Download and test with sample files first
   - Upload small batches initially
   - Verify data appears in Reports/Analytics tabs

4. **Error Handling**
   - Review error messages carefully
   - Fix failed records in your CSV
   - Re-upload corrected file
   - Only failed records need correction

### ❌ **Common Errors & Solutions**

**"Missing required fields"**
- ✅ Ensure all required columns are present
- ✅ Check for empty cells in required fields

**"Invalid date format"**
- ✅ Use ISO 8601 format: `2025-11-01T10:30Z`
- ✅ Include timezone (Z for UTC)

**"Invalid coordinates"**
- ✅ Latitude: -90 to 90
- ✅ Longitude: -180 to 180
- ✅ Use decimal degrees (not DMS)

**"Invalid sex value"**
- ✅ Use only: M, F, or O
- ✅ Case-insensitive (m, f, o also work)

**"File too large"**
- ✅ Split into smaller files (under 10MB each)
- ✅ Remove unnecessary columns
- ✅ Upload in batches

## Integration with Other Features

### 📊 **View Uploaded Data**
After upload, navigate to:
- **Reports Tab** - View uploaded case reports
- **Analytics Tab** - See statistics and trends
- **Overview Tab** - Updated dashboard metrics

### 🔄 **Data Sync**
- Data is immediately available after upload
- No refresh needed - statistics update automatically
- All charts and graphs reflect new data

### 📧 **Email Notifications**
- If ML predictions are enabled, new data may trigger predictions
- Users will receive email notifications for predictions
- See "Mailing Feature" documentation for details

## Technical Details

### API Endpoints Used
```
POST /upload/case-reports
POST /upload/sensor-readings
GET /upload/stats
```

### Frontend Components
- `CSVUpload.tsx` - Main upload component
- `Alert.tsx` - Success/error messages
- `Dashboard.tsx` - Tab integration

### State Management
- Real-time file validation
- Progress tracking during upload
- Automatic statistics refresh
- Error boundary handling

## Security & Privacy

- Files are processed server-side
- Temporary storage only during processing
- Automatic cleanup after upload
- No client-side data storage
- HTTPS recommended for production

## Troubleshooting

**Upload button disabled?**
- Select a file first
- Check file format (.csv only)
- Ensure file size is under 10MB

**Results not showing?**
- Check browser console for errors
- Verify backend server is running
- Check network connection
- Try refreshing the page

**Errors not making sense?**
- Download sample file for reference
- Compare your file format
- Check for hidden characters
- Verify encoding (use UTF-8)

**Statistics not updating?**
- Wait a few seconds
- Refresh the page manually
- Check if upload was successful
- Verify backend connectivity

## Future Enhancements

Planned improvements:
- [ ] Drag-and-drop file upload
- [ ] Real-time progress bar
- [ ] Data preview before upload
- [ ] Duplicate detection
- [ ] Bulk editing interface
- [ ] Export functionality
- [ ] Upload history
- [ ] Scheduled uploads

## Support

For issues or questions:
1. Check error messages carefully
2. Review this documentation
3. Try sample files first
4. Check backend logs
5. Contact system administrator

---

**Quick Reference:**
- Maximum file size: **10MB**
- Supported format: **CSV only**
- Date format: **ISO 8601** (2025-11-01T10:30Z)
- Symptoms separator: **Pipe (|)**
- Sex values: **M, F, O**

Happy uploading! 📤
