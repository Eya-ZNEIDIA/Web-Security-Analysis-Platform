const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  nom: String,
  prenom: String,
  email: { type: String, unique: true },
  mdp: String,
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
