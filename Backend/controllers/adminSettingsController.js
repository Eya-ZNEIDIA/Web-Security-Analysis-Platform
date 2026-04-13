const AdminSettings = require("../models/AdminSettings");

async function getOrCreateSettings() {
  let settings = await AdminSettings.findOne();
  if (!settings) settings = await AdminSettings.create({});
  return settings;
}

// helpers
const toBool = (v, fallback) =>
  typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback;

const toNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v, fallback) => (typeof v === "string" ? v : fallback);

exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    // ✅ récupérer des objets "plats" sûrs
    const currentGeneral = settings.general?.toObject
      ? settings.general.toObject()
      : settings.general || {};
    const currentNotifications = settings.notifications?.toObject
      ? settings.notifications.toObject()
      : settings.notifications || {};
    const currentSecurity = settings.security?.toObject
      ? settings.security.toObject()
      : settings.security || {};

    // ✅ whitelist + cast types
    if (req.body?.general) {
      const g = req.body.general;
      settings.general = {
        ...currentGeneral,
        platformName: toStr(g.platformName, currentGeneral.platformName ?? ""),
        maxConcurrent: toNum(g.maxConcurrent, currentGeneral.maxConcurrent ?? 5),
        timeout: toNum(g.timeout, currentGeneral.timeout ?? 30),
        maintenanceMode: toBool(
          g.maintenanceMode,
          currentGeneral.maintenanceMode ?? false
        ),
      };
    }

    if (req.body?.notifications) {
      const n = req.body.notifications;
      settings.notifications = {
        ...currentNotifications,

        // champs existants (si tu les utilises toujours)
        emailCritical: toBool(n.emailCritical, currentNotifications.emailCritical ?? true),
        emailReport: toBool(n.emailReport, currentNotifications.emailReport ?? true),
        weeklyDigest: toBool(n.weeklyDigest, currentNotifications.weeklyDigest ?? false),
        inAppAlert: toBool(n.inAppAlert, currentNotifications.inAppAlert ?? true),

        // ✅ nouveaux champs
        auditReportEnabled: toBool(
          n.auditReportEnabled,
          currentNotifications.auditReportEnabled ?? true
        ),
        auditEmailToAdmin: toBool(
          n.auditEmailToAdmin,
          currentNotifications.auditEmailToAdmin ?? false
        ),
        auditBoardAlert: toBool(
          n.auditBoardAlert,
          currentNotifications.auditBoardAlert ?? true
        ),
      };
    }

    if (req.body?.security) {
      const s = req.body.security;
      settings.security = {
        ...currentSecurity,
        sessionTimeout: toNum(
          s.sessionTimeout,
          currentSecurity.sessionTimeout ?? 60
        ),
        rateLimit: toNum(s.rateLimit, currentSecurity.rateLimit ?? 100),
        ipWhitelist: toStr(s.ipWhitelist, currentSecurity.ipWhitelist ?? ""),
      };
    }

    await settings.save();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};