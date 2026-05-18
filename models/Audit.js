const mongoose = require("mongoose");

const AuditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  statut: String,
  urlCible: String,
  requetes: Array,
  reponses: Array,
  rapport: { type: mongoose.Schema.Types.ObjectId, ref: "Rapport" },
  scoreGlobal: { type: Number, default: 0 },
  headers: { type: Array, default: [] },

  // ─── Extended metrics ───────────────────────────────────────
  durationMs: { type: Number, default: 0 },
  totalRequests: { type: Number, default: 0 },
  totalEndpoints: { type: Number, default: 0 },
  totalVulnerabilities: { type: Number, default: 0 },
  intensity: { type: String, default: "medium" }
});

module.exports = mongoose.model("Audit", AuditSchema);