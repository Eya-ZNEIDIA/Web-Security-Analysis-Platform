const mongoose = require("mongoose");
const VulnerabiliteSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },  // ✅
  auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit" }, // ✅ تربطها بالـ audit
  type: String,
  niveauRisque: String,
  description: String,
  recommandation: String,
  priorite: String,
  category: String, // pour radar chart
  score: Number,  
});
module.exports = mongoose.model("Vulnerabilite", VulnerabiliteSchema);