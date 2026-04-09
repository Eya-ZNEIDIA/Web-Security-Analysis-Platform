const Audit = require("../models/Audit");
const URL = require("../models/Url");

exports.createAudit = async (req, res) => {
  try {
    const { adresse } = req.body;

    // ✅ Récupérer le userId du middleware protect
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const url = await URL.create({ adresse });

    const audit = await Audit.create({
      userId: req.user.id,  // ✅ Ajout du userId
      date: new Date(),
      statut: "en cours",
      urlCible: url._id
    });

    res.status(201).json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllAudits = async (req, res) => {
  try {
    const audits = await Audit.find({ userId: req.user.id })  // ✅ Filtre par userId
      .populate("urlCible")
      .populate("rapport");

    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAuditById = async (req, res) => {
  try {
    const audit = await Audit.findById(req.params.id)
      .populate("urlCible")
      .populate("rapport");

    if (!audit) return res.status(404).json({ message: "Audit not found" });
    
    // ✅ Vérifier que l'utilisateur a accès à cet audit
    if (audit.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};