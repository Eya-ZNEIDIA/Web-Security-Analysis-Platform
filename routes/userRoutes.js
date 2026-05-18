// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();

const controller = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

// Public
router.post("/register", upload.single("image"), controller.register);
router.post("/login", controller.login);

// Admin
router.get("/admin/dashboard", protect, authorizeRoles(["admin"]), controller.getAdminDashboard);
router.get("/admin/users", protect, authorizeRoles(["admin"]), controller.getAllUsers);
router.get("/admin/audits", protect, authorizeRoles(["admin"]), controller.getAllAuditsAdmin);
router.post("/ajouter", protect, authorizeRoles(["admin"]), controller.ajouterUtilisateur);
router.delete("/:id", protect, authorizeRoles(["admin"]), controller.deleteUtilisateur);
router.get(
  "/admin/audits/:id/report",
  protect,
  authorizeRoles(["admin"]),
  controller.getAuditReportAdmin
);

// User (auth required)
router.put("/upload-image", protect, upload.single("image"), controller.uploadImage);
router.get("/profile/:id", protect, controller.getUserProfile);
router.put("/:id/profile", protect, controller.updateProfileAndPassword);
router.get("/:id", protect, controller.getUtilisateurById);
router.put("/:id", protect, controller.updateUtilisateur);

module.exports = router;