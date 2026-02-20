const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    const userExiste = await User.findOne({ email });
    if (userExiste) {
      return res.status(400).json({ message: "Email déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(mdp, 10);

    const user = await User.create({
      nom,
      prenom,
      email,
      mdp: hashedPassword,
      role: "user",
      image: req.file ? req.file.filename : null
    });

    res.status(201).json({
      _id: user._id,
      nom: user.nom,
      email: user.email,
      image: user.image,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




exports.login = async (req, res) => {
  const { email, mdp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const isMatch = await bcrypt.compare(mdp, user.mdp);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const token = jwt.sign(
      { id: user._id, role: "user", nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        nom: user.nom,
        email: user.email,
        role: "user"
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.uploadImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    user.image = req.file.filename;
    await user.save();

    res.json({
      message: "Image mise à jour",
      image: user.image
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.ajouterUtilisateur = async (req, res) => {
  try {
    const { nom, prenom, email, mdp } = req.body;

    const userExiste = await User.findOne({ email });
    if (userExiste) {
      return res.status(400).json({ message: "Email déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(mdp, 10);

    const nouvelUser = await User.create({
      nom,
      prenom,
      email,
      mdp: hashedPassword,
      role: "user"
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


// ================= GET USER =================
exports.getUtilisateurById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-mdp");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération", error: err.message });
  }
};


// ================= UPDATE USER =================
exports.updateUtilisateur = async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.mdp) {
      data.mdp = await bcrypt.hash(data.mdp, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    ).select("-mdp");

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json(updatedUser);

  } catch (err) {
    res.status(400).json({ message: "Erreur de mise à jour", error: err.message });
  }
};


// ================= DELETE USER =================
exports.deleteUtilisateur = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({ message: "Utilisateur supprimé avec succès" });

  } catch (err) {
    res.status(500).json({ message: "Erreur de suppression", error: err.message });
  }
};
