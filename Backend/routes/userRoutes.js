const express = require("express");
const router = express.Router();
const controller = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
router.post("/register",upload.single("image"), controller.register);
router.post("/login", controller.login);

router.put("/upload-image",protect,upload.single("image"),controller.uploadImage);
router.post("/", protect, controller.ajouterUtilisateur);
router.get("/:id", protect, controller.getUtilisateurById);
router.put("/:id", protect, controller.updateUtilisateur);
router.delete("/:id", protect, controller.deleteUtilisateur);




module.exports = router;
