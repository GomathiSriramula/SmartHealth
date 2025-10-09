# Smart Health Reporting System

A visually rich web dashboard for health reporting with a modern water-inspired design theme.

## Features

- **Dashboard**: View all health reports in a sortable table with pagination
- **Add Reports**: Submit new patient health reports through an intuitive form
- **Modern Design**: Deep blue and water-inspired gradient theme with smooth animations
- **Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- **API Integration**: Connect to your backend API for data management

## Files Included

- `index.html` - Main HTML structure with dashboard and form pages
- `styles.css` - Complete styling with water-themed gradients and animations
- `app.js` - JavaScript for API integration, sorting, pagination, and form handling
- `README.md` - This file with setup instructions

## Quick Start

### 1. Extract Files

Unzip the archive to your desired location:

```bash
unzip smart-health-dashboard.zip
cd smart-health-dashboard
```

### 2. Configure API Settings

Open `app.js` and update the following constants at the top of the file:

```javascript
const API_BASE_URL = 'YOUR_API_BASE_URL_HERE';  // e.g., 'https://api.example.com'
const API_KEY = 'YOUR_API_KEY_HERE';            // Your API key
```

### 3. Run Locally

You can run the application using any of these methods:

**Option A: Using Python (Python 3)**
```bash
python -m http.server 8000
```

**Option B: Using Node.js (http-server)**
```bash
npx http-server -p 8000
```

**Option C: Using PHP**
```bash
php -S localhost:8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### 4. Deploy to Production

To deploy to a web server, simply upload all files to your hosting provider:

- Upload `index.html`, `styles.css`, and `app.js` to your web server
- Ensure your API endpoints are accessible from the deployed location
- Update CORS settings on your API server if necessary

## API Requirements

The dashboard expects the following API endpoints:

### GET /reports
Fetches all health reports.

**Headers:**
- `x-api-key`: Your API key
- `Content-Type`: application/json

**Response:**
```json
{
  "reports": [
    {
      "id": 1,
      "patient_age": 45,
      "sex": "Female",
      "lat": 28.6139,
      "lng": 77.2090,
      "symptoms": ["Fever", "Cough"],
      "reporter_type": "ASHA",
      "reporter_id": "ASHA123",
      "reported_at": "2025-10-09T10:30:00",
      "created_at": "2025-10-09T10:35:00"
    }
  ]
}
```

### POST /report
Submits a new health report.

**Headers:**
- `x-api-key`: Your API key
- `Content-Type`: application/json

**Body:**
```json
{
  "reporter_type": "ASHA",
  "reporter_id": "ASHA123",
  "patient_age": 45,
  "sex": "Female",
  "lat": 28.6139,
  "lng": 77.2090,
  "symptoms": ["Fever", "Cough"],
  "reported_at": "2025-10-09T10:30:00"
}
```

## Features Overview

### Dashboard Page

- **Sortable Columns**: Click any column header to sort by that field
- **Pagination**: Navigate through reports 10 at a time
- **Refresh Button**: Reload the latest data from the server
- **Hover Effects**: Interactive row highlighting for better UX
- **Responsive Table**: Horizontal scrolling on mobile devices

### Add Report Page

- **Input Validation**: All fields are validated before submission
- **Multi-Select Symptoms**: Choose multiple symptoms from checkboxes
- **Real-time Feedback**: Success/error messages after form submission
- **Auto-populated Date**: Current date/time is pre-filled
- **Responsive Form**: Adapts to different screen sizes

## Design Highlights

- Deep blue and water-inspired color palette
- Gradient backgrounds with subtle watermark effects
- Smooth animations and transitions
- Floating icons and hover effects
- Soft shadows and rounded corners
- Glass-morphism effects with backdrop blur
- Ripple animation on button clicks

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

**Issue: Reports not loading**
- Check that `API_BASE_URL` is correct in `app.js`
- Verify your API key is valid
- Check browser console for error messages
- Ensure CORS is enabled on your API server

**Issue: Form submission fails**
- Verify all required fields are filled
- Check that the POST endpoint is correct
- Ensure symptoms are selected
- Review API key configuration

**Issue: Styling looks broken**
- Make sure `styles.css` is in the same directory as `index.html`
- Check browser console for 404 errors
- Clear browser cache and reload

## Customization

### Changing Colors

Edit the CSS variables in `styles.css`:

```css
:root {
    --deep-blue: #0a2463;
    --ocean-blue: #1e5f8c;
    --water-blue: #2e8bc0;
    --light-blue: #47b5ff;
    --sky-blue: #84d2f6;
}
```

### Adding More Symptoms

Update the symptoms checkboxes in `index.html`:

```html
<label class="checkbox-label">
    <input type="checkbox" name="symptoms" value="New_Symptom">
    <span>New Symptom</span>
</label>
```

### Adjusting Pagination

Change the number of reports per page in `app.js`:

```javascript
const reportsPerPage = 20; // Default is 10
```

## License

This project is provided as-is for health reporting purposes.

## Support

For issues or questions, please contact your system administrator or development team.
