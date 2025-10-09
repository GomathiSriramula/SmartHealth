const express = require("express");
const router = express.Router();
const { SensorReading } = require("../models");
const publish = require("../utils/publisher");

const { authMiddleware } = require("../utils/auth");

router.post("/sensor", authMiddleware, async (req, res) => {
  try {
    const body = Object.assign({}, req.body);
    if (typeof body.reading_at === "string") {
      const d = new Date(body.reading_at);
      if (!isNaN(d)) body.reading_at = d;
    }
    const obj = await SensorReading.create(body);
    await publish("sensor_readings", { id: obj._id });
    return res.json({ status: "accepted", sensor_id: obj._id });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating sensor reading", detail: e.message });
  }
});

router.post("/sensors", authMiddleware, async (req, res) => {
  try {
    const body = Object.assign({}, req.body);
    if (typeof body.reading_at === "string") {
      const d = new Date(body.reading_at);
      if (!isNaN(d)) body.reading_at = d;
    }
    const obj = await SensorReading.create(body);
    await publish("sensor_readings", { id: obj._id });
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
    const docs = await SensorReading.find().skip(skip).limit(limit).lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error fetching sensor readings", detail: e.message });
  }
});

module.exports = router;
