const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // 🔹 Infos principales
  nom: { type: String, required: true },
  prenom: { type: String, default: "" },
  email: { type: String, required: true, unique: true },
  mdp: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  image: { type: String, default: "" },
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
  // 🔹 Profil
  profile: {
    company: { type: String, default: "" },
    phone: { type: String, default: "" },
    bio: { type: String, default: "" }
  },

  // 🔹 Notifications
  notifications: {
    emailScanComplete: { type: Boolean, default: true },
    emailCritical: { type: Boolean, default: true },
    emailWeekly: { type: Boolean, default: false },
    inAppAlerts: { type: Boolean, default: true },
    inAppScanDone: { type: Boolean, default: true }
  },

  // 🔹 Sécurité
  security: {
    mfa: { type: Boolean, default: false },
    sessionAlert: { type: Boolean, default: true }
  },

  // 🔹 Préférences
  prefs: {
    defaultScanMode: { type: String, default: "standard" },
    autoDownloadReport: { type: Boolean, default: false },
    language: { type: String, default: "fr" },
    dateFormat: { type: String, default: "DD/MM/YYYY" }
  }

}, { timestamps: true });


// 🔐 Hash password avant save
userSchema.pre("save", async function () {
  if (!this.isModified("mdp")) return;

  const salt = await bcrypt.genSalt(10);
  this.mdp = await bcrypt.hash(this.mdp, salt);
});


// 🔐 Comparer mot de passe
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.mdp);
};

module.exports = mongoose.model("User", userSchema);