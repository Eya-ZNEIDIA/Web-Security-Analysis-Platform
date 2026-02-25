const axios = require("axios");

class ValidationService {

  static async validateURL(url) {
    try {
      new URL(url);
    } catch {
      throw new Error("Format URL invalide");
    }
  }

  static async verifyAuthorization(url) {
    try {
      await axios.head(url);
    } catch {
      throw new Error("Cible inaccessible ou non autorisée");
    }
  }
}

module.exports = ValidationService;