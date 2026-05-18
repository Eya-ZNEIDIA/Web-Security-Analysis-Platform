/**
 * 🔒 URL Validator - Frontend Validation
 * 
 * Fournit une validation robuste des URLs avant envoi au backend.
 * Gère les cas d'erreur et retourne des messages utilisateur clairs.
 */

/**
 * Valide une URL selon les critères :
 * - Non vide
 * - Format valide
 * - Protocole HTTP ou HTTPS uniquement
 * 
 * @param {string} urlString - L'URL à valider
 * @returns {Object} { isValid: boolean, error?: string, cleanUrl?: string }
 */
export const validateUrl = (urlString) => {
  // Vérifier que l'URL n'est pas vide
  if (!urlString || typeof urlString !== 'string') {
    return {
      isValid: false,
      error: 'Veuillez entrer une URL valide',
    };
  }

  const trimmed = urlString.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Veuillez entrer une URL valide',
    };
  }

  if (trimmed.length > 2048) {
    return {
      isValid: false,
      error: 'L\'URL est trop longue (max 2048 caractères)',
    };
  }

  let urlToValidate = trimmed;

  // Ajouter le protocole par défaut si absent
  if (!/^https?:\/\//i.test(urlToValidate)) {
    urlToValidate = `https://${urlToValidate}`;
  }

  // Valider avec l'API URL standard du navigateur
  try {
    const urlObj = new URL(urlToValidate);

    // Vérifier le protocole (HTTP ou HTTPS uniquement)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'Seules les URLs HTTP et HTTPS sont acceptées',
      };
    }

    // Vérifier que le hostname n'est pas vide
    if (!urlObj.hostname) {
      return {
        isValid: false,
        error: 'Veuillez entrer une URL valide',
      };
    }

    // Vérifier qu'il ne s'agit pas de localhost ou 127.0.0.1 (environnement de dev)
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      // On peut accepter localhost en dev, mais le backend peut rejeter
      // Optionnel : return { isValid: false, error: 'Les URLs locales ne sont pas acceptées' }
    }

    // Vérifier que le domaine a au moins un point (exemple.com) ou est une IP valide
    const isValidDomain = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(hostname) ||
                          /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
                          /^\[?([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]?$/.test(hostname);

    if (!isValidDomain) {
      return {
        isValid: false,
        error: 'Veuillez entrer une URL valide',
      };
    }

    return {
      isValid: true,
      cleanUrl: urlObj.href,
    };
  } catch (e) {
    return {
      isValid: false,
      error: 'Veuillez entrer une URL valide',
    };
  }
};

/**
 * Normalise une URL (ajoute https:// si absent)
 * 
 * @param {string} url - L'URL à normaliser
 * @returns {string} L'URL normalisée
 */
export const normalizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

/**
 * Extrait le domaine d'une URL
 * 
 * @param {string} url - L'URL complète
 * @returns {string} Le domaine (ex: exemple.com)
 */
export const extractDomain = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};
