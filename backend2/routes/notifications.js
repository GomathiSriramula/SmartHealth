const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Notification = require("../models/Notification");
const { authMiddleware } = require("../utils/auth");
const { buildNotificationFilter } = require("../services/notificationCenter");

function formatNotification(n, userId) {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    location: n.location,
    severity: n.severity,
    entityId: n.entityId,
    entityType: n.entityType,
    createdAt: n.createdAt,
    read: (n.readBy || []).some((id) => id.toString() === userId),
  };
}

/**
 * GET /notifications
 * List notifications visible to the current user (role/district-scoped —
 * see buildNotificationFilter). Optional ?unread=true to list only unread.
 */
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const filter = buildNotificationFilter(req.user);
    const limitVal = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const skipVal = parseInt(req.query.skip, 10) || 0;
    const userId = req.user.id;

    const query = req.query.unread === "true" ? { ...filter, readBy: { $ne: userId } } : filter;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skipVal).limit(limitVal).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, readBy: { $ne: userId } }),
    ]);

    return res.json({
      notifications: notifications.map((n) => formatNotification(n, userId)),
      total,
      unreadCount,
      limit: limitVal,
      skip: skipVal,
    });
  } catch (error) {
    console.error("[Notifications] Error listing notifications:", error.message);
    return res.status(500).json({ error: "Failed to fetch notifications", detail: error.message });
  }
});

/**
 * GET /notifications/unread-count
 * Lightweight endpoint for the navbar bell to poll — avoids pulling the full
 * notification list just to render a badge number.
 */
router.get("/notifications/unread-count", authMiddleware, async (req, res) => {
  try {
    const filter = buildNotificationFilter(req.user);
    const unreadCount = await Notification.countDocuments({ ...filter, readBy: { $ne: req.user.id } });
    return res.json({ unreadCount });
  } catch (error) {
    console.error("[Notifications] Error counting unread:", error.message);
    return res.status(500).json({ error: "Failed to fetch unread count", detail: error.message });
  }
});

/**
 * POST /notifications/:id/read
 * Mark a single notification read for the current user only. Scoped through
 * the same visibility filter as the list endpoint, so a user can never mark
 * (or even discover the existence of) a notification outside their role/
 * district by guessing an id.
 */
router.post("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }
    const filter = { _id: req.params.id, ...buildNotificationFilter(req.user) };
    const updated = await Notification.findOneAndUpdate(
      filter,
      { $addToSet: { readBy: req.user.id } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }
    return res.json({ success: true, notification: formatNotification(updated, req.user.id) });
  } catch (error) {
    console.error("[Notifications] Error marking read:", error.message);
    return res.status(500).json({ error: "Failed to mark notification read", detail: error.message });
  }
});

/**
 * POST /notifications/mark-all-read
 * Mark every notification currently visible to this user as read, in one
 * batch update.
 */
router.post("/notifications/mark-all-read", authMiddleware, async (req, res) => {
  try {
    const filter = buildNotificationFilter(req.user);
    const result = await Notification.updateMany(
      { ...filter, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    return res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error("[Notifications] Error marking all read:", error.message);
    return res.status(500).json({ error: "Failed to mark all notifications read", detail: error.message });
  }
});

module.exports = router;
