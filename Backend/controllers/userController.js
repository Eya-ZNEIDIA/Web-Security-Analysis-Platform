const User = require("../models/User");
const Audit = require("../models/Audit");
const Vulnerabilite = require("../models/Vulnerabilite");
const Rapport = require("../models/Rapport");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

      user.mdp = security.newPwd; // pre("save") fera hash automatiquement
    }

    // 🔹 Update security settings (mfa, sessionAlert)
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

    // 🔐 save → pre("save") hash le mot de passe
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
        updatedAt: user.updatedAt
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || "Erreur serveur" });
  }
};
// ================= GET ALL USERS =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-mdp");
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur récupération utilisateurs", error: error.message });
  }
};

// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: "Email déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(mdp, 10);
    const user = await User.create({
      nom,
      prenom,
      email,
      mdp ,
      role: "user",
      image: req.file ? req.file.filename : null
    });

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
        image: user.image
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  const { email, mdp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Identifiants invalides" });

    const isMatch = await bcrypt.compare(mdp, user.mdp);
    if (!isMatch) return res.status(400).json({ success: false, message: "Identifiants invalides" });

    const token = jwt.sign({ id: user._id, role: user.role, nom: user.nom }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({
      success: true,
      token,
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};

// ================= UPLOAD IMAGE =================
exports.uploadImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
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

    if (await User.findOne({ email })) return res.status(400).json({ success: false, message: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(mdp, 10);
    const nouvelUser = await User.create({ nom, prenom, email, mdp: hashedPassword, role: role || "user" });

    res.status(201).json({ success: true, user: { id: nouvelUser._id, nom: nouvelUser.nom, email: nouvelUser.email, role: nouvelUser.role } });
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

    const updatedUser = await User.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).select("-mdp");
    if (!updatedUser) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(400).json({ success: false, message: "Erreur de mise à jour", error: err.message });
  }
};

// ================= DELETE USER =================
exports.deleteUtilisateur = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

    res.json({ success: true, message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Erreur de suppression", error: err.message });
  }
};

// ================= ADMIN DASHBOARD =================
exports.getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    const normalizeRisk = (s) => (s ?? "").toString().trim().toLowerCase();
    const normalizeLabel = (risk) => {
      const r = normalizeRisk(risk);
      if (r === "critical" || r === "critique") return "Critique";
      if (r === "high" || ["élevé","eleve","éleve","haut"].includes(r)) return "Élevé";
      if (r === "medium" || r === "moyen") return "Moyen";
      if (r === "low" || r === "faible" || r === "bas") return "Faible";
      return "Inconnu";
    };

    const severityRank = { Critique: 4, "Élevé": 3, Moyen: 2, Faible: 1, Inconnu: 0 };

    const getAuditRisk = (audit) => {
      const vulns = audit?.rapport?.vulnerabilites || [];
      if (!vulns.length) return "Faible";

      let maxRank = 0, maxLabel = "Faible";
      for (const v of vulns) {
        const label = normalizeLabel(v?.niveauRisque);
        const rank = severityRank[label] ?? 0;
        if (rank > maxRank) { maxRank = rank; maxLabel = label; }
      }
      return maxRank === 0 ? "Inconnu" : maxLabel;
    };

    const [usersCount, auditsCount, auditsInProgress] = await Promise.all([
      User.countDocuments(),
      Audit.countDocuments(),
      Audit.countDocuments({ statut: "En cours" }),
    ]);

    const recentAuditsDocs = await Audit.find({})
      .sort({ date: -1 })
      .limit(6)
      .populate({ path: "rapport", populate: { path: "vulnerabilites", select: "niveauRisque" } })
      .lean();

    const normalizeScore = (s) => {
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return n >= 0 && n <= 10 ? Math.round(n * 10) : Math.max(0, Math.min(100, Math.round(n)));
    };

    const recentAudits = recentAuditsDocs.map(a => ({
      site: a.urlCible || "—",
      score: normalizeScore(a?.rapport?.scoreGlobal),
      risk: getAuditRisk(a),
      status: a.statut || "—",
      date: a.date ? new Date(a.date).toISOString().slice(0,10) : "—"
    }));

    // Weekly activity
    const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6*24*60*60*1000));
    const weeklyAudits = await Audit.find({ date: { $gte: sevenDaysAgo } })
      .populate({ path: "rapport", select: "vulnerabilites", populate: { path: "vulnerabilites", select: "niveauRisque" } })
      .lean();

    const weeklyMap = new Map();
    for (const a of weeklyAudits) {
      if (!a.date) continue;
      const key = new Date(a.date).toISOString().slice(0,10);
      const vulnsCount = a?.rapport?.vulnerabilites?.length || 0;
      const prev = weeklyMap.get(key) || { audits: 0, vulns: 0 };
      weeklyMap.set(key, { audits: prev.audits + 1, vulns: prev.vulns + vulnsCount });
    }

    const dayLabelsFr = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
    const auditsWeekly = Array.from({length:7}, (_,i) => {
      const d = new Date(sevenDaysAgo.getTime() + i*24*60*60*1000);
      const key = d.toISOString().slice(0,10);
      const item = weeklyMap.get(key) || { audits:0, vulns:0 };
      return { day: dayLabelsFr[d.getDay()], audits: item.audits, vulns: item.vulns };
    });

    // Monthly audits last 12 months
    const start12Months = new Date(now); start12Months.setMonth(start12Months.getMonth()-11); start12Months.setDate(1); start12Months.setHours(0,0,0,0);
    const auditsMonthlyAgg = await Audit.aggregate([
      { $match: { date: { $gte: start12Months } } },
      { $group: { _id: { $dateToString: { format:"%Y-%m", date:"$date" } }, value:{ $sum:1 } } },
      { $sort: { _id:1 } }
    ]);
    const monthlyMap = new Map(auditsMonthlyAgg.map(x=>[x._id,x.value]));
    const monthNamesFr = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
    const auditsMonthly = Array.from({length:12},(_,i)=>{
      const d = new Date(start12Months); d.setMonth(d.getMonth()+i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      return { month: monthNamesFr[d.getMonth()], value: monthlyMap.get(key)||0 };
    });

    // Risk distribution
    const auditsForRisk = await Audit.find({ date: { $gte: start12Months }, rapport:{ $ne:null } })
      .select("rapport")
      .populate({ path:"rapport", select:"vulnerabilites", populate:{ path:"vulnerabilites", select:"niveauRisque" } })
      .lean();

    const counts = {}; let totalVulns=0;
    for(const a of auditsForRisk){
      const vulns = a?.rapport?.vulnerabilites || [];
      for(const v of vulns){
        const k = normalizeLabel(v?.niveauRisque);
        if(k==="Inconnu") continue;
        counts[k] = (counts[k]||0)+1;
        totalVulns++;
      }
    }
    const riskDistribution = Object.entries(counts).map(([name,count])=>({name,value:totalVulns?Math.round(count*100/totalVulns):0}));

    res.json({
      users: usersCount,
      audits: auditsCount,
      alerts: totalVulns,
      auditsInProgress,
      auditsWeekly,
      auditsMonthly,
      riskDistribution,
      recentAudits
    });

  } catch(err){
    res.status(500).json({ success:false, message:"Erreur récupération dashboard", error: err.message });
  }
};