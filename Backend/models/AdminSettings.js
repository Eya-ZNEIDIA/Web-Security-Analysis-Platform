const mongoose = require("mongoose");

const adminSettingsSchema = new mongoose.Schema(
  {
    general: {
      platformName: { type: String, default: "SecureAudit" },
      maxConcurrent: { type: Number, default: 5 },
      timeout: { type: Number, default: 30 },
      maintenanceMode: { type: Boolean, default: false },
    },
    notifications: {
      emailCritical: { type: Boolean, default: true },
      emailReport: { type: Boolean, default: true },
      inAppAlert: { type: Boolean, default: true }, // ✅ master UI switch
      weeklyDigest: { type: Boolean, default: false },
      auditReportEnabled: { type: Boolean, default: true },
      auditEmailToAdmin: { type: Boolean, default: false }, // ✅ IMPORTANT

    },
    security: {
      sessionTimeout: { type: Number, default: 60 },
      rateLimit: { type: Number, default: 100 },
      ipWhitelist: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminSettings", adminSettingsSchema);