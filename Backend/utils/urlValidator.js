/**
 * 🔒 URL Validator - Backend Validation
 * 
 * Fournit une validation robuste des URLs côté serveur.
 * Protection supplémentaire pour éviter les erreurs et abus.
 */

const { URL } = require('url');

/**
 * Valide une URL selon des critères stricts
 * - Non vide
 * - Format valide
 * - Protocole HTTP ou HTTPS uniquement
 * - Domaine valide (pas localhost, 127.0.0.1, etc.)
 * 
 * @param {string} urlString - L'URL à valider
 * @returns {Object} { isValid: boolean, error?: string, cleanUrl?: string }
 */
const validateUrl = (urlString) => {
  // ✅ Vérification 1: Type et existence
  if (!urlString || typeof urlString !== 'string') {
    return {
      isValid: false,
      error: 'Veuillez entrer une URL valide',
    };
  }

  const trimmed = urlString.trim();

  // ✅ Vérification 2: Non vide
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'L\'URL ne peut pas être vide',
    };
  }

  // ✅ Vérification 3: Longueur maximale
  if (trimmed.length > 2048) {
    return {
      isValid: false,
      error: 'L\'URL est trop longue (maximum 2048 caractères)',
    };
  }

  let urlToValidate = trimmed;

  // Ajouter le protocole par défaut si absent
  if (!/^https?:\/\//i.test(urlToValidate)) {
    urlToValidate = `https://${urlToValidate}`;
  }

  // ✅ Vérification 4: Format URL valide
  let urlObj;
  try {
    urlObj = new URL(urlToValidate);
  } catch (e) {
    return {
      isValid: false,
      error: 'Format d\'URL invalide',
    };
  }

  // ✅ Vérification 5: Protocole autorisé (HTTP/HTTPS uniquement)
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    return {
      isValid: false,
      error: 'Seules les URLs HTTP et HTTPS sont acceptées',
    };
  }

  // ✅ Vérification 6: Hostname non vide
  if (!urlObj.hostname) {
    return {
      isValid: false,
      error: 'Domaine manquant ou invalide',
    };
  }

  const hostname = urlObj.hostname.toLowerCase();

  // ✅ Vérification 7: Rejeter les adresses locales (sécurité - SSRF prevention)
  const localPatterns = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '169.254', // link-local
  ];

  for (const pattern of localPatterns) {
    if (hostname === pattern || hostname.startsWith(pattern)) {
      return {
        isValid: false,
        error: 'Les adresses locales ne sont pas acceptées',
      };
    }
  }

  // ✅ Vérification 8: Rejeter les adresses IP privées (RFC 1918 - SSRF prevention)
  const isPrivateIP = (ip) => {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];
    return privateRanges.some(range => range.test(ip));
  };

  // ✅ Vérification 9: Validation du domaine ou IP
  const isValidDomain = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(hostname) ||
                        /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
                        /^\[?([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]?$/.test(hostname);

  if (!isValidDomain) {
    return {
      isValid: false,
      error: 'Format de domaine invalide',
    };
  }

  // ✅ Vérification 10: Vérifier si c'est une IP privée
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIP(hostname)) {
      return {
        isValid: false,
        error: 'Les adresses IP privées ne sont pas acceptées',
      };
    }
  }

  return {
    isValid: true,
    cleanUrl: urlObj.href,
  };
};

/**
 * Normalise une URL (ajoute https:// si absent)
 * 
 * @param {string} url - L'URL à normaliser
 * @returns {string} L'URL normalisée
 */
const normalizeUrl = (url) => {
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
const extractDomain = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
};

module.exports = {
  validateUrl,
  normalizeUrl,
  extractDomain,
};
