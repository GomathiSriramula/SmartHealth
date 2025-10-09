/**
 * Test Script for CSV Upload Feature
 * Run: node test_csv_upload.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function testCSVUpload() {
  console.log('🧪 Testing SmartHealth CSV Upload Feature\n');
  console.log('=' .repeat(50));

  try {
    // Step 1: Check initial stats
    console.log('\n📊 Step 1: Checking initial database stats...');
    const initialStats = await axios.get(`${BASE_URL}/upload/stats`);
    console.log('   Initial Case Reports:', initialStats.data.database.caseReports);
    console.log('   Initial Sensor Readings:', initialStats.data.database.sensorReadings);

    // Step 2: Upload Case Reports CSV
    console.log('\n📤 Step 2: Uploading case reports CSV...');
    const caseReportsForm = new FormData();
    const caseReportsPath = path.join(__dirname, 'sample_case_reports.csv');
    
    if (!fs.existsSync(caseReportsPath)) {
      console.error('   ❌ Sample file not found:', caseReportsPath);
      return;
    }

    caseReportsForm.append('file', fs.createReadStream(caseReportsPath));

    const caseReportsResponse = await axios.post(
      `${BASE_URL}/upload/case-reports`,
      caseReportsForm,
      {
        headers: caseReportsForm.getHeaders(),
      }
    );

    console.log('   ✅', caseReportsResponse.data.message);
    console.log('   📈 Summary:');
    console.log('      Total Rows:', caseReportsResponse.data.summary.totalRows);
    console.log('      Successful:', caseReportsResponse.data.summary.successful);
    console.log('      Failed:', caseReportsResponse.data.summary.failed);
    
    if (caseReportsResponse.data.errors.length > 0) {
      console.log('   ⚠️  Errors:', caseReportsResponse.data.errors);
    }

    // Step 3: Upload Sensor Readings CSV
    console.log('\n📤 Step 3: Uploading sensor readings CSV...');
    const sensorReadingsForm = new FormData();
    const sensorReadingsPath = path.join(__dirname, 'sample_sensor_readings.csv');
    
    if (!fs.existsSync(sensorReadingsPath)) {
      console.error('   ❌ Sample file not found:', sensorReadingsPath);
      return;
    }

    sensorReadingsForm.append('file', fs.createReadStream(sensorReadingsPath));

    const sensorReadingsResponse = await axios.post(
      `${BASE_URL}/upload/sensor-readings`,
      sensorReadingsForm,
      {
        headers: sensorReadingsForm.getHeaders(),
      }
    );

    console.log('   ✅', sensorReadingsResponse.data.message);
    console.log('   📈 Summary:');
    console.log('      Total Rows:', sensorReadingsResponse.data.summary.totalRows);
    console.log('      Successful:', sensorReadingsResponse.data.summary.successful);
    console.log('      Failed:', sensorReadingsResponse.data.summary.failed);
    
    if (sensorReadingsResponse.data.errors.length > 0) {
      console.log('   ⚠️  Errors:', sensorReadingsResponse.data.errors);
    }

    // Step 4: Check updated stats
    console.log('\n📊 Step 4: Checking updated database stats...');
    const finalStats = await axios.get(`${BASE_URL}/upload/stats`);
    console.log('   Final Case Reports:', finalStats.data.database.caseReports);
    console.log('   Final Sensor Readings:', finalStats.data.database.sensorReadings);
    
    console.log('\n   📈 New Records Added:');
    console.log('      Case Reports: +', 
      finalStats.data.database.caseReports - initialStats.data.database.caseReports);
    console.log('      Sensor Readings: +', 
      finalStats.data.database.sensorReadings - initialStats.data.database.sensorReadings);

    // Step 5: Verify data was inserted
    console.log('\n🔍 Step 5: Verifying data insertion...');
    
    // Get recent case reports
    const reportsResponse = await axios.get(`${BASE_URL}/reports?limit=5`);
    console.log('   ✅ Retrieved', reportsResponse.data.length, 'recent case reports');
    if (reportsResponse.data.length > 0) {
      console.log('   📄 Sample:', reportsResponse.data[0].reporter_id);
    }

    // Get recent sensor readings
    const sensorsResponse = await axios.get(`${BASE_URL}/sensors?limit=5`);
    console.log('   ✅ Retrieved', sensorsResponse.data.length, 'recent sensor readings');
    if (sensorsResponse.data.length > 0) {
      console.log('   📄 Sample:', sensorsResponse.data[0].sensor_id);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✨ All CSV upload tests completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run the test
console.log('\n⚠️  Make sure the backend server is running on port 5000');
console.log('   Run: node index.js (in backend2 directory)\n');

setTimeout(() => {
  testCSVUpload();
}, 1000);
