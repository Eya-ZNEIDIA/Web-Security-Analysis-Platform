const mongoose = require("mongoose");
const Audit = require("../models/Audit");
const Vulnerabilite = require("../models/Vulnerabilite");
const Alert = require("../models/Alert");

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ عد الـ audits
    const audits = await Audit.find({ userId }).select("_id scoreGlobal statut");
    const auditIds = audits.map(a => a._id);

    // ✅ عد الـ vulnerabilities
    const totalVulns = await Vulnerabilite.find({ auditId: { $in: auditIds } }).countDocuments();

    // ✅ عد الـ alerts (safe method)
    let totalAlerts = 0;
    try {
      totalAlerts = await Alert.find({ userId, read: false }).countDocuments();
    } catch (err) {
      console.warn("⚠️ Alert count failed, trying alternative:", err.message);
      const alerts = await Alert.find({ userId, read: false });
      totalAlerts = alerts.length;
    }

    // ✅ عد الـ audits المكتملة
    const secureSites = audits.filter(
  a => a.scoreGlobal >= 80
).length;

    // ✅ احسب الـ average score
    const totalScore = audits.reduce((sum, a) => sum + (a.scoreGlobal || 0), 0);
    const avgScore = audits.length > 0 
      ? Math.round(totalScore / audits.length)
      : 0;

    console.log("📊 Stats:", { 
      totalScans: audits.length, 
      vulnerabilities: totalVulns, 
      alerts: totalAlerts,
      avgScore 
    });

    res.json({
      totalScans: audits.length,
      vulnerabilities: totalVulns,
      secureSites: secureSites,
      riskScore: avgScore,
    });
  } catch (error) {
    console.error("❌ Stats Error:", error);
    res.status(500).json({ 
      message: "Erreur stats", 
      error: error.message 
    });
  }
};

// Reject ObjectIds, UUIDs, bare hashes — only keep real URLs/domains
const isValidUrl = (v) => {
  const s = String(v || "").trim();
  if (!s) return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return false;                     // MongoDB ObjectId
  if (/^[a-f0-9]{32}$/i.test(s)) return false;                     // MD5 hash
  if (/^[a-f0-9-]{36}$/i.test(s)) return false;                    // UUID
  if (/^[a-f0-9]{40,}$/i.test(s)) return false;                    // SHA hash
  if (!/[a-zA-Z]/.test(s)) return false;                           // must contain at least one letter
  if (!/\./.test(s.replace(/^https?:\/\//i, ""))) return false;   // must have a dot (domain)
  return true;
};

// GET /api/dashboard/recent-scans
const getRecentScans = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch last 50 audits, filter valid URLs, dedup by hostname
    const audits = await Audit.find({ userId })
      .sort({ date: -1 })
      .limit(50)
      .select("urlCible statut date scoreGlobal")
      .lean();

    const seen = new Map();
    for (const a of audits) {
      if (!isValidUrl(a.urlCible)) continue;
      const host = String(a.urlCible).replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
      if (!host || seen.has(host)) continue;
      seen.set(host, a);
    }

    const deduped = Array.from(seen.values()).slice(0, 8);

    const normStatus = (s, score) => {
      if (s === "En cours") return "En cours";
      if (score >= 75) return "S\u00e9curis\u00e9";
      if (score >= 50) return "Risque mod\u00e9r\u00e9";
      return "Critique";
    };

    const formatted = deduped.map(a => ({
      _id: a._id,
      url: a.urlCible,
      statut: a.statut,
      status: normStatus(a.statut, a.scoreGlobal || 0),
      score: a.scoreGlobal || 0,
      date: a.date ? a.date.toISOString().split("T")[0] : "N/A",
    }));

    res.json(formatted);
  } catch (error) {
    console.error("\u274c Recent Scans Error:", error);
    res.status(500).json({ message: "Erreur recent scans", error: error.message });
  }
};

// GET /api/dashboard/alerts
const getAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    // Only return UNREAD alerts for the dashboard
    const alerts = await Alert.find({ userId, read: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("vulnerabiliteId", "type endpoint niveauRisque severity")
      .lean();

    const normSev = (s) => {
      const r = String(s || "").toLowerCase();
      if (r === "critical" || r === "critique") return "Critique";
      if (r === "high" || r === "\u00e9lev\u00e9" || r === "eleve") return "\u00c9lev\u00e9";
      if (r === "medium" || r === "moyen") return "Moyen";
      if (r === "low" || r === "faible") return "Faible";
      return "Info";
    };

    const total = await Alert.countDocuments({ userId, read: false });

    const formatted = alerts.map(a => {
      const vuln = a.vulnerabiliteId || {};
      return {
        _id: a._id,
        title: a.title || vuln.type || "Alerte",
        message: a.message || "",
        level: normSev(a.level),
        severity: normSev(a.level),
        endpoint: vuln.endpoint || a.urlCible || "",
        type: vuln.type || a.title || "Alerte",
        createdAt: a.createdAt,
        read: a.read,
      };
    });

    res.json({ alerts: formatted, total, hasMore: total > limit });
  } catch (error) {
    console.error("❌ Alerts Error:", error);
    res.status(500).json({ message: "Erreur alerts", error: error.message });
  }
};

// GET /api/dashboard/score-evolution
const getScoreEvolution = async (req, res) => {
  try {
    const userId = req.user.id;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const audits = await Audit.find({
      userId,
      date: { $gte: since },
    })
      .sort({ date: 1 })
      .select("date scoreGlobal");

    const byDate = {};
    audits.forEach(a => {
      const date = a.date ? a.date.toISOString().split("T")[0] : null;
      if (!date) return;
      
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(a.scoreGlobal || 0);
    });

    const evolution = Object.entries(byDate).map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }));

    console.log("📈 Score Evolution:", evolution.length);

    res.json(evolution);
  } catch (error) {
    console.error("❌ Score Evolution Error:", error);
    res.status(500).json({ 
      message: "Erreur score evolution", 
      error: error.message 
    });
  }
};

module.exports = {
  getStats,
  getRecentScans,
  getAlerts,
  getScoreEvolution,
};