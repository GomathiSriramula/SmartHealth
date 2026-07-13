const mongoose = require("mongoose");
const AuditLog = require("./models/AuditLog");

const CaseReportSchema = new mongoose.Schema(
  {
    reporter_type: { type: String, required: true },
    reporter_id: { type: String, required: true },
    patient_age: { type: Number, required: true },
    sex: { type: String, required: true, enum: ["M", "F", "O"] },
    lat: { type: Number, required: false },
    lng: { type: Number, required: false },
    location: { type: String, required: false },
    village_area: { type: String, required: false },
    severity: { type: String, required: false, enum: ["Mild", "Moderate", "Severe", "Critical"] },
    remarks: { type: String, required: false },
    symptoms: { type: [String], required: true },
    reported_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: "created_at" } }
);


const PredictionSchema = new mongoose.Schema(
  {
    predictionType: { type: String, required: true },
    location: { type: String, required: false },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "Low", "Medium", "High"],
      required: true,
    },
    predictedDate: { type: Date, required: true, default: Date.now },
    details: { type: String, required: true },
    recommendations: { type: [String], default: [] },
    modelVersion: { type: String, required: false },
    confidence: { type: Number, required: false, min: 0, max: 100 },
    lat: { type: Number, required: false },
    lng: { type: Number, required: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const CaseReport = mongoose.model(
  "CaseReport",
  CaseReportSchema,
  "case_reports"
);

let Prediction;
try {
  Prediction = mongoose.model("Prediction");
} catch (error) {
  Prediction = mongoose.model("Prediction", PredictionSchema, "predictions");
}

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'OPERATOR', 'USER'], default: 'USER' },
  locations: [{ type: String }], // Optional: locations user is assigned to (e.g., ["Plant A", "Plant B"])
  adminLocation: {
    // Optional metadata for ADMIN accounts
    state: String,
    district: String,
    village: String
  },
  created_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema, "users");

module.exports = { CaseReport, Prediction, User, AuditLog };