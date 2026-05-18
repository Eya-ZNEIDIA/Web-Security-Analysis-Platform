const express = require("express");
const router = express.Router();

const auditController = require("../controllers/auditController");
const { protect } = require("../middlewares/authMiddleware");
router.post("/", protect, auditController.createAudit);
router.get("/", protect, auditController.getAllAudits);
router.get("/:id", protect, auditController.getAuditById);
router.put("/:id/complete", protect, auditController.completeAudit);
module.exports = router;
