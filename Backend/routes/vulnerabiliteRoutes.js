const express = require("express");
const router = express.Router();

const vulnerabiliteController = require("../controllers/vulnerabiliteController");
const { protect } = require("../middlewares/authMiddleware");
router.post("/", protect, vulnerabiliteController.createVulnerabilite);
router.get("/", protect, vulnerabiliteController.getAllVulnerabilites);

module.exports = router;
