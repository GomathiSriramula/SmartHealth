require("dotenv").config();
const mongoose = require("mongoose");

async function checkPredictions() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";

  console.log(`\n📊 Connecting to MongoDB...`);

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Check predictions
    const db = mongoose.connection.db;
    
    console.log(`📋 Checking 'predictions' collection:`);
    const predCount = await db.collection("predictions").countDocuments();
    console.log(`   Total predictions: ${predCount}\n`);
    
    if (predCount > 0) {
      const predictions = await db
        .collection("predictions")
        .find({})
        .sort({ predictedDate: -1 })
        .limit(3)
        .toArray();

      console.log(`   Last 3 predictions:`);
      predictions.forEach((pred, i) => {
        console.log(`   [${i + 1}] ID: ${pred._id}`);
        console.log(`       Location: ${pred.location}`);
        console.log(`       RiskLevel: ${pred.riskLevel}`);
        console.log(`       PredictionType: ${pred.predictionType}`);
        console.log(`       Confidence: ${pred.confidence}`);
        console.log(`       Fields: ${Object.keys(pred).join(", ")}`);
        console.log();
      });
    }
    
    // Check alerts collection
    console.log(`📋 Checking 'alerts' collection:`);
    const alertCount = await db.collection("alerts").countDocuments();
    console.log(`   Total alerts: ${alertCount}\n`);
    
    if (alertCount > 0) {
      const alerts = await db
        .collection("alerts")
        .find({})
        .sort({ createdAt: -1 })
        .limit(2)
        .toArray();

      console.log(`   Alerts found:`);
      alerts.forEach((alert, i) => {
        console.log(`   [${i + 1}] Location: ${alert.location}`);
        console.log(`       Status: ${alert.status}`);
        console.log(`       RiskLevel: ${alert.riskLevel}`);
        console.log(`       Reason: ${alert.reason}`);
        console.log();
      });
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkPredictions();
