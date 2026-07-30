const Notification = require("../models/Notification");
const { getUserDistrict, buildDistrictFilter } = require("../utils/auth");

/**
 * Notification Center
 *
 * Creates in-app Notification Center records. This is deliberately isolated
 * from the existing email pipeline (utils/mailer.js, services/alertNotifier.js,
 * utils/notificationRecipients.js) — nothing here sends email, and nothing in
 * the email pipeline was changed to call this. Each call site (alertChecker,
 * alertsApi, reports, uploads, auth) invokes both independently, side by side,
 * exactly the way it already invokes the email helpers.
 *
 * createNotification() never throws — same fail-safe philosophy as
 * utils/auditLogger.js's logAudit(): a broken notification must never break
 * the real work (alert creation, report submission, CSV upload, etc.) that
 * triggered it.
 */
async function createNotification({
  type,
  title,
  message,
  location = null,
  severity = null,
  entityId = null,
  entityType = null,
  audience,
}) {
  try {
    const doc = await Notification.create({
      type,
      title,
      message,
      location,
      severity,
      entityId,
      entityType,
      audience,
    });
    return doc;
  } catch (error) {
    console.error(`[NotificationCenter] Failed to create "${type}" notification:`, error.message);
    return null;
  }
}

/**
 * Role-based visibility filter — same district-scoping rule used everywhere
 * else in the app (GET /reports, GET /api/alerts, GET /analytics, etc.):
 *   ADMIN    -> every notification, any audience
 *   OPERATOR -> DISTRICT/PUBLIC notifications for their own assigned district
 *               only (an operator with no assigned district sees nothing,
 *               same safe-default used throughout the rest of the app)
 *   USER     -> PUBLIC notifications only (matches the Outbreak Map: active
 *               alerts and their resolution, never case-level detail)
 */
function buildNotificationFilter(user) {
  const role = (user && user.role) || "USER";

  if (role === "ADMIN") {
    return {};
  }

  if (role === "OPERATOR") {
    const district = getUserDistrict(user);
    if (!district) {
      // No assigned district -- see notificationRecipients.js / the
      // whitespace-district fix in auth.js for why "no restriction" is never
      // the safe fallback here; "nothing" is.
      return { _id: null };
    }
    return {
      ...buildDistrictFilter(user),
      audience: { $in: ["DISTRICT", "PUBLIC"] },
    };
  }

  return { audience: "PUBLIC" };
}

module.exports = { createNotification, buildNotificationFilter };
