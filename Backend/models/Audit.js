const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  nomAudit: { type: String, required: true }, 
  url: { type: String, required: true }, 
  dateAudit: { type: Date, default: Date.now },
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  statut: { type: String, enum: ["en_cours", "termine", "échoué"], default: "en_cours" },
  resultats: {
    vulnérabilites: [{ 
      nom: String,
      gravite: { type: String, enum: ["faible", "moyenne", "élevée"] },
      description: String
    }],
    recommandations: [String]
  },
  metrics: {
    tempsReponse: Number, 
    taillePage: Number, 
    nombreRequetes: Number
  }
}, { timestamps: true });

module.exports = mongoose.model("Audit", auditSchema);
