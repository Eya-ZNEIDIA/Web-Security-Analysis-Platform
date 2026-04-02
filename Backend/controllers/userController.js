const User = require("../models/User");
const Audit = require("../models/Audit"); // si tu as un modèle Audit
const Vulnerabilite = require("../models/Vulnerabilite");

const Rapport = require("../models/Rapport"); // adapte le chemin/nom exact
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// ================= GET ALL USERS =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-mdp");

    res.json(users);

  } catch (error) {
    res.status(500).json({
      message: "Erreur récupération utilisateurs",
      error: error.message
    });
  }
};
// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    const userExiste = await User.findOne({ email });
    if (userExiste) return res.status(400).json({ message: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(mdp, 10);

    const user = await User.create({
      nom,
      prenom,
      email,
      mdp: hashedPassword,
      role: req.body.role || "user",
      image: req.file ? req.file.filename : null
    });

    res.status(201).json({
      _id: user._id,
      nom: user.nom,
      email: user.email,
      role: user.role,
      image: user.image,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  const { email, mdp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Identifiants invalides" });

    const isMatch = await bcrypt.compare(mdp, user.mdp);
    if (!isMatch) return res.status(400).json({ message: "Identifiants invalides" });

    const token = jwt.sign(
      { id: user._id, role: user.role, nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UPLOAD IMAGE =================
exports.uploadImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    user.image = req.file.filename;
    await user.save();

    res.json({ message: "Image mise à jour", image: user.image });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= ADD USER (ADMIN) =================
exports.ajouterUtilisateur = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    if (await User.findOne({ email })) 
      return res.status(400).json({ message: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(mdp, 10);

    const nouvelUser = await User.create({
      nom,
      prenom,
      email,
      mdp: hashedPassword,
      role: req.body.role || "user"
    });

    res.status(201).json({
      id: nouvelUser._id,
      nom: nouvelUser.nom,
      email: nouvelUser.email,
      role: nouvelUser.role
    });
  } catch (err) {
    res.status(400).json({ message: "Erreur d’ajout", error: err.message });
  }
};

// ================= GET USER BY ID =================
exports.getUtilisateurById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-mdp");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération", error: err.message });
  }
};

// ================= UPDATE USER =================
exports.updateUtilisateur = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.mdp) data.mdp = await bcrypt.hash(data.mdp, 10);

    const updatedUser = await User.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).select("-mdp");
    if (!updatedUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: "Erreur de mise à jour", error: err.message });
  }
};

// ================= DELETE USER =================
exports.deleteUtilisateur = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur de suppression", error: err.message });
  }
};
exports.getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    // --------- Helpers risque (FR + EN) ----------
    const normalizeRisk = (s) => (s ?? "").toString().trim().toLowerCase();

    const normalizeLabel = (risk) => {
      const r = normalizeRisk(risk);

      if (r === "critical" || r === "critique") return "Critique";
      if (r === "high" || r === "élevé" || r === "eleve" || r === "éleve" || r === "haut") return "Élevé";
      if (r === "medium" || r === "moyen") return "Moyen";
      if (r === "low" || r === "faible" || r === "bas") return "Faible";

      return "Inconnu";
    };

    const severityRank = { Critique: 4, "Élevé": 3, Moyen: 2, Faible: 1, Inconnu: 0 };

    const getAuditRisk = (audit) => {
      const vulns = audit?.rapport?.vulnerabilites || [];
      if (!vulns.length) return "Faible";

      let maxRank = 0;
      let maxLabel = "Faible";

      for (const v of vulns) {
        const label = normalizeLabel(v?.niveauRisque);
        const rank = severityRank[label] ?? 0;

        if (rank > maxRank) {
          maxRank = rank;
          maxLabel = label;
        }
      }
      return maxRank === 0 ? "Inconnu" : maxLabel;
    };

    // ---------------- Totaux ----------------
    const [usersCount, auditsCount, auditsInProgress] = await Promise.all([
      User.countDocuments(),
      Audit.countDocuments(),
      Audit.countDocuments({ statut: "En cours" }),
    ]);

    // ---------------- Derniers audits ----------------
    const recentAuditsDocs = await Audit.find({})
      .sort({ date: -1 })
      .limit(6)
      .populate({
        path: "rapport",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    // debug (tu peux enlever après)
    console.log(
      recentAuditsDocs.map((a) => ({
        urlCible: a.urlCible,
        hasRapport: !!a.rapport,
        vulnsCount: a?.rapport?.vulnerabilites?.length || 0,
        risks: (a?.rapport?.vulnerabilites || []).map((v) => v.niveauRisque),
      }))
    );

const normalizeScore = (s) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // si score sur 10
  if (n >= 0 && n <= 10) return Math.round(n * 10);
  // clamp 0..100
  return Math.max(0, Math.min(100, Math.round(n)));
};

const recentAudits = recentAuditsDocs.map((a) => ({
  site: a.urlCible || "—",
  score: normalizeScore(a?.rapport?.scoreGlobal),
  risk: getAuditRisk(a), // <-- Critique/Élevé/...
  status: a.statut || "—",
  date: a.date ? new Date(a.date).toISOString().slice(0, 10) : "—",
}));

    // ---------------- Activité hebdomadaire ----------------
    const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

    const weeklyAudits = await Audit.find({ date: { $gte: sevenDaysAgo } })
      .populate({
        path: "rapport",
        select: "vulnerabilites",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    const weeklyMap = new Map(); // YYYY-MM-DD -> { audits, vulns }
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

      auditsWeekly.push({
        day: dayLabelsFr[d.getDay()],
        audits: item.audits,
        vulns: item.vulns,
      });
    }

    // ---------------- Audits par mois (12 derniers mois) ----------------
    const start12Months = new Date(now);
    start12Months.setMonth(start12Months.getMonth() - 11);
    start12Months.setDate(1);
    start12Months.setHours(0, 0, 0, 0);

    const auditsMonthlyAgg = await Audit.aggregate([
      { $match: { date: { $gte: start12Months } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyMap = new Map(auditsMonthlyAgg.map((x) => [x._id, x.value]));
    const monthNamesFr = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    const auditsMonthly = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start12Months);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      auditsMonthly.push({
        month: monthNamesFr[d.getMonth()],
        value: monthlyMap.get(key) || 0,
      });
    }

    // ---------------- Risk distribution (Pie) ----------------
    // Calcule sur audits des 12 derniers mois (via rapports)
    const auditsForRisk = await Audit.find({ date: { $gte: start12Months }, rapport: { $ne: null } })
      .select("rapport")
      .populate({
        path: "rapport",
        select: "vulnerabilites",
        populate: { path: "vulnerabilites", select: "niveauRisque" },
      })
      .lean();

    const counts = {}; // "Critique"/"Élevé"/... -> count
    let totalVulns = 0;

    for (const a of auditsForRisk) {
      const vulns = a?.rapport?.vulnerabilites || [];
      for (const v of vulns) {
        const k = normalizeLabel(v?.niveauRisque); // <-- normalisation ici
        if (k === "Inconnu") continue; // optionnel
        counts[k] = (counts[k] || 0) + 1;
        totalVulns++;
      }
    }

    const riskDistribution = Object.entries(counts).map(([name, count]) => ({
      name, // Critique/Élevé/Moyen/Faible
      value: totalVulns ? Math.round((count * 100) / totalVulns) : 0,
    }));

    const alertsCount = totalVulns;

    return res.json({
      users: usersCount,
      audits: auditsCount,
      alerts: alertsCount,
      auditsInProgress,
      auditsWeekly,
      auditsMonthly,
      riskDistribution,
      recentAudits,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur récupération dashboard", error: err.message });
  }
};