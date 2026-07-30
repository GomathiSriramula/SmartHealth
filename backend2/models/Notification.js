const mongoose = require('mongoose');

/**
 * Notification Schema
 *
 * Powers the in-app Notification Center (navbar bell + panel). This is
 * intentionally separate from the existing email pipeline (utils/mailer.js,
 * services/alertNotifier.js) — creating one never sends an email, and
 * sending an email never creates one. The two systems are wired
 * independently at each call site so neither can break the other.
 *
 * Read state is per-user (readBy), not a single global flag: the same
 * notification (e.g. "Alert created in Warangal") is shared by every admin
 * and the district's operator, and one of them reading it must not mark it
 * read for the others.
 */
const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'ALERT_CREATED',
        'ALERT_RESOLVED',
        'ALERT_NOTIFIED',
        'CSV_UPLOAD_SUCCESS',
        'HIGH_RISK_REPORT',
        'OPERATOR_CREATED',
      ],
      index: true,
    },

    title: { type: String, required: true },
    message: { type: String, required: true },

    // District this notification concerns. null for notifications that
    // aren't tied to one place (e.g. an admin-only account-management event).
    location: { type: String, default: null, index: true },

    // Only meaningful for alert/report-related types.
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', null], default: null },

    // Loose reference to the record this notification is about (an Alert,
    // CaseReport, or User id) — kept as a plain ObjectId + type string rather
    // than a Mongoose ref, since it can point at different collections.
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityType: { type: String, default: null },

    // Who is allowed to see this notification — enforced by
    // buildNotificationFilter() in services/notificationCenter.js, using the
    // exact same district-scoping rule (buildDistrictFilter) as every other
    // role-scoped resource in this app:
    //   ADMIN    -> sees every notification, regardless of audience
    //   DISTRICT -> ADMIN + the OPERATOR of the matching `location` only
    //   PUBLIC   -> ADMIN + that OPERATOR + every USER (no patient/case detail)
    audience: {
      type: String,
      required: true,
      enum: ['ADMIN', 'DISTRICT', 'PUBLIC'],
      index: true,
    },

    // Users who have marked this read. A Set-like array via $addToSet, not a
    // boolean, because "read" is per-viewer, not global.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

NotificationSchema.index({ audience: 1, location: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

let NotificationModel;
try {
  NotificationModel = mongoose.model('Notification');
} catch (error) {
  NotificationModel = mongoose.model('Notification', NotificationSchema, 'notifications');
}

module.exports = NotificationModel;
