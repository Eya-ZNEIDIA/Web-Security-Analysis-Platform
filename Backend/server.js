const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const aiRoutes = require("./routes/aiRoutes");
const AuditService = require("./services/AuditService");

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
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/ai", aiRoutes)
app.use("/api/stats", require("./routes/statsRoutes"));
app.post("/api/audit/launch", async (req, res) => {
  const { targetUrl, intensity } = req.body; 

  try {
    const result = await AuditService.launchAudit({ targetUrl, intensity });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Lancer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});

