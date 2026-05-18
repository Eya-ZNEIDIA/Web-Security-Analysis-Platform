

const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Authorization header manquant ou mal formaté");
    return res.status(401).json({ message: "Accès non autorisé" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ debug
    console.log("TOKEN décodé :", decoded);

    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    console.log("REQ.USER dans middleware protect :", req.user);

    next();
  } catch (error) {
    console.log("Token invalide :", error.message);
    res.status(401).json({ message: "Token invalide" });
  }
};



exports.authorizeRoles = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Accès refusé"
      });
    }
    next();
  };
};