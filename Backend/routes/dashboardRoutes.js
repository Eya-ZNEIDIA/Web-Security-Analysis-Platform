const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const dashboardController = require("../controllers/DashboardController");

router.use(protect); 

router.get("/stats", dashboardController.getStats);
router.get("/recent-scans", dashboardController.getRecentScans);
router.get("/alerts", dashboardController.getAlerts);
router.get("/score-evolution", dashboardController.getScoreEvolution);

module.exports = router;