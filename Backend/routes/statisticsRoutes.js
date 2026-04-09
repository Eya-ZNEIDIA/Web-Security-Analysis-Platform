// routes/statisticsRoutes.js
const express = require("express");
const router = express.Router();
const { getStatisticsTotals, getStatisticsCharts } = require("../controllers/statisticsController");
const { protect } = require("../middlewares/authMiddleware"); // attention au nom du dossier "middlewares"

// Route pour les totaux simples
router.get("/totals", protect, getStatisticsTotals);

// Route pour les statistiques complètes (graphiques)
router.get("/full", protect, getStatisticsCharts);

module.exports = router;