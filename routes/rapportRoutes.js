const express = require("express");
const router = express.Router();

const rapportController = require("../controllers/rapportController");
const { protect } = require("../middlewares/authMiddleware");

router.get("/", protect, rapportController.getAllRapports);
router.get("/:id", protect, rapportController.getRapportById);

// Routes PDF
router.get("/:id/download-pdf", protect, rapportController.generatePDF);
router.get("/:id/pdf-url", protect, rapportController.generatePDFUrl);

module.exports = router;
