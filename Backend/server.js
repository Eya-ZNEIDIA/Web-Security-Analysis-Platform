const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const aiRoutes = require("./routes/aiRoutes");
const AuditService = require("./services/AuditService");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { protect } = require("./middlewares/authMiddleware"); 
const authRoutes = require("./routes/authRoutes");
const Alert = require("./models/Alert"); 
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connexion BDD
connectDB();

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/vulnerabilites", require("./routes/vulnerabiliteRoutes"));
app.use("/api/rapports", require("./routes/rapportRoutes"));
app.use("/api/audits", require("./routes/auditRoutes"));
app.use("/api/ai", aiRoutes);
app.use("/api/stats", require("./routes/statisticsRoutes"));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/alerts", require("./routes/alertRoutes"));
// ✅ CORRIGÉ : Route d'audit avec authentification et récupération du userId
app.post("/api/audit/launch", protect, async (req, res) => {
  const { targetUrl, intensity } = req.body;
  const userId = req.user.id; // ✅ Récupère l'ID de l'utilisateur depuis le middleware
  
  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
    }

    const result = await AuditService.launchAudit({ 
      targetUrl, 
      intensity: intensity || "medium",
      userId // ✅ Passe le userId au service
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur audit launch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});