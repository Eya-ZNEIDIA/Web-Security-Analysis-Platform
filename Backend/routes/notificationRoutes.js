const express = require("express");
const router = express.Router();

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const Notification = require("../models/Notification");

router.get("/admin/notifications", protect, authorizeRoles(["admin"]), async (req, res) => {
  const items = await Notification.find({ targetRole: "admin" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = items.filter((n) => !n.read).length;

  res.json({ notifications: items, unreadCount });
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