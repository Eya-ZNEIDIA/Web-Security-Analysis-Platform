const mongoose = require("mongoose");

const RequeteSchema = new mongoose.Schema({
  methode: { type: String, required: true },
  headers: { type: Map, of: String },
  body: String,
  url: { type: mongoose.Schema.Types.ObjectId, ref: "URL" }
});

module.exports = mongoose.model("Requete", RequeteSchema);
