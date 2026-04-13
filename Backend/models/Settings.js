const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true, index: true },

    general: {
      platformName: { type: String, default: "SecureAudit" },
      maxConcurrent: { type: Number, default: 5, min: 1, max: 20 },
      timeout: { type: Number, default: 30, min: 1, max: 600 },
      maintenanceMode: { type: Boolean, default: false },
    },

    notifications: {
      // ✅ uniquement in-app
      inAppAlert: { type: Boolean, default: true },
    },

    security: {
      sessionTimeout: { type: Number, default: 60, min: 5, max: 10080 },
      rateLimit: { type: Number, default: 100, min: 10, max: 100000 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", SettingsSchema);