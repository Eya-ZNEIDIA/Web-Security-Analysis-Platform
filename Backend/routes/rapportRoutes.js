const express = require("express");
const router = express.Router();

const rapportController = require("../controllers/rapportController");
const { protect } = require("../middlewares/authMiddleware");
router.get("/", protect, rapportController.getAllRapports);
router.get("/:id", protect, rapportController.getRapportById);

module.exports = router;
