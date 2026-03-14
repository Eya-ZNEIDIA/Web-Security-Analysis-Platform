const express = require("express");
const router = express.Router();
const controller = require("../controllers/aiController");

router.post("/analyze-security", controller.analyzeResults);

module.exports = router;