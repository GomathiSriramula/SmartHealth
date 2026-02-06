const mongoose = require('mongoose');

/**
 * Alert Schema
 * 
 * Stores outbreak alerts triggered by consecutive HIGH risk predictions
 * at the same location.
 * 
 * Alert Lifecycle:
 * 1. Created when 2 consecutive HIGH risk predictions at same location
 * 2. Marked as "active" and notification sent
 * 3. Marked as "resolved" when risk drops below HIGH
 * 4. Prevents duplicate alerts for same ongoing outbreak
 */

const AlertSchema = new mongoose.Schema(
  {
    // Location reporting the high risk (e.g., "Main Plant", "North Facility")
    location: {
      type: String,
      required: true,
      index: true,
    },

    // Risk level that triggered the alert (always "HIGH" for now)
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
      default: 'HIGH',
    },

    // Description of alert trigger
    // e.g., "Consecutive HIGH risks at Main Plant (predictions #1, #2)"
    reason: {
      type: String,
      required: true,
    },

    // Prediction records that triggered this alert
    triggeringPredictions: [
      {
        predictionId: mongoose.Schema.Types.ObjectId,
        risk: String,
        confidence: Number,
        pH: Number,
        Turbidity: Number,
        Dissolved_Oxygen: Number,
        predictedAt: Date,
      },
    ],

    // Status of the alert
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
      index: true,
    },

    // When the alert was resolved (if applicable)
    resolvedAt: {
      type: Date,
      default: null,
    },

    // Resolution reason (e.g., "Risk dropped to MEDIUM")
    resolvedReason: {
      type: String,
      default: null,
    },

    // Notification tracking
    notificationSent: {
      type: Boolean,
      default: false,
    },

    notificationTimestamp: {
      type: Date,
      default: null,
    },

    notificationError: {
      type: String,
      default: null,
    },

    // Email recipients
    recipients: [
      {
        type: String, // email address
      },
    ],

    // Additional metadata
    metadata: {
      sourceRequest: String,
      triggeredBy: String, // "system", "manual", etc.
      escalationLevel: {
        type: Number,
        default: 1, // Can be extended for multi-level escalation
      },
    },

    // Timestamp when alert was created
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Timestamp when alert was last updated
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
AlertSchema.index({ location: 1, status: 1 }); // Find active alerts by location
AlertSchema.index({ createdAt: -1 }); // Most recent alerts
AlertSchema.index({ location: 1, createdAt: -1 }); // Timeline for location

// Pre-save hook to update updatedAt
AlertSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Check if model already exists before creating
let AlertModel;
try {
  AlertModel = mongoose.model('Alert');
} catch (error) {
  AlertModel = mongoose.model('Alert', AlertSchema);
}

module.exports = AlertModel;
