const Audit = require("../models/Audit");
const Vulnerabilite = require("../models/Vulnerabilite");

exports.getDashboardStats = async (req, res) => {
  try {
    const totalScans = await Audit.countDocuments({ user: req.user.id });

    const totalVulns = await Vulnerabilite.countDocuments({ user: req.user.id });

    const securedSites = await Audit.countDocuments({
      user: req.user.id,
      score: { $gte: 75 },
    });

    const avg = await Audit.aggregate([
      { $match: { user: req.user.id } },
      { $group: { _id: null, avgScore: { $avg: "$score" } } },
    ]);

    const avgScore = avg[0]?.avgScore?.toFixed(0) || 0;

    res.json({
      totalScans,
      totalVulns,
      securedSites,
      avgScore,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};