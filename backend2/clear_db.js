require("dotenv").config();
const mongoose = require("mongoose");

async function clearDatabase() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";

  console.log(`\n📊 Connecting to: ${MONGODB_URI}\n`);

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Get all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections.map((c) => c.name);

    console.log(`📋 Collections found: ${collectionNames.join(", ")}\n`);

    // Count documents in each collection before clearing
    console.log("📊 Documents BEFORE clearing:");
    for (const collName of collectionNames) {
      const count = await mongoose.connection.db
        .collection(collName)
        .countDocuments();
      console.log(`   - ${collName}: ${count} documents`);
    }

    // Clear all collections
    console.log("\n🗑️  Clearing all collections...\n");
    for (const collName of collectionNames) {
      await mongoose.connection.db.collection(collName).deleteMany({});
      console.log(`   ✅ Cleared ${collName}`);
    }

    // Count after clearing
    console.log("\n📊 Documents AFTER clearing:");
    for (const collName of collectionNames) {
      const count = await mongoose.connection.db
        .collection(collName)
        .countDocuments();
      console.log(`   - ${collName}: ${count} documents`);
    }

    console.log(
      "\n✅ Database cleared successfully! You can now register with new data.\n"
    );

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

clearDatabase();
