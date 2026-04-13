const express = require("express");
const router = express.Router();

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const Audit = require("../models/Audit");
const Rapport = require("../models/Rapport");
const Vulnerabilite = require("../models/Vulnerabilite");

router.get(
  "/admin/audits/:auditId/report",
  protect,
  authorizeRoles(["admin"]),
  async (req, res) => {
    try {
      const audit = await Audit.findById(req.params.auditId).lean();
      if (!audit) return res.status(404).json({ message: "Audit introuvable" });

      const report = audit.rapport ? await Rapport.findById(audit.rapport).lean() : null;
      if (!report) return res.status(404).json({ message: "Rapport introuvable" });

      const vulns = await Vulnerabilite.find({ _id: { $in: report.vulnerabilites || [] } })
        .sort({ createdAt: -1 })
        .lean();

      // Format compatible avec ton generatePDF()
      const payload = {
        url: audit.urlCible,
        generatedAt: audit.date,
        score: Number(report.scoreGlobal ?? 0),
        ssl: /^https:\/\//i.test(String(audit.urlCible || "")),
        sslExpiry: "N/A",
        redirect: true,
        server: "Unknown",
        headers: [], // si tu ne les stockes pas en DB
        vulns: vulns.map((v, i) => ({
          id: `V-${String(i + 1).padStart(3, "0")}`,
          severity: v.niveauRisque || "Moyen",
          title: v.type || "—",
          description: v.description || "",
          fix: v.recommandation || "",
        })),
        recommendations: vulns.map((v) => v.recommandation).filter(Boolean),
      };

      res.json(payload);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur récupération rapport" });
    }
  }
);

module.exports = router;