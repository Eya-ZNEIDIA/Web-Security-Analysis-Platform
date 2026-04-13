const Audit = require("../models/Audit");
const URL = require("../models/Url");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

exports.createAudit = async (req, res) => {
  try {
    const { adresse } = req.body;

    // ✅ Récupérer le userId du middleware protect
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const url = await URL.create({ adresse });

    const audit = await Audit.create({
      userId: req.user.id,
      date: new Date(),
      statut: "en cours",
      urlCible: url._id,
    });

    res.status(201).json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllAudits = async (req, res) => {
  try {
    const audits = await Audit.find({ userId: req.user.id })
      .populate("urlCible")
      .populate("rapport");

    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAuditById = async (req, res) => {
  try {
    const audit = await Audit.findById(req.params.id)
      .populate("urlCible")
      .populate("rapport");

    if (!audit) return res.status(404).json({ message: "Audit not found" });

    // ✅ Vérifier que l'utilisateur a accès à cet audit
    if (audit.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Appeler cette route quand l'analyse est terminée (score/rapport prêt)
 * PUT /api/audits/:id/complete
 * body: { scoreGlobal?: number }
 */
exports.completeAudit = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const audit = await Audit.findById(req.params.id).populate("urlCible");
    if (!audit) return res.status(404).json({ message: "Audit not found" });

    if (audit.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // 1) marquer terminé
    audit.statut = "terminé";

    // optionnel: si ton modèle Audit a un champ scoreGlobal
    if (typeof req.body?.scoreGlobal === "number") {
      audit.scoreGlobal = req.body.scoreGlobal;
    }

    await audit.save();

    // 2) envoyer email si activé
    const u = await User.findById(req.user.id).select("email prenom nom notifications");
    if (u?.email && u?.notifications?.emailScanComplete) {
      const name = `${u.prenom || ""} ${u.nom || ""}`.trim() || "Utilisateur";
      const target = audit?.urlCible?.adresse || audit?.urlCible?.toString() || "—";
      const score = typeof audit.scoreGlobal === "number" ? audit.scoreGlobal : req.body?.scoreGlobal ?? 0;

      const subject = "Scan terminé — SecureAudit";
      const text =
        `Bonjour ${name},\n\n` +
        `Votre scan est terminé.\n` +
        `Cible: ${target}\n` +
        `Score: ${score}/100\n\n` +
        `— SecureAudit`;

      const appUrl = process.env.APP_URL || "http://localhost:5173";
      const reportUrl = `${appUrl}/audits/${audit._id}`;

      const html = `
        <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
          <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#16a34a,#059669);color:#fff;padding:16px 18px">
              <div style="font-size:12px;letter-spacing:1.5px;opacity:.9">SECUREAUDIT</div>
              <div style="font-size:18px;font-weight:700;margin-top:6px">Scan terminé</div>
            </div>
            <div style="padding:16px 18px;color:#111827">
              <p style="margin:0 0 10px">Bonjour <b>${name}</b>,</p>
              <p style="margin:0 0 14px;color:#374151">Votre analyse de sécurité est terminée.</p>
              <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#f9fafb">
                <div style="font-size:12px;color:#6b7280">Cible</div>
                <div style="font-size:14px;font-weight:700;margin-bottom:8px">${target}</div>
                <div style="font-size:12px;color:#6b7280">Score</div>
                <div style="font-size:24px;font-weight:800;color:#16a34a">${Number(score)}/100</div>
              </div>
              <div style="margin-top:14px">
                <a href="${reportUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700;font-size:13px">
                  Ouvrir le rapport
                </a>
              </div>
              <p style="margin:14px 0 0;color:#6b7280;font-size:12px">
                Vous pouvez désactiver ces emails dans Paramètres → Notifications.
              </p>
            </div>
          </div>
        </div>
      `;

      // ✅ ne bloque pas la réponse si l’email échoue
      sendEmail(u.email, subject, text, html).catch((e) =>
        console.error("Email scan complete failed:", e.message || e)
      );
    }

    res.json({ success: true, audit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};