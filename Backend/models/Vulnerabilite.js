const mongoose = require("mongoose");

const VulnerabiliteSchema = new mongoose.Schema({
  type: String,
  niveauRisque: String,
  description: String,
  recommandation: String,
  priorite: String
});

module.exports = mongoose.model("Vulnerabilite", VulnerabiliteSchema);
