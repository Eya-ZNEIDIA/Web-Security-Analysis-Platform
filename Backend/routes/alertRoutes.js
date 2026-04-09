const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const Alert = require("../models/Alert");

// ✅ Récupérer toutes les alertes de l'utilisateur
router.get("/", protect, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.id })
      .populate("auditId")
      .populate("vulnerabiliteId")
      .sort({ createdAt: -1 }); // Les plus récentes en premier

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Récupérer les alertes non lues
router.get("/unread", protect, async (req, res) => {
  try {
    const unreadAlerts = await Alert.find({ 
      userId: req.user.id,
      read: false 
    }).sort({ createdAt: -1 });

    res.json(unreadAlerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Marquer une alerte comme lue
router.put("/:id/read", protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!alert) return res.status(404).json({ message: "Alerte non trouvée" });

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Supprimer une alerte
router.delete("/:id", protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);

    if (!alert) return res.status(404).json({ message: "Alerte non trouvée" });

    res.json({ message: "Alerte supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;