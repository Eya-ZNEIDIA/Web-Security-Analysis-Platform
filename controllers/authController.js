const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// 🔹 Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({ message: "Si cet email existe, un lien a été envoyé" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    // ✅ Port correct (Vite = 5173, pas 3000)
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // ✅ Avec subject + html
    await sendEmail(
      user.email,
      "Réinitialisation de votre mot de passe",
      `Lien de réinitialisation : ${resetUrl}`,
      `
        <div style="font-family:sans-serif; padding:24px; background:#f9f9f9;">
          <h2 style="color:#16a34a;">🔐 Réinitialisation du mot de passe</h2>
          <p>Bonjour <strong>${user.prenom}</strong>,</p>
          <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe.</p>
          <a href="${resetUrl}"
             style="display:inline-block; margin-top:16px; padding:12px 24px;
                    background:#16a34a; color:white; border-radius:8px; text-decoration:none;">
            Réinitialiser mon mot de passe
          </a>
          <p style="margin-top:16px; color:#888; font-size:12px;">
            Ce lien expire dans 15 minutes.<br/>
            Si vous n'avez pas fait cette demande, ignorez cet email.
          </p>
        </div>
      `
    );

    res.json({ success: true, message: "Email envoyé" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// 🔹 Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré" });
    }

    // ✅ "mdp" et non "password" (ton modèle User utilise mdp)
    user.mdp = req.body.password;  // le pre("save") hashera automatiquement
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Mot de passe mis à jour avec succès" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};