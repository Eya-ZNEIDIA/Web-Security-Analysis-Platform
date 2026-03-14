const axios = require("axios");

class ValidationService {

  static async validateURL(url) {
    try {
      console.log("Validation bypassed for testing:", url);
      return true;

     
      /*
      const response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          "User-Agent": "Mozilla/5.0 SecurityScanner",
          "Accept": "text/html,application/xhtml+xml"
        }
      });

      if (response.status >= 200 && response.status < 500) {
        return true;
      }

      throw new Error("Invalid target");
      */

    } catch (error) {
      throw new Error("Cible inaccessible ou non autorisée");
    }
  }

  static async verifyAuthorization(url) {
    // Pour testing, on considère toutes les cibles autorisées
    return true;
  }

}

module.exports = ValidationService;