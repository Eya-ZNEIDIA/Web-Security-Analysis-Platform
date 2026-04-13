const express = require("express");
const router = express.Router();

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const settingsController = require("../controllers/settingsController");

router.get(
  "/admin/settings",
  protect,
  authorizeRoles(["admin"]),
  settingsController.getSettings
);

router.put(
  "/admin/settings",
  protect,
  authorizeRoles(["admin"]),
  settingsController.updateSettings
);

module.exports = router;