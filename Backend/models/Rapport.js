const mongoose = require("mongoose");

const RapportSchema = new mongoose.Schema({
  dateGeneration: Date,
  resume: String,
  scoreGlobal: Number,
  vulnerabilites: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Vulnerabilite" }
  ]
});

module.exports = mongoose.model("Rapport", RapportSchema);
