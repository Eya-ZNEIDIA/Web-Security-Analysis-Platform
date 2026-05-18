const Rapport = require("../models/Rapport");
const Audit = require("../models/Audit");
const PDFGeneratorService = require("../services/PDFGeneratorService");
const path = require("path");
const fs = require("fs");

exports.getRapportById = async (req, res) => {
  try {
    const rapport = await Rapport.findById(req.params.id)
      .populate("vulnerabilites");

    if (!rapport)
      return res.status(404).json({ message: "Rapport not found" });

    res.json(rapport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRapports = async (req, res) => {
  try {
    const rapports = await Rapport.find().populate("vulnerabilites");
    res.json(rapports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Génère et télécharge un rapport PDF complet avec support multi-langue
 */
exports.generatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const language = (req.query.language || req.body.language || 'en').toLowerCase();

    // Valider la langue
    if (!['fr', 'en'].includes(language)) {
      return res.status(400).json({ message: "Language must be 'fr' or 'en'" });
    }

    // Récupérer le rapport avec toutes les données
    const rapport = await Rapport.findById(id)
      .populate("vulnerabilites")
      .populate("auditId");

    if (!rapport) {
      return res.status(404).json({ message: "Rapport non trouvé" });
    }

    // Récupérer l'audit associé
    const audit = await Audit.findById(rapport.auditId);
    if (!audit) {
      return res.status(404).json({ message: "Audit non trouvé" });
    }

    // Créer le répertoire de sortie s'il n'existe pas
    const uploadsDir = path.join(__dirname, "../uploads/pdfs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Générer le nom du fichier avec la langue
    const timestamp = Date.now();
    const langSuffix = language === 'fr' ? '-FR' : '-EN';
    const fileName = `rapport-audit-${timestamp}${langSuffix}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Préparer les données complètes de l'audit
    const auditDataComplete = {
      urlCible: audit.urlCible,
      dateAudit: audit.date,
      statut: audit.statut,
      intensity: audit.intensity,
      headers: audit.headers || [],
      headersRaw: audit.headersRaw || {},
      durationMs: audit.durationMs || 0,
      totalRequests: audit.totalRequests || 0,
      totalEndpoints: audit.totalEndpoints || 0,
      totalVulnerabilities: audit.totalVulnerabilities || (rapport.vulnerabilites?.length || 0),
      scoreGlobal: rapport.scoreGlobal || 0,
      userId: audit.userId
    };

    // Préparer les données du rapport
    const reportDataComplete = {
      id: rapport._id,
      scoreGlobal: rapport.scoreGlobal || 0,
      durationMs: rapport.durationMs || 0,
      dateDebut: rapport.dateDebut || audit.date,
      dateFin: rapport.dateFin || new Date(),
      ai_model: rapport.ai_model,
      ai_prompt_version: rapport.ai_prompt_version,
      risk_breakdown: rapport.risk_breakdown,
      statistics: rapport.statistics,
      timeline: rapport.timeline,
      recommendations: rapport.recommendations,
      createdAt: rapport.createdAt,
      updatedAt: rapport.updatedAt
    };

    // Générer le PDF
    await PDFGeneratorService.generateFullReport(
      auditDataComplete,
      reportDataComplete,
      rapport.vulnerabilites || [],
      filePath,
      language
    );

    // Vérifier que le fichier a été créé
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ message: "Erreur lors de la génération du PDF" });
    }

    // Envoyer le fichier avec les headers appropriés
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Erreur lors du téléchargement:", err);
      }
      // Supprimer le fichier après envoi (après 30 secondes)
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error("Erreur lors de la suppression du fichier:", e);
          }
        }
      }, 30000);
    });
  } catch (err) {
    console.error("Erreur lors de la génération du PDF:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Génère et retourne l'URL du PDF généré (multi-langue)
 */
exports.generatePDFUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const language = (req.query.language || req.body.language || 'en').toLowerCase();

    // Valider la langue
    if (!['fr', 'en'].includes(language)) {
      return res.status(400).json({ message: "Language must be 'fr' or 'en'" });
    }

    // Récupérer le rapport avec toutes les données
    const rapport = await Rapport.findById(id)
      .populate("vulnerabilites")
      .populate("auditId");

    if (!rapport) {
      return res.status(404).json({ message: "Rapport non trouvé" });
    }

    // Récupérer l'audit associé
    const audit = await Audit.findById(rapport.auditId);
    if (!audit) {
      return res.status(404).json({ message: "Audit non trouvé" });
    }

    // Créer le répertoire de sortie s'il n'existe pas
    const uploadsDir = path.join(__dirname, "../uploads/pdfs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Générer le nom du fichier avec la langue
    const timestamp = Date.now();
    const langSuffix = language === 'fr' ? '-FR' : '-EN';
    const fileName = `rapport-audit-${timestamp}${langSuffix}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Préparer les données complètes de l'audit
    const auditDataComplete = {
      urlCible: audit.urlCible,
      dateAudit: audit.date,
      statut: audit.statut,
      intensity: audit.intensity,
      headers: audit.headers || [],
      headersRaw: audit.headersRaw || {},
      durationMs: audit.durationMs || 0,
      totalRequests: audit.totalRequests || 0,
      totalEndpoints: audit.totalEndpoints || 0,
      totalVulnerabilities: audit.totalVulnerabilities || (rapport.vulnerabilites?.length || 0),
      scoreGlobal: rapport.scoreGlobal || 0,
      userId: audit.userId
    };

    // Préparer les données du rapport
    const reportDataComplete = {
      id: rapport._id,
      scoreGlobal: rapport.scoreGlobal || 0,
      durationMs: rapport.durationMs || 0,
      dateDebut: rapport.dateDebut || audit.date,
      dateFin: rapport.dateFin || new Date(),
      ai_model: rapport.ai_model,
      ai_prompt_version: rapport.ai_prompt_version,
      risk_breakdown: rapport.risk_breakdown,
      statistics: rapport.statistics,
      timeline: rapport.timeline,
      recommendations: rapport.recommendations,
      createdAt: rapport.createdAt,
      updatedAt: rapport.updatedAt
    };

    // Générer le PDF
    await PDFGeneratorService.generateFullReport(
      auditDataComplete,
      reportDataComplete,
      rapport.vulnerabilites || [],
      filePath,
      language
    );

    // Vérifier que le fichier a été créé
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ message: "Erreur lors de la génération du PDF" });
    }

    // Retourner l'URL du PDF
    const pdfUrl = `/uploads/pdfs/${fileName}`;
    res.json({
      success: true,
      pdfUrl,
      fileName,
      language,
      timestamp,
      expiresIn: 3600000, // 1 heure en millisecondes
      message: language === 'fr' ? 'PDF généré avec succès' : 'PDF generated successfully'
    });

    // Supprimer le fichier après 1 heure
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Erreur lors de la suppression du fichier:", e);
        }
      }
    }, 3600000);
  } catch (err) {
    console.error("Erreur lors de la génération du PDF:", err);
    res.status(500).json({ error: err.message });
  }
};
