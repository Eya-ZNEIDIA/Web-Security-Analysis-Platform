const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
nom: { type: String, required: true },
prenom: String,
email: { type: String, unique: true },
mdp: String,
role: { type: String, enum: ["admin", "user"], default: "user" },
 image: { type: String },
}, { timestamps: true });
userSchema.pre("save", async function() {
  if (!this.isModified("mdp")) return ;
  const salt = await bcrypt.genSalt(10);
  this.mdp = await bcrypt.hash(this.mdp, salt);
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.mdp);
};

module.exports = mongoose.model("User", userSchema);
