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
const settingsRoutes = require("./routes/settingsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");  
const adminSettingsRoutes = require("./routes/adminSettingsRoutes");
const chatRoutes = require("./routes/chatRoutes");

dotenv.config();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL || ""
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
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
app.use("/api/chat", chatRoutes);
app.use("/api", settingsRoutes);
app.use("/api", notificationRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);

app.post("/api/audit/launch", protect, async (req, res) => {
  const { targetUrl, intensity } = req.body;
  const userId = req.user.id;
  
  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
    }

    // ✅ Validation de l'URL avant lancement
    const { validateUrl } = require("./utils/urlValidator");
    const validation = validateUrl(targetUrl);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.error || "URL invalide" });
    }

    const result = await AuditService.launchAudit({ 
      targetUrl: validation.cleanUrl, 
      intensity: intensity || "medium",
      userId
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