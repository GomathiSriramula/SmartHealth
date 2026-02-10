require("dotenv").config();
const mongoose = require("mongoose");
const { checkForAlerts } = require("./services/alertChecker");

async function testAlertChecker() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";

  console.log(`\n🧪 Testing Alert Checker Service\n`);

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Get the first 2 predictions
    const Prediction = mongoose.model('Prediction') || require('./models/Prediction');
    const predictions = await Prediction.find({})
      .sort({ predictedDate: -1 })
      .limit(2);

    console.log(`📊 Found ${predictions.length} predictions`);
    predictions.forEach((p, i) => {
      console.log(`   [${i+1}] ${p.location} - ${p.riskLevel} - ${p._id}`);
    });

    if (predictions.length < 2) {
      console.log("\n❌ Not enough predictions to test\n");
      await mongoose.connection.close();
      return;
    }

    console.log(`\n🔍 Testing checkForAlerts with second prediction...`);
    const secondPred = predictions[0]; // Most recent

    // Convert prediction for alertChecker
    const predForAlert = {
      ...secondPred.toObject(),
      risk: secondPred.riskLevel,
      predictedAt: secondPred.predictedDate,
    };

    console.log(`   Calling checkForAlerts for location: ${secondPred.location}`);
    const result = await checkForAlerts(predForAlert);

    console.log(`\n📋 Result:`);
    console.log(`   Action: ${result.action}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Alert ID: ${result.alert ? result.alert._id : 'null'}`);
    console.log(`   Full alert: ${result.alert ? JSON.stringify(result.alert, null, 2).substring(0, 200) : 'null'}`);

    // Check database
    const Alert = require('./models/Alert');
    const alertCount = await Alert.countDocuments();
    console.log(`\n📊 Alerts in DB: ${alertCount}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testAlertChecker();
