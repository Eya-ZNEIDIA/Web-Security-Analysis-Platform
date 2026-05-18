/**
 * HeaderAnalysisService - Bilingual Edition
 * Analyse les headers HTTP présents et absents pour identifier les vulnérabilités
 * de configuration de sécurité.
 */

const { t } = require("../config/translations");

class HeaderAnalysisService {
  /**
   * Baseline des headers de sécurité recommandés
   * Source: OWASP, Mozilla, etc.
   */
  static SECURITY_HEADERS_BASELINE = [
    {
      name: "Strict-Transport-Security",
      shortName: "HSTS",
      category: "Transport Security",
      recommended: "max-age=31536000; includeSubDomains",
      severity: "high",
      risk: "HTTPS not enforced; Man-in-the-middle attacks possible",
      impact: "Session hijacking, credential interception, data tampering",
      remediation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
    },
    {
      name: "Content-Security-Policy",
      shortName: "CSP",
      category: "Injection Prevention",
      recommended: "default-src 'self'",
      severity: "high",
      risk: "No protection against XSS, clickjacking, injection attacks",
      impact: "XSS attacks, credential theft, malware injection",
      remediation: "Implement restrictive CSP policy matching your application"
    },
    {
      name: "X-Frame-Options",
      shortName: "XFO",
      category: "Clickjacking Protection",
      recommended: "DENY or SAMEORIGIN",
      severity: "medium",
      risk: "Application vulnerable to clickjacking attacks",
      impact: "UI redressing, credential theft via framing",
      remediation: "Add: X-Frame-Options: DENY (or SAMEORIGIN if embedding needed)"
    },
    {
      name: "X-Content-Type-Options",
      shortName: "XCTO",
      category: "MIME Type Sniffing",
      recommended: "nosniff",
      severity: "medium",
      risk: "Browser can MIME-sniff responses, leading to XSS",
      impact: "Bypass of Content-Type restrictions, XSS execution",
      remediation: "Add: X-Content-Type-Options: nosniff"
    },
    {
      name: "Referrer-Policy",
      shortName: "RP",
      category: "Information Disclosure",
      recommended: "strict-origin-when-cross-origin",
      severity: "low",
      risk: "Leaking referrer information cross-site",
      impact: "URL parameter information disclosure",
      remediation: "Add: Referrer-Policy: strict-origin-when-cross-origin"
    },
    {
      name: "Permissions-Policy",
      shortName: "PP",
      category: "Feature Control",
      recommended: "geolocation=(), microphone=(), camera=()",
      severity: "medium",
      risk: "Browser features can be abused without restrictions",
      impact: "Unauthorized access to camera, microphone, location",
      remediation: "Add: Permissions-Policy: geolocation=(), microphone=(), camera=()"
    },
    {
      name: "X-XSS-Protection",
      shortName: "XXP",
      category: "XSS Protection (Legacy)",
      recommended: "1; mode=block",
      severity: "low",
      risk: "Legacy XSS protection not enabled",
      impact: "XSS attacks in older browsers",
      remediation: "Add: X-XSS-Protection: 1; mode=block (deprecated, CSP recommended)"
    },
    {
      name: "X-Permitted-Cross-Domain-Policies",
      shortName: "XPCDP",
      category: "Cross-Domain Policy",
      recommended: "none",
      severity: "low",
      risk: "Cross-domain policies can be exploited",
      impact: "Unauthorized cross-domain access via Flash/PDF",
      remediation: "Add: X-Permitted-Cross-Domain-Policies: none"
    }
  ];

  /**
   * Analyser les headers bruts
   * @param {Object} headersRaw - Headers bruts
   * @param {string} language - Langue ('fr' ou 'en')
   * @returns {Object} Analyse complète
   */
  static analyzeHeaders(headersRaw = {}, language = 'en') {
    const present = [];
    const absent = [];
    const additionalHeaders = [];

    // Normalisé les clés des headers bruts
    const headersNorm = {};
    for (const [key, value] of Object.entries(headersRaw)) {
      headersNorm[key.toLowerCase()] = value;
    }

    // Vérifier chaque header de la baseline
    this.SECURITY_HEADERS_BASELINE.forEach(baselineHeader => {
      const found = Object.entries(headersNorm).find(
        ([key]) => key.toLowerCase() === baselineHeader.name.toLowerCase()
      );

      if (found) {
        present.push({
          name: baselineHeader.name,
          value: found[1],
          severity: baselineHeader.severity
        });
      } else {
        absent.push({
          name: baselineHeader.name,
          severity: baselineHeader.severity,
          risk: baselineHeader.risk,
          remediation: baselineHeader.remediation
        });
      }
    });

    // Headers supplémentaires
    const baselineNames = this.SECURITY_HEADERS_BASELINE.map(h => h.name.toLowerCase());
    for (const [key, value] of Object.entries(headersNorm)) {
      if (!baselineNames.includes(key.toLowerCase())) {
        additionalHeaders.push({
          name: key,
          value: value
        });
      }
    }

    // Calculer les stats
    const stats = this._calculateStats(present, absent, language);

    return {
      present,
      absent,
      additionalHeaders,
      stats
    };
  }

  /**
   * Calculer les statistiques
   */
  static _calculateStats(present, absent, language = 'en') {
    const total = present.length + absent.length;
    const complianceScore = total > 0 ? Math.round((present.length / total) * 100) : 0;

    // Compter les absences critiques
    const criticalAbsent = absent.filter(h => h.severity === 'high').length;
    const highAbsent = absent.filter(h => h.severity === 'medium').length;

    return {
      complianceScore,
      presentCount: present.length,
      absentCount: absent.length,
      totalCount: total,
      criticalMissing: criticalAbsent,
      highMissing: highAbsent
    };
  }

  /**
   * Grouper les headers par catégorie
   * @param {Object} analysis - Résultat de analyzeHeaders
   * @param {string} language - Langue
   * @returns {Object} Headers groupés par catégorie
   */
  static getHeadersByCategory(analysis, language = 'en') {
    const categories = {};

    this.SECURITY_HEADERS_BASELINE.forEach(header => {
      if (!categories[header.category]) {
        categories[header.category] = {
          present: [],
          absent: []
        };
      }

      const inPresent = analysis.present.find(h => h.name === header.name);
      if (inPresent) {
        categories[header.category].present.push(inPresent);
      } else {
        const inAbsent = analysis.absent.find(h => h.name === header.name);
        if (inAbsent) {
          categories[header.category].absent.push(inAbsent);
        }
      }
    });

    return categories;
  }

  /**
   * Générer un résumé des headers
   * @param {Object} analysis - Résultat de analyzeHeaders
   * @param {string} language - Langue
   * @returns {Object} Résumé
   */
  static generateHeadersSummary(analysis, language = 'en') {
    const score = analysis.stats.complianceScore;
    let verdict;
    let verdictColor;

    if (score >= 90) {
      verdict = language === 'fr' ? 'Excellent' : 'Excellent';
      verdictColor = '#16a34a';
    } else if (score >= 70) {
      verdict = language === 'fr' ? 'Bon' : 'Good';
      verdictColor = '#ea580c';
    } else if (score >= 50) {
      verdict = language === 'fr' ? 'Moyen' : 'Fair';
      verdictColor = '#d97706';
    } else {
      verdict = language === 'fr' ? 'Mauvais' : 'Poor';
      verdictColor = '#dc2626';
    }

    return {
      complianceScore: score,
      verdict,
      verdictColor,
      recommendation: this._getRecommendation(score, language),
      criticalMissing: analysis.stats.criticalMissing,
      highMissing: analysis.stats.highMissing
    };
  }

  /**
   * Obtenir la recommandation
   */
  static _getRecommendation(score, language = 'en') {
    if (language === 'fr') {
      if (score >= 90) return 'Excellente configuration de sécurité des headers.';
      if (score >= 70) return 'Bonne configuration avec quelques améliorations recommandées.';
      if (score >= 50) return 'Configuration acceptable mais des éléments critiques manquent.';
      return 'Configuration insuffisante - les headers critiques doivent être ajoutés.';
    } else {
      if (score >= 90) return 'Excellent security headers configuration.';
      if (score >= 70) return 'Good configuration with some recommended improvements.';
      if (score >= 50) return 'Acceptable configuration but critical elements are missing.';
      return 'Insufficient configuration - critical headers must be added.';
    }
  }

  /**
   * Calculer le score de sécurité
   * @param {Object} analysis - Résultat de analyzeHeaders
   * @param {string} language - Langue
   * @returns {number} Score (0-100)
   */
  static calculateSecurityScore(analysis, language = 'en') {
    let score = analysis.stats.complianceScore;

    // Réduire le score en fonction des absences critiques
    score -= analysis.stats.criticalMissing * 20;
    score -= analysis.stats.highMissing * 10;

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = HeaderAnalysisService;
