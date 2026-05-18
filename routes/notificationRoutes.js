const express = require("express");
const router = express.Router();

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const Notification = require("../models/Notification");

router.get("/admin/notifications", protect, authorizeRoles(["admin"]), async (req, res) => {
  // Only return unread notifications for dashboard
  const items = await Notification.find({ targetRole: "admin", read: false })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ notifications: items, unreadCount: items.length });
});

router.put("/admin/notifications/mark-all-read", protect, authorizeRoles(["admin"]), async (req, res) => {
  const result = await Notification.updateMany(
    { targetRole: "admin", read: false },
    { $set: { read: true } }
  );
  res.json({ message: "Toutes les notifications marquées comme lues", modified: result.modifiedCount });
});

router.put("/admin/notifications/:id/read", protect, authorizeRoles(["admin"]), async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, targetRole: "admin" },
    { $set: { read: true } },
    { new: true }
  ).lean();

  if (!notif) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification: notif });
});

module.exports = router;