/**
 * Test script to verify alert creation works after fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { CaseReport, Prediction } = require('./models');
const Alert = require('./models/Alert');
const { checkForAlerts } = require('./services/alertChecker');

async function testAlertFix() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';
    console.log(`🔌 Connecting to MongoDB...\n`);
    
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected\n`);

    // Test location
    const testLocation = "Test-Alert-Location-" + Date.now();
    console.log(`🧪 Testing alert creation for location: "${testLocation}"\n`);

    // Create first HIGH prediction
    console.log(`1️⃣  Creating first HIGH prediction...`);
    const pred1 = await Prediction.create({
      predictionType: "Test Prediction",
      location: testLocation,
      riskLevel: "high",  // lowercase, like case reports use
      details: "Test predictionfor alert trigger",
      confidence: 85,
      modelVersion: "test-v1",
      lat: 12.34,
      lng: 56.78,
      predictedDate: new Date(),
    });
    console.log(`   ✅ Pred 1: ${pred1._id}`);
    console.log(`   RiskLevel: ${pred1.riskLevel}\n`);

    // Check for alerts (should NOT trigger - only 1 prediction)
    console.log(`2️⃣  Checking alerts on first prediction...`);
    let alertResult = await checkForAlerts(pred1);
    console.log(`   Result: ${alertResult.action} - ${alertResult.message}`);
    console.log(`   Alert created? ${alertResult.action === 'created' ? 'YES ❌' : 'NO (expected)'}\n`);

    // Create second HIGH prediction at same location
    console.log(`3️⃣  Creating second HIGH prediction at same location...`);
    const pred2 = await Prediction.create({
      predictionType: "Test Prediction",
      location: testLocation,
      riskLevel: "high",
      details: "Test prediction for alert trigger #2",
      confidence: 90,
      modelVersion: "test-v1",
      lat: 12.35,
      lng: 56.79,
      predictedDate: new Date(),
    });
    console.log(`   ✅ Pred 2: ${pred2._id}`);
    console.log(`   RiskLevel: ${pred2.riskLevel}\n`);

    // Check for alerts (SHOULD trigger - 2 predictions)
    console.log(`4️⃣  Checking alerts on second prediction...`);
    alertResult = await checkForAlerts(pred2);
    console.log(`   Result: ${alertResult.action} - ${alertResult.message}`);
    console.log(`   Alert created? ${alertResult.action === 'created' ? 'YES ✅' : 'NO ❌'}\n`);

    // Verify alert in database
    console.log(`5️⃣  Verifying alert in database...`);
    const alerts = await Alert.find({ location: testLocation });
    console.log(`   Alerts at this location: ${alerts.length}`);
    if (alerts.length > 0) {
      const alert = alerts[0];
      console.log(`   ✅ Alert ID: ${alert._id}`);
      console.log(`   Status: ${alert.status}`);
      console.log(`   Triggering predictions: ${alert.triggeringPredictions.length}`);
    } else {
      console.log(`   ❌ NO ALERTS FOUND!`);
    }
    console.log('');

    // Summary
    console.log(`📊 Test Summary:`);
    console.log(`   Predictions created: 2`);
    console.log(`   Alert threshold: 2`);
    console.log(`   Alert created: ${alerts.length > 0 ? 'YES ✅' : 'NO ❌ - Fix not working!'}`);

    console.log('\n✅ Test complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAlertFix();
