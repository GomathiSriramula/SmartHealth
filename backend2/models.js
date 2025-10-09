const mongoose = require("mongoose");

const CaseReportSchema = new mongoose.Schema(
  {
    reporter_type: { type: String, required: true },
    reporter_id: { type: String, required: true },
    patient_age: { type: Number, required: true },
    sex: { type: String, required: true, enum: ["M", "F", "O"] },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    symptoms: { type: [String], required: true },
    reported_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: "created_at" } }
);

const SensorReadingSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true },
    reading_at: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    turbidity: { type: Number, default: null },
    pH: { type: Number, default: null },
    conductivity: { type: Number, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const CaseReport = mongoose.model(
  "CaseReport",
  CaseReportSchema,
  "case_reports"
);
const SensorReading = mongoose.model(
  "SensorReading",
  SensorReadingSchema,
  "sensor_readings"
);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: false, unique: false },
  passwordHash: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema, "users");

module.exports = { CaseReport, SensorReading, User };
