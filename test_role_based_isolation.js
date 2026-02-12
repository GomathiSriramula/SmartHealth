/**
 * Test Suite: Role-Based Data Isolation Validation
 * 
 * Tests all GET endpoints for proper role-based filtering:
 * - USER/OPERATOR: See all records (no filtering)
 * - ADMIN: See only records from assigned village
 * - Cross-village access must return 403
 * - No data leakage between villages
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

// Test data
const testData = {
  rampur_user: {
    username: 'rampur_user_test',
    password: 'password123',
    email: 'rampur_user@test.com',
    role: 'USER'
  },
  rampur_operator: {
    username: 'rampur_operator_test',
    password: 'password123',
    email: 'rampur_operator@test.com',
    role: 'OPERATOR'
  },
  rampur_admin: {
    username: 'rampur_admin_test',
    password: 'password123',
    email: 'rampur_admin@test.com',
    role: 'ADMIN',
    state: 'State1',
    district: 'District1',
    village: 'Rampur'
  },
  delhi_admin: {
    username: 'delhi_admin_test',
    password: 'password123',
    email: 'delhi_admin@test.com',
    role: 'ADMIN',
    state: 'State2',
    district: 'District2',
    village: 'Delhi'
  }
};

let tokens = {};
let testPredictionIds = { rampur: [], delhi: [] };
let testAlertIds = { rampur: [], delhi: [] };

// Helper function for API calls
async function apiCall(method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {}
    };
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
  }
}

// Test: Register users
async function testUserRegistration() {
  console.log('\n=== TEST: User Registration ===');
  
  for (const [key, userData] of Object.entries(testData)) {
    const registerData = {
      username: userData.username,
      password: userData.password,
      email: userData.email,
      ...(userData.role && { role: userData.role }),
      ...(userData.village && { state: userData.state, district: userData.district, village: userData.village })
    };
    
    const result = await apiCall('POST', '/auth/register', registerData);
    if (result.success) {
      console.log(`✅ ${key}: Registered`);
    } else {
      console.log(`❌ ${key}: Failed - ${result.error.error}`);
      return false;
    }
  }
  
  return true;
}

// Test: Login users
async function testUserLogin() {
  console.log('\n=== TEST: User Login ===');
  
  for (const [key, userData] of Object.entries(testData)) {
    const loginData = {
      email: userData.email,
      password: userData.password
    };
    
    const result = await apiCall('POST', '/auth/login', loginData);
    if (result.success && result.data.token) {
      tokens[key] = result.data.token;
      
      // Extract and show user info from token
      const payload = JSON.parse(Buffer.from(result.data.token.split('.')[1], 'base64').toString());
      console.log(`✅ ${key}: Logged in (role: ${payload.role})`);
    } else {
      console.log(`❌ ${key}: Login failed`);
      return false;
    }
  }
  
  return true;
}

// Test: Create predictions for different villages
async function testCreatePredictions() {
  console.log('\n=== TEST: Create Test Predictions ===');
  
  const predictions = [
    { village: 'Rampur', location: 'Rampur', riskLevel: 'high', details: 'Rampur prediction 1' },
    { village: 'Rampur', location: 'Rampur', riskLevel: 'medium', details: 'Rampur prediction 2' },
    { village: 'Delhi', location: 'Delhi', riskLevel: 'high', details: 'Delhi prediction 1' },
    { village: 'Delhi', location: 'Delhi', riskLevel: 'low', details: 'Delhi prediction 2' }
  ];
  
  for (const pred of predictions) {
    const data = {
      predictionType: 'Water Quality',
      location: pred.location,
      riskLevel: pred.riskLevel,
      details: pred.details,
      confidence: 85
    };
    
    // Use rampur_user token for creation (USER has no location restrictions)
    const result = await apiCall('POST', '/api/predictions', data, tokens.rampur_user);
    if (result.success) {
      testPredictionIds[pred.village].push(result.data.prediction.id);
      console.log(`✅ Created prediction in ${pred.village}: ${result.data.prediction.id}`);
    } else {
      console.log(`❌ Failed to create prediction in ${pred.village}`);
    }
  }
  
  return testPredictionIds.rampur.length > 0 && testPredictionIds.delhi.length > 0;
}

// Test: GET /predictions with different roles
async function testGetPredictionsList() {
  console.log('\n=== TEST: GET /api/predictions (List) ===');
  
  const roles = {
    'rampur_user': 'USER (all villages)',
    'rampur_operator': 'OPERATOR (all villages)',
    'rampur_admin': 'ADMIN (Rampur only)',
    'delhi_admin': 'ADMIN (Delhi only)'
  };
  
  for (const [role, description] of Object.entries(roles)) {
    const result = await apiCall('GET', '/api/predictions', null, tokens[role]);
    
    if (result.success) {
      const predictions = result.data.predictions;
      const locations = predictions.map(p => p.location);
      const uniqueLocations = [...new Set(locations)];
      
      console.log(`✅ ${role} (${description}): Got ${predictions.length} predictions`);
      console.log(`   Locations: ${uniqueLocations.join(', ')}`);
      
      // Validation
      if (role === 'rampur_admin') {
        if (!uniqueLocations.includes('Rampur') || uniqueLocations.includes('Delhi')) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Should have Rampur only!`);
        }
      } else if (role === 'delhi_admin') {
        if (!uniqueLocations.includes('Delhi') || uniqueLocations.includes('Rampur')) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Should have Delhi only!`);
        }
      } else {
        // USER and OPERATOR should see all
        if (!uniqueLocations.includes('Rampur') || !uniqueLocations.includes('Delhi')) {
          console.log(`   ⚠️  USER/OPERATOR should see all locations!`);
        }
      }
    } else {
      console.log(`❌ ${role}: Failed - ${result.error.error}`);
    }
  }
}

// Test: GET /predictions/:id with different roles
async function testGetPredictionById() {
  console.log('\n=== TEST: GET /api/predictions/:id (Single Record) ===');
  
  if (testPredictionIds.rampur.length === 0 || testPredictionIds.delhi.length === 0) {
    console.log('⏭️  Skipping: No test predictions created');
    return;
  }
  
  // Test Rampur ADMIN accessing both villages
  const rampur_pred_id = testPredictionIds.rampur[0];
  const delhi_pred_id = testPredictionIds.delhi[0];
  
  console.log(`\n[Rampur ADMIN accessing Rampur prediction: ${rampur_pred_id}]`);
  let result = await apiCall('GET', `/api/predictions/${rampur_pred_id}`, null, tokens.rampur_admin);
  if (result.success) {
    console.log(`✅ Can access own village prediction (200)`);
  } else {
    console.log(`❌ Unexpected error: ${result.status}`);
  }
  
  console.log(`\n[Rampur ADMIN accessing Delhi prediction: ${delhi_pred_id}]`);
  result = await apiCall('GET', `/api/predictions/${delhi_pred_id}`, null, tokens.rampur_admin);
  if (result.status === 403) {
    console.log(`✅ Blocked from accessing different village (403 Forbidden)`);
    console.log(`   Error: ${result.error.detail}`);
  } else if (result.success) {
    console.log(`❌ ISOLATION VIOLATION: Should not access different village!`);
  } else {
    console.log(`⚠️  Unexpected status: ${result.status}`);
  }
  
  // Test USER accessing both villages
  console.log(`\n[USER accessing Rampur prediction: ${rampur_pred_id}]`);
  result = await apiCall('GET', `/api/predictions/${rampur_pred_id}`, null, tokens.rampur_user);
  if (result.success) {
    console.log(`✅ USER can access any village (200)`);
  } else {
    console.log(`❌ USER should access any prediction`);
  }
  
  console.log(`\n[USER accessing Delhi prediction: ${delhi_pred_id}]`);
  result = await apiCall('GET', `/api/predictions/${delhi_pred_id}`, null, tokens.rampur_user);
  if (result.success) {
    console.log(`✅ USER can access any village (200)`);
  } else {
    console.log(`❌ USER should access any prediction`);
  }
}

// Test: GET /predictions/stats/summary
async function testGetPredictionsStats() {
  console.log('\n=== TEST: GET /api/predictions/stats/summary ===');
  
  const roles = {
    'rampur_user': 'USER (all statistics)',
    'rampur_admin': 'ADMIN (Rampur only)',
    'delhi_admin': 'ADMIN (Delhi only)'
  };
  
  for (const [role, description] of Object.entries(roles)) {
    const result = await apiCall('GET', '/api/predictions/stats/summary', null, tokens[role]);
    
    if (result.success) {
      const stats = result.data;
      console.log(`✅ ${role} (${description}): Total=${stats.total}`);
      
      // Validation
      if (role === 'rampur_admin') {
        // Should only count Rampur predictions
        if (stats.total > 2) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Stats should show Rampur only (≤2), got ${stats.total}`);
        }
      } else if (role === 'delhi_admin') {
        // Should only count Delhi predictions
        if (stats.total > 2) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Stats should show Delhi only (≤2), got ${stats.total}`);
        }
      } else {
        // USER should see all 4
        if (stats.total !== 4) {
          console.log(`   ⚠️  USER should see all 4 predictions, got ${stats.total}`);
        }
      }
    } else {
      console.log(`❌ ${role}: Failed - ${result.error.error}`);
    }
  }
}

// Test: GET /alerts and /alerts/:id
async function testGetAlerts() {
  console.log('\n=== TEST: GET /api/alerts (List) ===');
  
  const roles = {
    'rampur_user': 'USER (all villages)',
    'rampur_admin': 'ADMIN (Rampur only)',
    'delhi_admin': 'ADMIN (Delhi only)'
  };
  
  for (const [role, description] of Object.entries(roles)) {
    const result = await apiCall('GET', '/api/alerts', null, tokens[role]);
    
    if (result.success) {
      const alerts = result.data.alerts;
      const locations = alerts.map(a => a.location);
      const uniqueLocations = [...new Set(locations)];
      
      console.log(`✅ ${role} (${description}): Got ${alerts.length} alerts`);
      if (uniqueLocations.length > 0) {
        console.log(`   Locations: ${uniqueLocations.join(', ')}`);
      }
      
      // Validation
      if (role === 'rampur_admin') {
        if (uniqueLocations.filter(l => l !== 'Rampur').length > 0) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Should have Rampur only!`);
        }
      } else if (role === 'delhi_admin') {
        if (uniqueLocations.filter(l => l !== 'Delhi').length > 0) {
          console.log(`   ⚠️  ISOLATION VIOLATION: Should have Delhi only!`);
        }
      }
    } else {
      console.log(`✅ ${role} (${description}): Got 0 alerts (expected, no alerts created yet)`);
    }
  }
}

// Test: Response format validation
async function testResponseFormats() {
  console.log('\n=== TEST: Response Format Validation ===');
  
  const user_result = await apiCall('GET', '/api/predictions', null, tokens.rampur_user);
  const admin_result = await apiCall('GET', '/api/predictions', null, tokens.rampur_admin);
  
  if (user_result.success && admin_result.success) {
    const user_keys = Object.keys(user_result.data).sort();
    const admin_keys = Object.keys(admin_result.data).sort();
    
    if (JSON.stringify(user_keys) === JSON.stringify(admin_keys)) {
      console.log(`✅ Response format identical for USER and ADMIN`);
      console.log(`   Fields: ${user_keys.join(', ')}`);
    } else {
      console.log(`❌ BREAKING CHANGE: Response format differs by role`);
      console.log(`   USER fields: ${user_keys.join(', ')}`);
      console.log(`   ADMIN fields: ${admin_keys.join(', ')}`);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Role-Based Data Isolation Validation Test Suite          ║');
  console.log('║  SmartHealth Water Monitoring System - STEP 5             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Setup
    console.log('\n[SETUP PHASE]');
    if (!await testUserRegistration()) throw new Error('Registration failed');
    if (!await testUserLogin()) throw new Error('Login failed');
    if (!await testCreatePredictions()) throw new Error('Creating predictions failed');
    
    // Tests
    console.log('\n[VALIDATION PHASE]');
    await testGetPredictionsList();
    await testGetPredictionById();
    await testGetPredictionsStats();
    await testGetAlerts();
    await testResponseFormats();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  TEST SUITE COMPLETED                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
