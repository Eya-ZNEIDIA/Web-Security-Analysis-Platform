const mongoose = require("mongoose");

const AuditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔹 obligatoire
  date: { type: Date, default: Date.now },
  statut: String,
  urlCible: String,
  requetes: Array,
  reponses: Array,
  rapport: { type: mongoose.Schema.Types.ObjectId, ref: "Rapport" },
  scoreGlobal: { type: Number, default: 0 },
  headers: { type: Array, default: [] },
});

module.exports = mongoose.model("Audit", AuditSchema);