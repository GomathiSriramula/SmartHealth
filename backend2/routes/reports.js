const express = require("express");
const router = express.Router();
const { CaseReport } = require("../models");
const publish = require("../utils/publisher");

const { authMiddleware } = require("../utils/auth");

// Debug endpoint
router.post("/reports/debug", express.json(), (req, res) => {
  const json_data = req.body;
  try {
    const types = {};
    Object.entries(json_data || {}).forEach(
      ([k, v]) =>
        (types[k] = Array.isArray(v) ? "array" : v === null ? "null" : typeof v)
    );
    return res.json({
      received_data: json_data,
      data_types: types,
      expected_schema: {
        reporter_type: "string",
        reporter_id: "string",
        patient_age: "integer",
        sex: "string (M/F/O)",
        lat: "float",
        lng: "float",
        symptoms: "array of strings",
        reported_at: "datetime (ISO format)",
      },
    });
  } catch (e) {
    return res.json({ error: e.message, raw_body: JSON.stringify(req.body) });
  }
});

async function normalizeAndCreateReport(body) {
  const report = Object.assign({}, body);
  // symptoms: allow string (comma separated) or array
  if (typeof report.symptoms === "string") {
    report.symptoms = report.symptoms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // sex normalization
  if (typeof report.sex === "string") {
    const s = report.sex.toUpperCase();
    if (["MALE", "M"].includes(s)) report.sex = "M";
    else if (["FEMALE", "F"].includes(s)) report.sex = "F";
    else if (["OTHER", "O"].includes(s)) report.sex = "O";
  }
  // reported_at string -> Date
  if (typeof report.reported_at === "string") {
    const date = new Date(report.reported_at);
    if (!isNaN(date)) report.reported_at = date;
  }
  // final create
  const obj = await CaseReport.create(report);
  return obj;
}

router.post("/report", authMiddleware, async (req, res) => {
  try {
    const obj = await normalizeAndCreateReport(req.body);
    await publish("case_reports", { id: obj._id });
    return res.json({ status: "accepted", id: obj._id });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating report", detail: e.message });
  }
});

router.post("/reports", authMiddleware, async (req, res) => {
  try {
    const obj = await normalizeAndCreateReport(req.body);
    await publish("case_reports", { id: obj._id });
    return res.json({ status: "accepted", id: obj._id });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error creating report", detail: e.message });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip || "0", 10) || 0;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 1000);
    const docs = await CaseReport.find().skip(skip).limit(limit).lean();
    return res.json(docs);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error fetching reports", detail: e.message });
  }
});

module.exports = router;
