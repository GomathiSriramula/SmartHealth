/**
 * Debug script to trace alert checking logic for location (78, 78)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Prediction } = require('./models');
const Alert = require('./models/Alert');

const ALERT_THRESHOLD = 2;
const DEFAULT_TIME_WINDOW = 48 * 60 * 60 * 1000;
const TIME_WINDOW = process.env.ALERT_TIME_WINDOW_MS || DEFAULT_TIME_WINDOW;

async function debugAlertLogic() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';
    console.log(`🔌 Connecting to MongoDB...\n`);
    
    await mongoose.connect(mongoUri);

    // Get all predictions for location (78, 78)
    const location = "Coordinates: (78, 78)";
    console.log(`🔍 Analyzing alert logic for location: "${location}"\n`);

    const predictions = await Prediction.find({ location }).sort({ predictedDate: -1 });
    console.log(`📊 Found ${predictions.length} predictions at this location:`);
    predictions.forEach((pred, i) => {
      console.log(`  ${i + 1}. ID: ${pred._id}`);
      console.log(`     Risk: ${pred.riskLevel} | Type: ${pred.predictionType}`);
      console.log(`     Date: ${pred.predictedDate || pred.created_at}`);
      console.log(`     Alt Date: ${pred.created_at}`);
    });
    console.log('');

    // Check for active alert
    const activeAlert = await Alert.findOne({
      location: location,
      status: 'active',
    });
    console.log(`🚨 Active alert for this location: ${activeAlert ? 'YES' : 'NO'}`);
    if (activeAlert) {
      console.log(`   Alert ID: ${activeAlert._id}`);
      console.log(`   Created: ${activeAlert.createdAt}`);
      console.log(`   Predictions: ${activeAlert.triggeringPredictions.length}`);
    }
    console.log('');

    // Test alert checker logic
    if (predictions.length >= 2) {
      console.log(`🧪 Testing alert checker logic:\n`);
      
      const currentPrediction = predictions[0]; // Most recent
      const currentTime = new Date(currentPrediction.predictedDate || currentPrediction.created_at);
      const timeWindowStart = new Date(currentTime.getTime() - TIME_WINDOW);

      console.log(`  Current prediction ID: ${currentPrediction._id}`);
      console.log(`  Current time: ${currentTime}`);
      console.log(`  Time window start: ${timeWindowStart}`);
      console.log(`  Window: ${Math.floor((currentTime - timeWindowStart) / 1000 / 60 / 60)} hours\n`);

      // Query for previous HIGH predictions (like the alert checker does)
      const query = {
        location: location,
        riskLevel: { $in: ['HIGH', 'high'] },
        predictedDate: { $gte: timeWindowStart },
        _id: { $ne: currentPrediction._id },
      };

      console.log(`  MongoDB Query:`);
      console.log(`    location: "${location}"`);
      console.log(`    riskLevel: { $in: ['HIGH', 'high'] }`);
      console.log(`    predictedDate: { $gte: ${timeWindowStart} }`);
      console.log(`    _id: { $ne: ${currentPrediction._id} }\n`);

      const previousHighRisks = await Prediction.find(query).sort({ predictedDate: -1 });

      console.log(`📋 Query Result: ${previousHighRisks.length} previous HIGH predictions\n`);
      
      if (previousHighRisks.length > 0) {
        console.log(`✅ Alert threshold WOULD BE MET!`);
        console.log(`   Have: 1 current + ${previousHighRisks.length} previous = ${1 + previousHighRisks.length} total HIGH predictions`);
        previousHighRisks.forEach((pred, i) => {
          console.log(`   Previous ${i + 1}: ID ${pred._id} at ${pred.predictedDate || pred.created_at}`);
        });
      } else {
        console.log(`❌ Alert threshold NOT MET`);
        console.log(`   Have: 1 current + 0 previous = 1 total HIGH predictions`);
        console.log(`   Need: 2 consecutive HIGH predictions`);
      }
      console.log('');

      // Also check by predicted_date
      console.log(`⏰ Checking date fields more carefully:`);
      predictions.forEach((pred, i) => {
        console.log(`  Pred ${i + 1}:`);
        console.log(`    predictedDate: ${pred.predictedDate} (type: ${typeof pred.predictedDate})`);
        console.log(`    created_at: ${pred.created_at} (type: ${typeof pred.created_at})`);
        console.log(`    Is in window? ${pred.predictedDate ? pred.predictedDate >= timeWindowStart : 'N/A'}`);
      });
    }

    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugAlertLogic();
