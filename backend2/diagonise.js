require("dotenv").config();
const mongoose = require("mongoose");
const { CaseReport, Prediction } = require("./models");
const Alert = require("./models/Alert");

async function run() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";
    await mongoose.connect(uri);
    console.log("Connected DB name:", mongoose.connection.name);

    const reportCount = await CaseReport.countDocuments();
    console.log("Total case reports:", reportCount);

    if (reportCount === 0) {
        // No reports exist at all — every prediction/alert is orphaned, safe to clear all
        const predResult = await Prediction.deleteMany({});
        console.log(`Deleted ${predResult.deletedCount} prediction(s)`);

        const alertResult = await Alert.deleteMany({});
        console.log(`Deleted ${alertResult.deletedCount} alert(s)`);
    } else {
        console.log("Reports still exist — skipping full wipe. Use the relatedReportId-based cleanup instead.");
    }

    await mongoose.disconnect();
    console.log("Done.");
}

run().catch(console.error);