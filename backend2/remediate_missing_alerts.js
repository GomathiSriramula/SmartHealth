/**
 * Remediation script: Create missing alerts for existing HIGH predictions
 * This handles cases where predictions were created before the alert checker fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Prediction } = require('./models');
const Alert = require('./models/Alert');

const ALERT_THRESHOLD = 2;
const DEFAULT_TIME_WINDOW = 48 * 60 * 60 * 1000;
const TIME_WINDOW = process.env.ALERT_TIME_WINDOW_MS || DEFAULT_TIME_WINDOW;

async function createMissingAlerts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';
    console.log(`🔌 Connecting to MongoDB...\n`);
    
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected\n`);

    // Find all locations with HIGH risk predictions
    const highRiskPredictions = await Prediction.find({
      riskLevel: { $in: ['high', 'HIGH'] }
    }).sort({ predictedDate: -1, created_at: -1 });

    console.log(`📊 Found ${highRiskPredictions.length} HIGH risk predictions\n`);

    // Group by location
    const locationMap = {};
    highRiskPredictions.forEach(pred => {
      const loc = pred.location || 'Unknown';
      if (!locationMap[loc]) {
        locationMap[loc] = [];
      }
      locationMap[loc].push(pred);
    });

    console.log(`📍 Locations with HIGH predictions:`);
    Object.entries(locationMap).forEach(([loc, preds]) => {
      console.log(`   "${loc}": ${preds.length} HIGH predictions`);
    });
    console.log('');

    // For each location, check if alert exists and create if needed
    let alertsCreated = 0;
    let alertsSkipped = 0;

    for (const [location, predictions] of Object.entries(locationMap)) {
      if (predictions.length < ALERT_THRESHOLD) {
        console.log(`⏭️  "${location}": ${predictions.length} predictions (need ${ALERT_THRESHOLD}) - skipping`);
        alertsSkipped++;
        continue;
      }

      // Check if alert already exists
      const existingAlert = await Alert.findOne({ location });
      if (existingAlert) {
        console.log(`⏭️  "${location}": Alert already exists (${existingAlert._id})`);
        alertsSkipped++;
        continue;
      }

      console.log(`\n🧪 Creating alert for "${location}" (${predictions.length} HIGH predictions)`);

      // Get the 2 most recent HIGH predictions
      const topPredictions = predictions.slice(0, 2);

      // Create alert
      const newAlert = new Alert({
        location: location,
        riskLevel: 'HIGH',
        reason: `${ALERT_THRESHOLD} consecutive HIGH risk predictions at ${location}`,
        triggeringPredictions: topPredictions.map(pred => ({
          predictionId: pred._id,
          risk: pred.risk || pred.riskLevel,
          confidence: pred.confidence,
          pH: pred.waterQuality?.pH,
          Turbidity: pred.waterQuality?.Turbidity,
          Dissolved_Oxygen: pred.waterQuality?.Dissolved_Oxygen,
          predictedAt: pred.predictedAt || pred.predictedDate,
        })),
        status: 'active',
        notificationSent: false,
        metadata: {
          sourceRequest: 'remediation-script',
          triggeredBy: 'batch-processing',
          escalationLevel: 1,
        },
      });

      await newAlert.save();
      console.log(`   ✅ Alert created: ${newAlert._id}`);
      console.log(`   Triggering predictions: ${topPredictions.map(p => p._id.toString().slice(-8)).join(', ')}`);
      alertsCreated++;
    }

    console.log(`\n📊 Remediation Summary:`);
    console.log(`   Alerts created: ${alertsCreated}`);
    console.log(`   Alerts skipped: ${alertsSkipped}`);
    console.log(`   Total alerts in DB: ${await Alert.countDocuments()}`);
    console.log(`   Active alerts: ${await Alert.countDocuments({ status: 'active' })}`);

    console.log('\n✅ Remediation complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createMissingAlerts();
