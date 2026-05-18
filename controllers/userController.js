const User = require("../models/User");
const Audit = require("../models/Audit");
const Vulnerabilite = require("../models/Vulnerabilite");
const Rapport = require("../models/Rapport");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// ✅ AJOUT: imports manquants (sinon deleteUtilisateur plante)
const Settings = require("../models/Settings"); // adapte le chemin si différent
const NotificationService = require("../services/NotificationService"); // adapte le chemin si différent

// ================= GET USER PROFILE =================
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-mdp");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.json({
      profile: {
        firstName: user.prenom || "",
        lastName: user.nom || "",
        email: user.email || "",
        company: user.profile?.company || "",
        phone: user.profile?.phone || "",
        bio: user.profile?.bio || "",
      },

      notifications: user.notifications || {
        emailScanComplete: true,
        emailCritical: true,
        emailWeekly: false,
        inAppAlerts: true,
        inAppScanDone: true,
      },

      security: {
        mfa: user.security?.mfa || false,
        sessionAlert: user.security?.sessionAlert ?? true,
      },

      prefs: user.prefs || {
        defaultScanMode: "standard",
        autoDownloadReport: false,
        language: "fr",
        dateFormat: "DD/MM/YYYY",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ================= UPDATE USER PROFILE =================
exports.updateProfileAndPassword = async (req, res) => {
  try {
    const { profile, notifications, security, prefs } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // 🔹 Changer password si demandé
    if (security?.currentPwd && security?.newPwd) {
      const match = await bcrypt.compare(security.currentPwd, user.mdp);
      if (!match) return res.status(400).json({ message: "Mot de passe actuel incorrect" });

      user.mdp = security.newPwd; // pre("save") fera hash automatiquement si tu l'as dans le schema
    }

    // 🔹 Update security settings
    if (security) {
      user.security.mfa = security.mfa ?? user.security.mfa;
      user.security.sessionAlert = security.sessionAlert ?? user.security.sessionAlert;
    }

    // 🔹 Update profile
    if (profile) {
      user.prenom = profile.firstName ?? user.prenom;
      user.nom = profile.lastName ?? user.nom;
      user.email = profile.email ?? user.email;

      user.profile.company = profile.company ?? user.profile.company;
      user.profile.phone = profile.phone ?? user.profile.phone;
      user.profile.bio = profile.bio ?? user.profile.bio;
    }

    // 🔹 Update notifications
    if (notifications) {
      user.notifications = { ...user.notifications, ...notifications };
    }

    // 🔹 Update prefs
    if (prefs) {
      user.prefs = { ...user.prefs, ...prefs };
    }

    await user.save();

    res.json({
      success: true,
      message: "Profil et mot de passe mis à jour avec succès",
      user: {
        _id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        image: user.image,
        profile: user.profile,
        notifications: user.notifications,
        security: user.security,
        prefs: user.prefs,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || "Erreur serveur" });
  }
};

// ================= GET ALL USERS =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("-mdp")
      .sort({ createdAt: -1 })
      .lean();

    const auditAgg = await Audit.aggregate([
      { $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);

    const auditCountMap = new Map(auditAgg.map((x) => [String(x._id), x.count]));

    const enrichedUsers = users.map((u) => ({
      ...u,
      auditCount: auditCountMap.get(String(u._id)) || 0,
    }));

    return res.json(enrichedUsers);
  } catch (err) {
    return res.status(500).json({
      message: "Erreur lors de la récupération des utilisateurs",
      error: err.message,
    });
  }
};
exports.getAuditReportAdmin = async (req, res) => {
  try {
    const auditId = req.params.id;

    const audit = await Audit.findById(auditId).lean();
    if (!audit) return res.status(404).json({ message: "Audit introuvable" });

    if (!audit.rapport) {
      return res.status(404).json({ message: "Aucun rapport associé à cet audit" });
    }

    const rapport = await Rapport.findById(audit.rapport)
      .populate("vulnerabilites")
      .lean();

    if (!rapport) return res.status(404).json({ message: "Rapport introuvable" });

    const url = audit.urlCible || "—";
    const vulns = Array.isArray(rapport.vulnerabilites) ? rapport.vulnerabilites : [];

    const normalizeSeverity = (s) => {
      const r = String(s || "").trim().toLowerCase();
      if (r === "critical" || r === "critique") return "Critique";
      if (r === "high" || r === "élevé" || r === "eleve" || r === "éleve") return "Élevé";
      if (r === "medium" || r === "moyen") return "Moyen";
      if (r === "low" || r === "faible") return "Faible";
      if (r === "info" || r === "information") return "Info";
      return "Inconnu";
    };

    const report = {
      _id: rapport._id,
      reportId: rapport._id,
      url,
      generatedAt: audit.date,
      score: Number(rapport.scoreGlobal ?? audit.scoreGlobal ?? 0) || 0,
      ssl: /^https:\/\//i.test(String(url)),
      sslExpiry: "N/A",
      redirect: true,
      server: audit.server || "Unknown",
      headers: Array.isArray(audit.headers)
        ? audit.headers.map((h) => ({
            name: h?.name || h?.header || h?.key || "Header",
            present: Boolean(h?.present ?? h?.ok ?? true),
            critical: Boolean(h?.critical ?? false),
          }))
        : [],
      vulns: vulns.map((v, idx) => ({
        id: v?._id ? `V-${String(idx + 1).padStart(3, "0")}` : String(idx + 1),
        severity: normalizeSeverity(v?.severity || v?.niveauRisque),
        title: v?.type || v?.titre || "Vulnérabilité",
        description: v?.description || v?.technical_details || "—",
        endpoint: v?.endpoint || "",
        method: v?.method || "GET",
        parameter: v?.parameter || "",
        payload: v?.payload || "",
        encoding: v?.encoding || "raw",
        evidence: v?.evidence || "",
        impact: v?.business_impact || v?.impact || "",
        reproduction_steps: Array.isArray(v?.reproduction_steps) ? v.reproduction_steps : [],
        recommendation: v?.fix_recommendation || v?.recommandation || "—",
        owasp: v?.owasp_category || "",
        cwe: v?.cwe || "",
        cvss_score: Number(v?.cvss_score) || 0,
        cvss_vector: v?.cvss_vector || "",
        technique: v?.technique || "",
        technical_details: v?.technical_details || "",
        business_impact: v?.business_impact || "",
        code_example: v?.secure_code_example || v?.secure_fix_example || "",
        headers_to_add: v?.headers_to_add || {},
        ai_confidence: typeof v?.ai_confidence === "number" ? v.ai_confidence : null,
        detection_source: v?.detection_source || "rule",
        is_true_positive: v?.is_true_positive !== false,
        response_status: v?.response_status || null,
        http_response_snippet: v?.http_response_snippet || "",
      })),
      recommendations: Array.from(
        new Set(
          vulns
            .map((v) => (v?.fix_recommendation || v?.recommandation || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 20),
      // ─── Rapport IA enrichi ─────────────────────
      reportMeta: {
        durationMs: rapport.durationMs || 0,
        ai_model: rapport.ai_model || "",
        ai_prompt_version: rapport.ai_prompt_version || "",
        executive_summary: rapport.executive_summary || "",
        risk_breakdown: rapport.risk_breakdown || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        statistics: rapport.statistics || {},
        endpoints_tested: rapport.endpoints_tested || [],
        families_tested: rapport.families_tested || [],
        timeline: (rapport.timeline || []).map((t) => ({
          ts: t.ts,
          phase: t.phase,
          level: t.level,
          message: t.message,
        })),
      },
    };

    return res.json(report);
  } catch (err) {
    console.error("getAuditReportAdmin error:", err);
    return res.status(500).json({ message: "Erreur récupération report", error: err.message });
  }
};
// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: "Email déjà utilisé" });
    }

    // ⚠️ tu calcules hashedPassword mais tu ne l'utilises pas dans ton code initial
    // Je garde ton comportement mais voici la bonne version:
    const hashedPassword = await bcrypt.hash(mdp, 10);

    const user = await User.create({
      nom,
      prenom,
      email,
      mdp,
      role: "user",
      image: req.file ? req.file.filename : null,
    });

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  const { email, mdp, rememberMe } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Identifiants invalides" });

    const isMatch = await bcrypt.compare(mdp, user.mdp);
    if (!isMatch) return res.status(400).json({ success: false, message: "Identifiants invalides" });

    const tokenDuration = rememberMe ? "7d" : "1h";
    const token = jwt.sign({ id: user._id, role: user.role, nom: user.nom }, process.env.JWT_SECRET, {
      expiresIn: tokenDuration,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        image: user.image,
        profile: user.profile,
        notifications: user.notifications,
        security: user.security,
        prefs: user.prefs,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};

// ================= UPLOAD IMAGE =================
exports.uploadImage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: "Non authentifié" });
    if (!req.file) return res.status(400).json({ success: false, message: "Aucun fichier reçu" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

    user.image = req.file.filename;
    await user.save();

    res.json({ success: true, message: "Image mise à jour", image: user.image });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};

// ================= ADMIN: ADD USER =================
exports.ajouterUtilisateur = async (req, res) => {
  try {
    const { nom, prenom, email, mdp, role } = req.body;

    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(mdp, 10);
    const nouvelUser = await User.create({
      nom,
      prenom,
      email,
      mdp: hashedPassword,
      role: role || "user",
    });

    res.status(201).json({
      success: true,
      user: { id: nouvelUser._id, nom: nouvelUser.nom, email: nouvelUser.email, role: nouvelUser.role },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: "Erreur d’ajout", error: err.message });
  }
};

// ================= GET USER BY ID =================
exports.getUtilisateurById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-mdp");
    if (!user) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Erreur récupération utilisateur", error: err.message });
  }
};

// ================= UPDATE USER =================
exports.updateUtilisateur = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.mdp) data.mdp = await bcrypt.hash(data.mdp, 10);

    const updatedUser = await User.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    }).select("-mdp");

    if (!updatedUser) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(400).json({ success: false, message: "Erreur de mise à jour", error: err.message });
  }
};

// ================= DELETE USER =================
exports.deleteUtilisateur = async (req, res) => {
  try {
    const deletedUser = await User.findById(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

    await User.findByIdAndDelete(req.params.id);

    // ✅ notif admin: utilisateur supprimé (si tu as Settings + NotificationService)
    try {
      const settings = await Settings.findOne({ key: "global" }).lean();
      if (settings?.notifications?.inAppAlert) {
        await NotificationService.createAdminNotification({
          type: "user_deleted",
          level: "warning",
          title: "Utilisateur supprimé",
          message: `Suppression: ${deletedUser.email}`,
          user: deletedUser.id,
          actor: req.user?._id || req.user?.id,
        });
      }
    } catch (e) {
      console.error("Notif user_deleted failed:", e.message);
    }

    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur de suppression", error: err.message });
  }
};

// ================= ADMIN: GET ALL AUDITS =================
// ✅ AJOUT: manquait -> causait "handler must be a function"
exports.getAllAuditsAdmin = async (req, res) => {
  try {
    const audits = await Audit.find({})
      .sort({ date: -1 })
      .populate({
        path: "rapport",
        populate: {
          path: "vulnerabilites",
          select:
            "niveauRisque severity type description recommandation fix_recommendation endpoint method parameter payload evidence cvss_score owasp_category cwe business_impact reproduction_steps secure_code_example ai_confidence detection_source is_true_positive response_status http_response_snippet",
        },
      })
      .lean();

    res.json(audits);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération des audits", error: err.message });
  }
};

// ================= ADMIN DASHBOARD =================
// Reject ObjectIds, UUIDs, bare hashes — only keep real URLs/domains
const _isValidUrl = (v) => {
  const s = String(v || "").trim();
  if (!s || s === "—") return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return false;
  if (/^[a-f0-9]{32}$/i.test(s)) return false;
  if (/^[a-f0-9-]{36}$/i.test(s)) return false;
  if (/^[a-f0-9]{40,}$/i.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (!/\./.test(s.replace(/^https?:\/\//i, ""))) return false;
  return true;
};

exports.getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

    const [usersCount, auditsCount, auditsInProgress] = await Promise.all([
      User.countDocuments(),
      Audit.countDocuments(),
      Audit.countDocuments({ statut: "En cours" }),
    ]);

    // ---- derniers audits (fetch more, filter valid URLs, dedup) ----
    const recentAuditsDocs = await Audit.find({})
      .sort({ date: -1 })
      .limit(30)
      .populate({
        path: "rapport",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    // ⚠️ on calcule un risk simple depuis les vulnérabilités (max severity)
    const riskRank = { Critique: 4, "Élevé": 3, Moyen: 2, Faible: 1, Inconnu: 0 };
    const normalizeRiskLabel = (risk) => {
      const r = (risk ?? "").toString().trim().toLowerCase();
      if (r === "critical" || r === "critique") return "Critique";
      if (r === "high" || r === "élevé" || r === "eleve" || r === "éleve") return "Élevé";
      if (r === "medium" || r === "moyen") return "Moyen";
      if (r === "low" || r === "faible") return "Faible";
      return "Inconnu";
    };

    const computeAuditRisk = (audit) => {
      const vulns = audit?.rapport?.vulnerabilites || [];
      if (!Array.isArray(vulns) || vulns.length === 0) return "Inconnu";
      let best = "Inconnu";
      for (const v of vulns) {
        const r = normalizeRiskLabel(v?.niveauRisque);
        if (riskRank[r] > riskRank[best]) best = r;
      }
      return best;
    };

    // Filter valid URLs and dedup by hostname
    const seen = new Map();
    for (const a of recentAuditsDocs) {
      const rawUrl = a.urlCible || a.site || a.targetUrl || "";
      if (!_isValidUrl(rawUrl)) continue;
      const host = rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
      if (seen.has(host)) continue;
      seen.set(host, a);
    }
    const dedupedRecent = Array.from(seen.values()).slice(0, 8);

    const recentAudits = dedupedRecent.map((a) => ({
      site: a.urlCible || a.site || a.targetUrl || "—",
      score: a?.rapport?.scoreGlobal ?? a?.scoreGlobal ?? 0,
      risk: computeAuditRisk(a),
      status: a.statut || "—",
      date: a.date,
    }));

    // ---- weekly audits (7 derniers jours) ----
    const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

    const weeklyAudits = await Audit.find({ date: { $gte: sevenDaysAgo } })
      .populate({
        path: "rapport",
        select: "vulnerabilites",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    const weeklyMap = new Map();
    for (const a of weeklyAudits) {
      if (!a.date) continue;
      const key = new Date(a.date).toISOString().slice(0, 10);
      const vulnsCount = a?.rapport?.vulnerabilites?.length || 0;
      const prev = weeklyMap.get(key) || { audits: 0, vulns: 0 };
      weeklyMap.set(key, { audits: prev.audits + 1, vulns: prev.vulns + vulnsCount });
    }

    const dayLabelsFr = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const auditsWeekly = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const item = weeklyMap.get(key) || { audits: 0, vulns: 0 };
      auditsWeekly.push({ day: dayLabelsFr[d.getDay()], audits: item.audits, vulns: item.vulns });
    }

    // ---- auditsMonthly: 12 derniers mois ----
    const startMonth = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));

    const monthlyAgg = await Audit.aggregate([
      { $match: { date: { $gte: startMonth } } },
      {
        $group: {
          _id: { y: { $year: "$date" }, m: { $month: "$date" } },
          value: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]);

    const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
    const mapMonthly = new Map(monthlyAgg.map((x) => [monthKey(x._id.y, x._id.m), x.value]));

    const auditsMonthly = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = monthKey(y, m);

      auditsMonthly.push({
        month: d.toLocaleDateString("fr-FR", { month: "short" }),
        value: mapMonthly.get(key) || 0,
      });
    }

    // ---- riskDistribution + alerts (total vulnérabilités) ----
    // On compte depuis les audits (rapport.vulnerabilites). Pas parfait mais cohérent avec ton modèle.
    const auditsForRisk = await Audit.find({ rapport: { $ne: null } })
      .select("rapport")
      .populate({
        path: "rapport",
        select: "vulnerabilites",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    const riskCounts = { Critique: 0, "Élevé": 0, Moyen: 0, Faible: 0, Inconnu: 0 };
    let alerts = 0;

    for (const a of auditsForRisk) {
      const vulns = a?.rapport?.vulnerabilites;
      if (!Array.isArray(vulns)) continue;
      alerts += vulns.length;
      for (const v of vulns) {
        const r = normalizeRiskLabel(v?.niveauRisque);
        riskCounts[r] = (riskCounts[r] || 0) + 1;
      }
    }

    const riskDistribution = Object.entries(riskCounts)
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0);

    return res.json({
      users: usersCount,
      audits: auditsCount,
      alerts, // ✅ total vulnérabilités réel
      auditsInProgress,
      auditsWeekly,
      auditsMonthly, // ✅ 12 mois
      riskDistribution, // ✅ distribution réelle
      recentAudits, // ✅ risk calculé
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur récupération dashboard", error: err.message });
  }
};