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

// GET /api/dashboard/recent-scans
const getRecentScans = async (req, res) => {
  try {
    const userId = req.user.id;

    const audits = await Audit.find({ userId })
      .sort({ date: -1 })
      .limit(10)
      .select("urlCible statut date scoreGlobal");

    const formatted = audits.map(a => ({
      _id: a._id,
      url: a.urlCible || "N/A",
      statut: a.statut,
      score: a.scoreGlobal || 0,
      date: a.date ? a.date.toISOString().split("T")[0] : "N/A",
    }));

    console.log("📋 Recent Scans:", formatted.length);

    res.json(formatted);
  } catch (error) {
    console.error("❌ Recent Scans Error:", error);
    res.status(500).json({ 
      message: "Erreur recent scans", 
      error: error.message 
    });
  }
};

// GET /api/dashboard/alerts
const getAlerts = async (req, res) => {
  try {
    const userId = req.user.id;

    const alerts = await Alert.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("message level title createdAt read");

    const formatted = alerts.map(a => ({
      _id: a._id,
      message: a.message || a.title,
      level: a.level,
      createdAt: a.createdAt,
      read: a.read
    }));

    console.log("🚨 Alerts:", formatted.length);

    res.json(formatted);
  } catch (error) {
    console.error("❌ Alerts Error:", error);
    res.status(500).json({ 
      message: "Erreur alerts", 
      error: error.message 
    });
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