// cleanup-orphans.js — run once: node cleanup-orphans.js
require("dotenv").config();
const mongoose = require("mongoose");
const { CaseReport, Prediction } = require("./models");
const Alert = require("./models/Alert");

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health");

    const allPredictions = await Prediction.find({ relatedReportId: { $ne: null } });
    const orphanIds = [];

    for (const pred of allPredictions) {
        const exists = await CaseReport.exists({ _id: pred.relatedReportId });
        if (!exists) orphanIds.push(pred._id);
    }

    console.log(`Found ${orphanIds.length} orphaned prediction(s)`);

    if (orphanIds.length > 0) {
        const alertResult = await Alert.updateMany(
            { "triggeringPredictions.predictionId": { $in: orphanIds }, status: "active" },
            { status: "resolved", resolvedAt: new Date(), resolvedReason: "Orphaned — source report no longer exists (cleanup script)" }
        );
        console.log(`Resolved ${alertResult.modifiedCount} orphaned alert(s)`);

        const predResult = await Prediction.deleteMany({ _id: { $in: orphanIds } });
        console.log(`Deleted ${predResult.deletedCount} orphaned prediction(s)`);
    }

    await mongoose.disconnect();
    console.log("Done.");
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});