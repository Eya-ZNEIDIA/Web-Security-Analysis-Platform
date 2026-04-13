const express = require("express");
const router = express.Router();

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const adminSettingsController = require("../controllers/adminSettingsController");

// GET /api/admin/settings
router.get(
  "/",
  protect,
  authorizeRoles(["admin"]),
  adminSettingsController.getAdminSettings
);

// PUT /api/admin/settings
router.put(
  "/",
  protect,
  authorizeRoles(["admin"]),
  adminSettingsController.updateAdminSettings
);

module.exports = router;