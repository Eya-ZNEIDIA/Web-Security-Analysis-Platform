const Settings = require("../models/Settings");

exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      {
        upsert: true,
        new: true, // ✅ مهم (correct mongoose option)
      }
    ).lean();

    return res.json({ settings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const body = req.body || {};

    const update = {};

    // =========================
    // GENERAL SETTINGS
    // =========================
    if (body.general) {
      update.general = {
        platformName: body.general.platformName,
        maxConcurrent: Number(body.general.maxConcurrent),
        timeout: Number(body.general.timeout),
        maintenanceMode: Boolean(body.general.maintenanceMode),
      };
    }

    // =========================
    // NOTIFICATIONS (FIX IMPORTANT 🔥)
    // =========================
    if (body.notifications) {
      update.notifications = {
        emailCritical: Boolean(body.notifications.emailCritical),
        emailReport: Boolean(body.notifications.emailReport),
        weeklyDigest: Boolean(body.notifications.weeklyDigest),

        auditReportEnabled: Boolean(body.notifications.auditReportEnabled),
        inAppAlert: Boolean(body.notifications.inAppAlert),
        auditEmailToAdmin: Boolean(body.notifications.auditEmailToAdmin),
      };
    }

    // =========================
    // SECURITY
    // =========================
    if (body.security) {
      update.security = {
        sessionTimeout: Number(body.security.sessionTimeout),
        rateLimit: Number(body.security.rateLimit),
        ipWhitelist: body.security.ipWhitelist || "",
      };
    }

    // =========================
    // SAVE SETTINGS
    // =========================
    const settings = await Settings.findOneAndUpdate(
      { key: "global" },
      {
        $set: update,
        $setOnInsert: { key: "global" },
      },
      {
        upsert: true,
        new: true, // ✅ important
      }
    ).lean();

    return res.json({ settings });
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ error: err.message });
  }
};