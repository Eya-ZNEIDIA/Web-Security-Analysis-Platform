const express = require("express");
const router = express.Router();

const vulnerabiliteController = require("../controllers/vulnerabiliteController");
const { protect } = require("../middlewares/authMiddleware");
router.post("/", protect, vulnerabiliteController.createVulnerabilites);
router.get("/", protect, vulnerabiliteController.getAllVulnerabilites);
router.get("/me", protect, vulnerabiliteController.getMyVulnerabilites);   
module.exports = router;
