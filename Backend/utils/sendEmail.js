const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, html = null) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "zneidiaeya@gmail.com",
        pass: "rgtf jjuz sjbn pcbr"
      }
    });

    // ✅ Capturer info + envoyer html si disponible
    const info = await transporter.sendMail({
      from: '"SecureScan" <zneidiaeya@gmail.com>',
      to,
      subject,
      text,                        // fallback texte brut
      html: html || text,          // ✅ version HTML si fournie
    });

    console.log("Email envoyé :", info.response);
  } catch (err) {
    console.error("Erreur nodemailer :", err);
  }
};

module.exports = sendEmail;