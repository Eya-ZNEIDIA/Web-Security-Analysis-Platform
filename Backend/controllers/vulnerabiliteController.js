const Vulnerabilite = require("../models/Vulnerabilite");

exports.createVulnerabilite = async (req, res) => {
  try {
    const vuln = await Vulnerabilite.create(req.body);
    res.status(201).json(vuln);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllVulnerabilites = async (req, res) => {
  try {
    const vulns = await Vulnerabilite.find();
    res.json(vulns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
