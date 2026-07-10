const express = require("express");
const router = express.Router();
const { SensorReading } = require("../models");
const publish = require("../utils/publisher");
const { triggerPrediction } = require("../services/predictionTrigger");
const { checkForAlerts } = require("../services/alertChecker");

const { authMiddleware, buildDistrictFilter, getUserDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");

/**
 * Helper to trigger ML prediction for water quality data
 * Runs asynchronously without blocking the response
 */
async function asyncTriggerPrediction(sensorData) {
  try {
    // Map sensor fields to ML model expected fields
    const waterQualityData = {
      pH: sensorData.pH,
      Turbidity: sensorData.turbidity,
      Dissolved_Oxygen: sensorData.conductivity // Note: using conductivity as proxy if DO not available
    };
    
    // Only trigger if we have water quality data
    if (waterQualityData.pH !== undefined && waterQualityData.Turbidity !== undefined) {
      const location = sensorData.location || `Coordinates: (${sensorData.lat}, ${sensorData.lng})`;
      const prediction = await triggerPrediction(waterQualityData, { location, source: 'sensor' });
      
      if (prediction) {
        console.log(`🎯 [Sensor Prediction] NEW: ML prediction triggered for sensor ${sensorData.sensor_id} - Risk: ${prediction.risk}`);
        
        // 🚨 NEW: Check for alerts (consecutive HIGH risks at same location)
        try {
          const alertResult = await checkForAlerts(prediction);
          
          if (alertResult.action === 'created') {
            console.log(`🚨 [Sensor Alert] Alert CREATED from water quality: ${alertResult.message}`);
          } else if (alertResult.action === 'resolved') {
            console.log(`✅ [Sensor Alert] Alert RESOLVED: ${alertResult.message}`);
          } else if (alertResult.action !== 'error') {
            console.log(`⏳ [Sensor Alert] Alert check: ${alertResult.message}`);
          }
        } catch (alertError) {
          console.error(`⚠️  [Sensor Alert] Alert check failed (non-blocking):`, alertError.message);
        }
      }
    }
  } catch (error) {
    console.error(`⚠️  [Sensor Prediction] Error triggering ML prediction:`, error.message);
    // Don't let prediction errors block sensor data intake
  }
}

router.post("/sensor", authMiddleware, locationGuard(), async (req, res) => {
  try {
    const body = Object.assign({}, req.body);
    if (!body.location && req.user?.role === "OPERATOR") {
      body.location = getUserDistrict(req.user);
    }
    if (typeof body.reading_at === "string") {
      const d = new Date(body.reading_at);
      if (!isNaN(d)) body.reading_at = d;
    }
    const obj = await SensorReading.create(body);
    await publish("sensor_readings", { id: obj._id });
    
    // 🎯 NEW: Trigger ML prediction asynchronously
    asyncTriggerPrediction(obj.toObject());
    
    return res.json({ status: "accepted", sensor_id: obj._id });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating sensor reading", detail: e.message });
  }
});

router.post("/sensors", authMiddleware, locationGuard(), async (req, res) => {
  try {
    const body = Object.assign({}, req.body);
    if (!body.location && req.user?.role === "OPERATOR") {
      body.location = getUserDistrict(req.user);
    }
    if (typeof body.reading_at === "string") {
      const d = new Date(body.reading_at);
      if (!isNaN(d)) body.reading_at = d;
    }
    const obj = await SensorReading.create(body);
    await publish("sensor_readings", { id: obj._id });
    
    // 🎯 NEW: Trigger ML prediction asynchronously
    asyncTriggerPrediction(obj.toObject());
    
    return res.json({ status: "accepted", sensor_id: obj._id });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating sensor reading", detail: e.message });
  }
});

router.get("/sensors", authMiddleware, async (req, res) => {
  try {
    const skip = parseInt(req.query.skip || "0", 10) || 0;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 1000);
    const docs = await SensorReading.find(buildDistrictFilter(req.user)).skip(skip).limit(limit).lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error fetching sensor readings", detail: e.message });
  }
});

module.exports = router;
