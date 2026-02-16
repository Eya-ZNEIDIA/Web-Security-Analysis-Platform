const Audit = require("../models/Audit");
const URL = require("../models/Url");

exports.createAudit = async (req, res) => {
  try {
    const { adresse } = req.body;

    const url = await URL.create({ adresse });

    const audit = await Audit.create({
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
    const audits = await Audit.find()
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

    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
