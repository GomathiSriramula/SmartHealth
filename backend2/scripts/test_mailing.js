/**
 * Test Script for Mailing Feature
 * Run: node test_mailing.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testMailingFeature() {
  console.log('🧪 Testing SmartHealth Mailing Feature\n');
  console.log('=' .repeat(50));

  try {
    // Step 1: Register test users
    console.log('\n📝 Step 1: Registering test users...');
    
    const users = [
      { username: 'testuser1', password: 'pass123', email: 'testuser1@example.com' },
      { username: 'testuser2', password: 'pass123', email: 'testuser2@example.com' },
      { username: 'testuser3', password: 'pass123', email: 'testuser3@example.com' }
    ];

    for (const user of users) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/register`, user);
        console.log(`   ✅ Registered: ${user.username} (${user.email})`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`   ⚠️  User already exists: ${user.username}`);
        } else {
          console.log(`   ❌ Failed to register ${user.username}: ${error.message}`);
        }
      }
    }

    // Step 2: Create a prediction (will trigger emails)
    console.log('\n🔮 Step 2: Creating prediction and sending emails...');
    
    const prediction = {
      predictionType: 'Water Quality Alert',
      location: 'Downtown Area',
      riskLevel: 'high',
      details: 'Elevated turbidity and low pH detected in water supply. Potential contamination risk.',
      recommendations: [
        'Boil water for at least 1 minute before drinking',
        'Use bottled water for cooking and drinking',
        'Avoid giving tap water to infants',
        'Report any illness to local health authorities'
      ],
      lat: 40.7128,
      lng: -74.0060,
      modelVersion: 'v1.0-test',
      confidence: 87
    };

    const predictionResponse = await axios.post(`${BASE_URL}/predictions`, prediction);
    console.log('   ✅ Prediction created successfully!');
    console.log(`   📧 Emails sent to ${predictionResponse.data.notification.count} users`);
    console.log(`   🆔 Prediction ID: ${predictionResponse.data.prediction.id}`);
    
    if (predictionResponse.data.notification.success) {
      console.log('\n   💡 Check your console for email preview URL (Ethereal)');
    }

    const predictionId = predictionResponse.data.prediction.id;

    // Step 3: Get all predictions
    console.log('\n📊 Step 3: Fetching all predictions...');
    const allPredictions = await axios.get(`${BASE_URL}/predictions`);
    console.log(`   ✅ Found ${allPredictions.data.predictions.length} predictions`);
    console.log(`   📈 Total in database: ${allPredictions.data.pagination.total}`);

    // Step 4: Get specific prediction
    console.log('\n🔍 Step 4: Fetching specific prediction...');
    const specificPrediction = await axios.get(`${BASE_URL}/predictions/${predictionId}`);
    console.log(`   ✅ Retrieved: ${specificPrediction.data.predictionType}`);
    console.log(`   ⚠️  Risk Level: ${specificPrediction.data.riskLevel.toUpperCase()}`);
    console.log(`   📍 Location: ${specificPrediction.data.location}`);

    // Step 5: Resend notification (optional test)
    console.log('\n🔄 Step 5: Testing resend notification...');
    const resendResponse = await axios.post(`${BASE_URL}/predictions/${predictionId}/notify`);
    console.log(`   ✅ Notification resent to ${resendResponse.data.notification.count} users`);

    console.log('\n' + '='.repeat(50));
    console.log('✨ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run the test
console.log('\n⚠️  Make sure the backend server is running on port 5000');
console.log('   Run: npm start (in backend2 directory)\n');

setTimeout(() => {
  testMailingFeature();
}, 1000);
