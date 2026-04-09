const Settings = require("../models/Settings");

exports.getSettings = async (req, res) => {
  const settings = await Settings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return res.json({ settings });
};

exports.updateSettings = async (req, res) => {
  const body = req.body || {};

  const update = {};

  if (body.general) {
    update.general = {
      platformName: body.general.platformName,
      maxConcurrent: body.general.maxConcurrent,
      timeout: body.general.timeout,
      maintenanceMode: body.general.maintenanceMode,
    };
  }

  if (body.notifications) {
    update.notifications = {
      inAppAlert: Boolean(body.notifications.inAppAlert),
    };
  }

  if (body.security) {
    update.security = {
      sessionTimeout: body.security.sessionTimeout,
      rateLimit: body.security.rateLimit,
      ipWhitelist: body.security.ipWhitelist, // garde seulement si tu l'utilises
    };
  }

  const settings = await Settings.findOneAndUpdate(
    { key: "global" },
    { $set: update, $setOnInsert: { key: "global" } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return res.json({ settings });
};