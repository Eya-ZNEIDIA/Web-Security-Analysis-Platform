/**
 * Frontend Lab Report Translations
 * Traductions pour la génération de rapports PDF côté client (Labs.jsx)
 */

const labsTranslations = {
  fr: {
    reportTitle: "RAPPORT D'AUDIT DE SÉCURITÉ",
    generatedOn: "Généré le",
    securityHeaders: "📋 En-têtes de sécurité HTTP",
    vulnDetected: "🚨 Vulnérabilités détectées",
    noVulnDetected: "✓ Aucune vulnérabilité détectée",
    aiRecommendations: "💡 Recommandations IA",
    noRecommendations: "Aucune recommandation disponible.",
    footer: "SecureAudit Platform — Rapport confidentiel",
    rights: "Tous les droits réservés © 2026",
    status: "Statut",
    present: "✓ Présent",
    absent: "✗ Absent",
    warning: "⚠ Absent",
    critical: "Critique",
    recommended: "Recommandé",
    header: "En-tête",
    priority: "Priorité",
    score: "/100",
    secureScore: "Sécurisé",
    moderateRisk: "Risque modéré",
    criticalRisk: "Critique",
    reportDownloading: "Téléchargement du rapport...",
  },
  en: {
    reportTitle: "SECURITY AUDIT REPORT",
    generatedOn: "Generated on",
    securityHeaders: "📋 HTTP Security Headers",
    vulnDetected: "🚨 Detected Vulnerabilities",
    noVulnDetected: "✓ No vulnerabilities detected",
    aiRecommendations: "💡 AI Recommendations",
    noRecommendations: "No recommendations available.",
    footer: "SecureAudit Platform — Confidential Report",
    rights: "All rights reserved © 2026",
    status: "Status",
    present: "✓ Present",
    absent: "✗ Absent",
    warning: "⚠ Absent",
    critical: "Critical",
    recommended: "Recommended",
    header: "Header",
    priority: "Priority",
    score: "/100",
    secureScore: "Secure",
    moderateRisk: "Moderate Risk",
    criticalRisk: "Critical",
    reportDownloading: "Downloading report...",
  }
};

/**
 * Obtenir une traduction
 * @param {string} language - 'fr' ou 'en'
 * @param {string} key - Clé de traduction
 * @returns {string} Texte traduit
 */
export const t = (language, key) => {
  const lang = labsTranslations[language] || labsTranslations.en;
  return lang[key] || key;
};

export default labsTranslations;
