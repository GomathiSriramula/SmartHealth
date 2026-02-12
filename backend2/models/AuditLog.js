const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * 
 * Stores audit trail of critical actions performed by users
 * for compliance, security monitoring, and operational analysis.
 */

const AuditLogSchema = new mongoose.Schema(
  {
    // The action performed (e.g., CREATE_PREDICTION, RESOLVE_ALERT, UPLOAD_CSV)
    action: {
      type: String,
      required: true,
      enum: ['CREATE_PREDICTION', 'RESOLVE_ALERT', 'UPLOAD_CSV'],
      index: true,
    },

    // Username of the user who performed the action
    username: {
      type: String,
      required: true,
      index: true,
    },

    // User's role (ADMIN, OPERATOR, USER)
    role: {
      type: String,
      enum: ['ADMIN', 'OPERATOR', 'USER'],
      required: true,
    },

    // Village/location where action was performed
    // For ADMIN users, this is their assigned village
    // For other roles, this may be derived from the entity or request context
    village: {
      type: String,
      default: null,
      index: true,
    },

    // ID of the entity being acted upon (prediction ID, alert ID, report ID, etc.)
    // Optional because not all actions have a specific entity
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Additional metadata about the action
    // Can include request parameters, results, errors, etc.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Timestamp when the action was performed
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // User's IP address (if available from request)
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false, // We use explicit timestamp field
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ action: 1, timestamp: -1 }); // Find actions by type, most recent first
AuditLogSchema.index({ username: 1, timestamp: -1 }); // User activity timeline
AuditLogSchema.index({ village: 1, timestamp: -1 }); // Location-based audit trail
AuditLogSchema.index({ username: 1, action: 1 }); // User-specific action history
AuditLogSchema.index({ timestamp: -1 }); // Most recent actions across all users

// Check if model already exists before creating
let AuditLog;
try {
  AuditLog = mongoose.model('AuditLog');
} catch (error) {
  AuditLog = mongoose.model('AuditLog', AuditLogSchema, 'audit_logs');
}

module.exports = AuditLog;
