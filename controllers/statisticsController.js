// controllers/statisticsController.js
const mongoose = require("mongoose");
const Audit = require("../models/Audit");
const Vulnerabilite = require("../models/Vulnerabilite");

// Helper — convertit req.user.id en ObjectId proprement
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// ─────────────────────────────────────────────
// 1️⃣  Totaux pour les cartes du dashboard
// ─────────────────────────────────────────────
exports.getStatisticsTotals = async (req, res) => {
  try {
    const userId = toObjectId(req.user.id);

    const [totalScans, totalVulns, securedSites, avgAgg] = await Promise.all([
      Audit.countDocuments({ userId }),
      Vulnerabilite.countDocuments({ userId }),
      Audit.countDocuments({ userId, scoreGlobal: { $gte: 75 } }),
      Audit.aggregate([
        { $match: { userId } },
        { $group: { _id: null, avgScore: { $avg: "$scoreGlobal" } } },
      ]),
    ]);

    const avgScore = avgAgg[0]?.avgScore ? Math.round(avgAgg[0].avgScore) : 0;
    const successRate =
      totalScans > 0 ? Math.round((securedSites / totalScans) * 100) : 0;

    res.json({ totalScans, totalVulns, securedSites, avgScore, successRate });
  } catch (err) {
    console.error("Erreur getStatisticsTotals:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ─────────────────────────────────────────────
// 2️⃣  Statistiques détaillées pour les graphiques
// ─────────────────────────────────────────────
exports.getStatisticsCharts = async (req, res) => {
  try {
    const userId = toObjectId(req.user.id);

    const MONTH_SWITCH = {
      branches: [
        { case: { $eq: ["$_id", 1] }, then: "Jan" },
        { case: { $eq: ["$_id", 2] }, then: "Fév" },
        { case: { $eq: ["$_id", 3] }, then: "Mar" },
        { case: { $eq: ["$_id", 4] }, then: "Avr" },
        { case: { $eq: ["$_id", 5] }, then: "Mai" },
        { case: { $eq: ["$_id", 6] }, then: "Juin" },
        { case: { $eq: ["$_id", 7] }, then: "Juil" },
        { case: { $eq: ["$_id", 8] }, then: "Août" },
        { case: { $eq: ["$_id", 9] }, then: "Sep" },
        { case: { $eq: ["$_id", 10] }, then: "Oct" },
        { case: { $eq: ["$_id", 11] }, then: "Nov" },
        { case: { $eq: ["$_id", 12] }, then: "Déc" },
      ],
      default: "Autre",
    };

    const [
      scoreHistory,
      vulnsByType,
      riskDistribAgg,
      radarAgg,
      scansPerMonth,
      topSitesRaw,
      totalScans,
      totalVulns,
      securedSites,
      avgScoreAgg,
    ] = await Promise.all([
      // Score moyen par mois (LineChart)
      Audit.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: { $month: "$date" },
            avgScore: { $avg: "$scoreGlobal" },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            month: { $switch: MONTH_SWITCH },
            score: { $round: ["$avgScore", 0] },
          },
        },
      ]),

      // Vulnérabilités par type (BarChart horizontal)
      Vulnerabilite.aggregate([
        { $match: { userId } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ]),

      // Distribution des risques (PieChart)
      Vulnerabilite.aggregate([
        { $match: { userId } },
        { $group: { _id: "$niveauRisque", value: { $sum: 1 } } },
        { $project: { _id: 0, name: "$_id", value: 1 } },
      ]),

      // Radar — score moyen par catégorie
      Vulnerabilite.aggregate([
        { $match: { userId } },
        { $group: { _id: "$category", score: { $avg: "$score" } } },
        { $project: { _id: 0, subject: "$_id", score: { $round: ["$score", 0] } } },
      ]),

      // Scans par mois (BarChart)
      Audit.aggregate([
        { $match: { userId } },
        { $group: { _id: { $month: "$date" }, scans: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            month: { $switch: MONTH_SWITCH },
            scans: 1,
          },
        },
      ]),

      // Top 5 sites — on calcule aussi le score du mois précédent pour le trend
      Audit.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: "$urlCible",
            scans: { $sum: 1 },
            avgScore: { $avg: "$scoreGlobal" },
            lastScore: { $last: "$scoreGlobal" },
            prevScore: { $first: "$scoreGlobal" }, // approximation du trend
          },
        },
        { $sort: { scans: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            site: "$_id",
            scans: 1,
            avgScore: { $round: ["$avgScore", 0] },
            lastScore: { $round: ["$lastScore", 0] },
            prevScore: { $round: ["$prevScore", 0] },
          },
        },
      ]),

      // Totaux
      Audit.countDocuments({ userId }),
      Vulnerabilite.countDocuments({ userId }),
      Audit.countDocuments({ userId, scoreGlobal: { $gte: 75 } }),
      Audit.aggregate([
        { $match: { userId } },
        { $group: { _id: null, avg: { $avg: "$scoreGlobal" } } },
      ]),
    ]);

    // Couleurs fixes par niveau de risque
    const RISK_COLORS = {
      Faible: "#16a34a",
      Moyen: "#eab308",
      Élevé: "#f97316",
      Critique: "#ef4444",
    };
    const riskDistrib = riskDistribAgg.map((d) => ({
      ...d,
      color: RISK_COLORS[d.name] || "#16a34a",
    }));

    // Calcul du trend pour chaque site (différence lastScore - prevScore)
    const topSites = topSitesRaw.map((s) => {
      const diff = s.lastScore - s.prevScore;
      const trend =
        diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "0";
      return {
        site: s.site,
        scans: s.scans,
        avgScore: s.avgScore,
        trend,
      };
    });

    const avgScore = avgScoreAgg[0]?.avg ? Math.round(avgScoreAgg[0].avg) : 0;
    const successRate =
      totalScans > 0 ? Math.round((securedSites / totalScans) * 100) : 0;

    res.json({
      scoreHistory,
      vulnsByType,
      riskDistrib,
      radarData: radarAgg,
      scansPerMonth,
      topSites,
      totalScans,
      totalVulns,
      avgScore,
      successRate,
    });
  } catch (err) {
    console.error("Erreur getStatisticsCharts:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};