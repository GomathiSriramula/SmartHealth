require("dotenv").config();
const mongoose = require("mongoose");

async function checkAlerts() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";

  console.log(`\n📊 Connecting to MongoDB...`);

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Get all alerts from database
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const alertCollections = collections
      .map((c) => c.name)
      .filter((name) => name.toLowerCase().includes("alert"));

    console.log(`📋 Found ${alertCollections.length} alert collections:`);
    alertCollections.forEach((c) => console.log(`   - ${c}`));

    // Check each alert collection
    for (const collName of alertCollections) {
      const count = await db.collection(collName).countDocuments();
      console.log(`\n📊 ${collName}: ${count} documents`);

      if (count > 0) {
        const alerts = await db
          .collection(collName)
          .find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        console.log(`   Last 5 documents:`);
        alerts.forEach((alert, i) => {
          console.log(`   [${i + 1}] Location: ${alert.location || "N/A"}`);
          console.log(`       Status: ${alert.status || "N/A"}`);
          console.log(`       Risk Level: ${alert.riskLevel || "N/A"}`);
          console.log(`       Created: ${alert.createdAt || "N/A"}`);
          console.log(`       ID: ${alert._id}`);
          console.log();
        });
      }
    }

    // Also check ML predictions
    console.log(`\n📊 Checking ML Predictions for HIGH risk:...\n`);
    const predictions = await db
      .collection("ml_predictions")
      .find({ riskLevel: { $in: ["HIGH", "high"] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.log(`Found ${predictions.length} HIGH risk predictions:\n`);
    predictions.forEach((pred, i) => {
      console.log(`[${i + 1}] Location: ${pred.location || "N/A"}`);
      console.log(`    Risk: ${pred.riskLevel}`);
      console.log(`    Created: ${pred.createdAt}`);
      console.log(`    ID: ${pred._id}\n`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkAlerts();
