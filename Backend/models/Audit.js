const mongoose = require("mongoose");

const AuditSchema = new mongoose.Schema({
  date: Date,
  statut: String,
  urlCible: { type: mongoose.Schema.Types.ObjectId, ref: "URL" },
  requetes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Requete" }],
  reponses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Reponse" }],
  rapport: { type: mongoose.Schema.Types.ObjectId, ref: "Rapport" }
});

module.exports = mongoose.model("Audit", AuditSchema);
