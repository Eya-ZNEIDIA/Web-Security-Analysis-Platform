const mongoose = require("mongoose");

const URLSchema = new mongoose.Schema({
  adresse: { type: String, required: true }
});

module.exports = mongoose.model("URL", URLSchema);
