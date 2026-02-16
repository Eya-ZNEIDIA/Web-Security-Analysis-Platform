const Rapport = require("../models/Rapport");

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
