const mongoose = require("mongoose");

const ReponseSchema = new mongoose.Schema({
  codeStatus: Number,
  headers: { type: Map, of: String },
  body: String,
  requete: { type: mongoose.Schema.Types.ObjectId, ref: "Requete" }
});

module.exports = mongoose.model("Reponse", ReponseSchema);
