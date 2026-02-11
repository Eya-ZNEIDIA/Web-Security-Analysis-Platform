const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema({
  adresse: { type: String, required: true, unique: true }, 
  dateAjout: { type: Date, default: Date.now },            
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  statut: { type: String, enum: ["active", "inactive", "bloquee"], default: "active" },
  audits: [{ type: mongoose.Schema.Types.ObjectId, ref: "Audit" }]   
}, { timestamps: true });

module.exports = mongoose.model("Url", urlSchema);
