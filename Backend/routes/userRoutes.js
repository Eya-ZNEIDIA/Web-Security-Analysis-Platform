const express = require("express");
const router = express.Router();
const controller = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

// ✅ Routes sans paramètres — EN PREMIER
router.get("/", protect, controller.getAllUsers);
router.post("/register", upload.single("image"), controller.register);
router.post("/login", controller.login);
router.get("/admin/dashboard", protect, authorizeRoles(["admin"]), controller.getAdminDashboard);
router.put("/upload-image", protect, upload.single("image"), controller.uploadImage); // ✅ Avant /:id
router.post("/ajouter", protect, authorizeRoles(["admin"]), controller.ajouterUtilisateur);

// ✅ Routes avec paramètres — EN DERNIER
router.get("/profile/:id", protect, controller.getUserProfile);
router.put("/:id/profile", protect, controller.updateProfileAndPassword);
router.delete("/:id", protect, authorizeRoles(["admin"]), controller.deleteUtilisateur);
router.get("/:id", protect, controller.getUtilisateurById);
router.put("/:id", protect, controller.updateUtilisateur);

module.exports = router;