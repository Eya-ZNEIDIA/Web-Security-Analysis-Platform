const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, html = null) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `"SecureScan" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || text,
  });

  return info;
};

module.exports = sendEmail;