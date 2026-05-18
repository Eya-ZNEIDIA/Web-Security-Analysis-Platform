const Vulnerabilite = require("../models/Vulnerabilite");

// POST — créer une vuln (liée au user)
exports.createVulnerabilites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { auditId, vulnerabilites } = req.body;

    const audit = await Audit.findOne({ _id: auditId, userId });
    if (!audit) return res.status(404).json({ message: "Audit non trouvé pour cet utilisateur" });

    const vulnsToCreate = vulnerabilites.map(v => ({
      ...v,
      userId,
      auditId,
    }));

    const createdVulns = await Vulnerabilite.insertMany(vulnsToCreate);

    res.status(201).json(createdVulns);
  } catch (err) {
    res.status(500).json({ message: "Erreur création vulnérabilités", error: err.message });
  }
};

// GET — admin seulement: toutes les vulns de tous les users
exports.getAllVulnerabilites = async (req, res) => {
  try {
    const vulns = await Vulnerabilite.find().populate("userId", "name email");
    res.json(vulns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET — user: seulement ses propres vulns
exports.getMyVulnerabilites = async (req, res) => {
  try {
    const vulns = await Vulnerabilite.find({ userId: req.user.id });
    res.json(vulns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};