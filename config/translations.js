/**
 * Translations for Security Audit Reports
 * Supports: French (fr) and English (en)
 */

const translations = {
  fr: {
    // Document Metadata
    documentTitle: "Rapport d'Audit de Sécurité",
    documentType: "RAPPORT AUDIT",
    auditType: "Audit de Sécurité Web",
    generatedOn: "Généré le",
    preparedBy: "Préparé par",
    version: "Version",

    // Cover Page
    coverTitle: "RAPPORT D'AUDIT DE SÉCURITÉ",
    coverSubtitle: "Analyse de sécurité complète",
    coverDate: "Date d'audit",
    coverTarget: "Cible de l'audit",
    coverStatus: "Statut du rapport",

    // Table of Contents
    tableOfContents: "TABLE DES MATIÈRES",
    pageNumber: "Page",

    // Sections
    executiveSummary: "RÉSUMÉ EXÉCUTIF",
    globalAnalysis: "ANALYSE GLOBALE",
    headersAnalysis: "ANALYSE DES EN-TÊTES HTTP",
    vulnerabilities: "VULNÉRABILITÉS",
    recommendations: "RECOMMANDATIONS",
    timeline: "CHRONOLOGIE",
    conclusion: "CONCLUSION",

    // Executive Summary
    summaryIntro: "Ce rapport présente une analyse de sécurité complète du système.",
    summaryStats: "Statistiques générales",
    summaryRisk: "Niveau de risque global",
    summaryFindings: "Résultats clés",
    summaryNext: "Prochaines étapes",

    // Global Analysis
    analysisTitle: "Vue d'ensemble de la sécurité",
    analysisDescription: "Analyse détaillée des résultats de sécurité",
    totalVulnerabilities: "Vulnérabilités détectées",
    criticalCount: "Critique",
    highCount: "Élevé",
    mediumCount: "Moyen",
    lowCount: "Faible",
    infoCount: "Information",
    riskScore: "Score de risque",
    complianceScore: "Score de conformité",
    overallRating: "Évaluation globale",

    // Risk Levels
    criticalRisk: "Critique",
    highRisk: "Élevé",
    mediumRisk: "Moyen",
    lowRisk: "Faible",
    infoRisk: "Information",
    criticalVerdictTitle: "Risque critique détecté",
    criticalVerdictDesc: "Action immédiate requise - menace sévère identifiée",
    highVerdictTitle: "Risques élevés présents",
    highVerdictDesc: "Correction nécessaire dans les délais - vulnérabilités importantes",
    mediumVerdictTitle: "Problèmes modérés",
    mediumVerdictDesc: "Amélioration recommandée - non-conformités détectées",
    lowVerdictTitle: "Problèmes mineurs",
    lowVerdictDesc: "Optimisations suggérées pour renforcer la sécurité",
    infoVerdictTitle: "Informations",
    infoVerdictDesc: "Données utiles pour une meilleure compréhension",

    // Headers Analysis
    headersComplianceScore: "Score de conformité des en-têtes",
    headersPresent: "En-têtes présents",
    headersAbsent: "En-têtes manquants",
    headersPresentDesc: "Headers de sécurité implémentés",
    headersAbsentDesc: "Headers recommandés non configurés",
    headersAdditional: "En-têtes supplémentaires détectés",
    headersCriticalMissing: "En-têtes critiques manquants",
    headersHighMissing: "En-têtes importants manquants",
    headersRisks: "Risques associés aux headers manquants",

    // Security Headers Details
    headerDetails: {
      "Strict-Transport-Security": {
        name: "Strict-Transport-Security",
        description: "Force la connexion HTTPS",
        risk: "Risque d'attaque MITM sans cette protection"
      },
      "Content-Security-Policy": {
        name: "Content-Security-Policy",
        description: "Prévient les injections de contenu",
        risk: "Vulnérabilité aux attaques XSS"
      },
      "X-Frame-Options": {
        name: "X-Frame-Options",
        description: "Protège contre les attaques de clickjacking",
        risk: "Possibilité de clickjacking"
      },
      "X-Content-Type-Options": {
        name: "X-Content-Type-Options",
        description: "Empêche le MIME type sniffing",
        risk: "Risque d'exécution de contenu malveillant"
      },
      "Referrer-Policy": {
        name: "Referrer-Policy",
        description: "Contrôle l'envoi des informations de référent",
        risk: "Fuite de données sensibles via referrer"
      },
      "Permissions-Policy": {
        name: "Permissions-Policy",
        description: "Contrôle l'accès aux APIs du navigateur",
        risk: "Accès non autorisé aux APIs sensibles"
      },
      "X-XSS-Protection": {
        name: "X-XSS-Protection",
        description: "Protection additionnelle contre XSS",
        risk: "Vulnérabilité XSS non mitigée"
      },
      "X-Permitted-Cross-Domain-Policies": {
        name: "X-Permitted-Cross-Domain-Policies",
        description: "Restreint les politiques inter-domaines",
        risk: "Risque d'accès cross-domain"
      }
    },

    // Vulnerabilities - Extended
    vulnerabilityTitle: "Vulnerabilité",
    vulnerabilitySeverity: "Sévérité",
    vulnerabilityCVSSScore: "Score CVSS",
    vulnerabilityCVSSVector: "Vecteur CVSS",
    vulnerabilityOWASP: "Catégorie OWASP",
    vulnerabilityCWE: "CWE",
    vulnerabilityAIConfidence: "Confiance IA",
    vulnerabilityDescription: "Description",
    vulnerabilityTechnicalContext: "Contexte technique",
    vulnerabilityEndpoint: "Endpoint",
    vulnerabilityMethod: "Méthode HTTP",
    vulnerabilityParameter: "Paramètre",
    vulnerabilityPayload: "Payload",
    vulnerabilityEvidence: "Preuve de détection",
    vulnerabilityResponseSnippet: "Extrait de réponse HTTP",
    vulnerabilityBusinessImpact: "Impact métier",
    vulnerabilityImpactSection: "Impacts",
    vulnerabilityImpact: "Impact",
    vulnerabilityReproductionSteps: "Étapes de reproduction",
    vulnerabilityRemediations: "Recommandations de correction",
    vulnerabilityFixRecommendation: "Recommandation de correction",
    vulnerabilityRecommendation: "Recommandation",
    vulnerabilitySecureCodeExample: "Exemple de code sécurisé",
    vulnerabilityHeadersToAdd: "En-têtes de sécurité recommandés",

    // Audit Information
    auditInformation: "Informations d'audit",
    auditTarget: "Cible",
    auditDate: "Date d'audit",
    auditDuration: "Durée",
    auditIntensity: "Intensité",
    auditStatus: "Statut",
    auditMetrics: "Métriques d'audit",
    totalEndpoints: "Endpoints testés",
    totalRequests: "Requêtes HTTP",
    severitySummary: "Résumé par sévérité",

    // Headers Analysis - Extended
    headersImplementedCorrectly: "en-têtes de sécurité correctement implémentés",
    headersCriticalMissing: "En-têtes critiques manquants",
    headersHighMissing: "En-têtes importants manquants",
    remediationAdvice: "Conseils de remédiation",
    headersDescription: "Description",
    headersRecommended: "Configuration recommandée",
    headersRisk: "Risque",
    headersRemediation: "Remédiation",
    headersSummary: "Résumé des en-têtes",
    headersMostCriticalRisk: "Risque critique le plus élevé",

    // General
    verdict: "Verdict",
    globalScore: "Score global",
    overallRiskLevel: "Niveau de risque global",

    // Recommendations
    recommendationsTitle: "Recommandations",
    recommendationsByPriority: "Recommandations par priorité",
    recommendationCritical: "Corrections critiques",
    recommendationHigh: "Corrections importantes",
    recommendationMedium: "Corrections modérées",
    recommendationLow: "Améliorations suggérées",
    recommendationAction: "Action recommandée",
    recommendationBenefit: "Bénéfice",
    recommendationEffort: "Effort estimé",
    recommendationTimeline: "Délai recommandé",

    // Timeline
    timelineTitle: "Chronologie de l'audit",
    timelineStart: "Début de l'audit",
    timelineEnd: "Fin de l'audit",
    timelineVulnerabilitiesFound: "Vulnérabilités découvertes",
    timelineAnalysisCompleted: "Analyse complétée",

    // Conclusion
    conclusionTitle: "Conclusion",
    conclusionIntro: "Au terme de cet audit de sécurité, les résultats suivants ont été documentés:",
    conclusionSummary: "Résumé des résultats",
    conclusionNextSteps: "Prochaines étapes",
    conclusionNextStepsDetail: "Il est recommandé de :",
    conclusionPrioritize: "Prioriser les vulnérabilités critiques",
    conclusionImplement: "Implémenter les recommandations",
    conclusionMonitor: "Mettre en place une surveillance",
    conclusionRetest: "Prévoir un audit de conformité",
    conclusionContinue: "Continuer les efforts de sécurité",

    // Footer
    footerConfidential: "Document confidentiel",
    footerPageOf: "Page",
    footerAuthor: "Auteur",
    footerTimestamp: "Horodatage",

    // Export Messages
    exportInitiated: "Génération du rapport PDF en cours...",
    exportSuccess: "Rapport généré avec succès",
    exportError: "Erreur lors de la génération du rapport",
    exportDownloading: "Téléchargement en cours...",
    fileName: "rapport-audit-securite",

    // Severity Matrix
    sevMatrix: "Matrice de sévérité",
    sevLikelihood: "Probabilité",
    sevImpact: "Impact",
    sevRating: "Évaluation",
  },

  en: {
    // Document Metadata
    documentTitle: "Security Audit Report",
    documentType: "AUDIT REPORT",
    auditType: "Web Security Audit",
    generatedOn: "Generated on",
    preparedBy: "Prepared by",
    version: "Version",

    // Cover Page
    coverTitle: "SECURITY AUDIT REPORT",
    coverSubtitle: "Comprehensive security analysis",
    coverDate: "Audit Date",
    coverTarget: "Audit Target",
    coverStatus: "Report Status",

    // Table of Contents
    tableOfContents: "TABLE OF CONTENTS",
    pageNumber: "Page",

    // Sections
    executiveSummary: "EXECUTIVE SUMMARY",
    globalAnalysis: "GLOBAL ANALYSIS",
    headersAnalysis: "HTTP HEADERS ANALYSIS",
    vulnerabilities: "VULNERABILITIES",
    recommendations: "RECOMMENDATIONS",
    timeline: "TIMELINE",
    conclusion: "CONCLUSION",

    // Executive Summary
    summaryIntro: "This report presents a comprehensive security analysis of the system.",
    summaryStats: "General statistics",
    summaryRisk: "Overall risk level",
    summaryFindings: "Key findings",
    summaryNext: "Next steps",

    // Global Analysis
    analysisTitle: "Security overview",
    analysisDescription: "Detailed analysis of security findings",
    totalVulnerabilities: "Vulnerabilities detected",
    criticalCount: "Critical",
    highCount: "High",
    mediumCount: "Medium",
    lowCount: "Low",
    infoCount: "Info",
    riskScore: "Risk score",
    complianceScore: "Compliance score",
    overallRating: "Overall rating",

    // Risk Levels
    criticalRisk: "Critical",
    highRisk: "High",
    mediumRisk: "Medium",
    lowRisk: "Low",
    infoRisk: "Info",
    criticalVerdictTitle: "Critical risk detected",
    criticalVerdictDesc: "Immediate action required - severe threat identified",
    highVerdictTitle: "High risks present",
    highVerdictDesc: "Correction needed urgently - significant vulnerabilities",
    mediumVerdictTitle: "Moderate issues",
    mediumVerdictDesc: "Improvement recommended - non-compliance detected",
    lowVerdictTitle: "Minor issues",
    lowVerdictDesc: "Optimizations suggested to strengthen security",
    infoVerdictTitle: "Informational",
    infoVerdictDesc: "Useful information for better understanding",

    // Headers Analysis
    headersComplianceScore: "Headers compliance score",
    headersPresent: "Present headers",
    headersAbsent: "Missing headers",
    headersPresentDesc: "Implemented security headers",
    headersAbsentDesc: "Recommended headers not configured",
    headersAdditional: "Additional headers detected",
    headersCriticalMissing: "Critical missing headers",
    headersHighMissing: "Important missing headers",
    headersRisks: "Risks associated with missing headers",

    // Security Headers Details
    headerDetails: {
      "Strict-Transport-Security": {
        name: "Strict-Transport-Security",
        description: "Forces HTTPS connection",
        risk: "Risk of MITM attack without this protection"
      },
      "Content-Security-Policy": {
        name: "Content-Security-Policy",
        description: "Prevents content injection",
        risk: "Vulnerability to XSS attacks"
      },
      "X-Frame-Options": {
        name: "X-Frame-Options",
        description: "Protects against clickjacking attacks",
        risk: "Possibility of clickjacking"
      },
      "X-Content-Type-Options": {
        name: "X-Content-Type-Options",
        description: "Prevents MIME type sniffing",
        risk: "Risk of malicious content execution"
      },
      "Referrer-Policy": {
        name: "Referrer-Policy",
        description: "Controls referrer information sending",
        risk: "Sensitive data leakage via referrer"
      },
      "Permissions-Policy": {
        name: "Permissions-Policy",
        description: "Controls browser API access",
        risk: "Unauthorized access to sensitive APIs"
      },
      "X-XSS-Protection": {
        name: "X-XSS-Protection",
        description: "Additional protection against XSS",
        risk: "Unmitigated XSS vulnerability"
      },
      "X-Permitted-Cross-Domain-Policies": {
        name: "X-Permitted-Cross-Domain-Policies",
        description: "Restricts cross-domain policies",
        risk: "Risk of cross-domain access"
      }
    },

    // Vulnerabilities - Extended
    vulnerabilityTitle: "Vulnerability",
    vulnerabilitySeverity: "Severity",
    vulnerabilityCVSSScore: "CVSS Score",
    vulnerabilityCVSSVector: "CVSS Vector",
    vulnerabilityOWASP: "OWASP Category",
    vulnerabilityCWE: "CWE",
    vulnerabilityAIConfidence: "AI Confidence",
    vulnerabilityDescription: "Description",
    vulnerabilityTechnicalContext: "Technical Context",
    vulnerabilityEndpoint: "Endpoint",
    vulnerabilityMethod: "HTTP Method",
    vulnerabilityParameter: "Parameter",
    vulnerabilityPayload: "Payload",
    vulnerabilityEvidence: "Detection Evidence",
    vulnerabilityResponseSnippet: "HTTP Response Snippet",
    vulnerabilityBusinessImpact: "Business Impact",
    vulnerabilityImpactSection: "Impacts",
    vulnerabilityImpact: "Impact",
    vulnerabilityReproductionSteps: "Reproduction Steps",
    vulnerabilityRemediations: "Remediation Recommendations",
    vulnerabilityFixRecommendation: "Fix Recommendation",
    vulnerabilityRecommendation: "Recommendation",
    vulnerabilitySecureCodeExample: "Secure Code Example",
    vulnerabilityHeadersToAdd: "Recommended Security Headers",

    // Audit Information
    auditInformation: "Audit Information",
    auditTarget: "Target",
    auditDate: "Audit Date",
    auditDuration: "Duration",
    auditIntensity: "Intensity",
    auditStatus: "Status",
    auditMetrics: "Audit Metrics",
    totalEndpoints: "Endpoints Tested",
    totalRequests: "HTTP Requests",
    severitySummary: "Severity Summary",

    // Headers Analysis - Extended
    headersImplementedCorrectly: "security headers correctly implemented",
    headersCriticalMissing: "Critical Missing Headers",
    headersHighMissing: "Important Missing Headers",
    remediationAdvice: "Remediation Advice",
    headersDescription: "Description",
    headersRecommended: "Recommended Configuration",
    headersRisk: "Risk",
    headersRemediation: "Remediation",
    headersSummary: "Headers Summary",
    headersMostCriticalRisk: "Highest Critical Risk",

    // General
    verdict: "Verdict",
    globalScore: "Global Score",
    overallRiskLevel: "Overall Risk Level",

    // Recommendations
    recommendationsTitle: "Recommendations",
    recommendationsByPriority: "Recommendations by Priority",
    recommendationCritical: "Critical fixes",
    recommendationHigh: "Important fixes",
    recommendationMedium: "Moderate fixes",
    recommendationLow: "Suggested improvements",
    recommendationAction: "Recommended action",
    recommendationBenefit: "Benefit",
    recommendationEffort: "Estimated effort",
    recommendationTimeline: "Recommended timeline",

    // Timeline
    timelineTitle: "Audit Timeline",
    timelineStart: "Audit Start",
    timelineEnd: "Audit End",
    timelineVulnerabilitiesFound: "Vulnerabilities Found",
    timelineAnalysisCompleted: "Analysis Completed",

    // Conclusion
    conclusionTitle: "Conclusion",
    conclusionIntro: "At the end of this security audit, the following results have been documented:",
    conclusionSummary: "Summary of findings",
    conclusionNextSteps: "Next steps",
    conclusionNextStepsDetail: "It is recommended to:",
    conclusionPrioritize: "Prioritize critical vulnerabilities",
    conclusionImplement: "Implement recommendations",
    conclusionMonitor: "Establish monitoring",
    conclusionRetest: "Plan compliance audit",
    conclusionContinue: "Continue security efforts",

    // Footer
    footerConfidential: "Confidential document",
    footerPageOf: "Page",
    footerAuthor: "Author",
    footerTimestamp: "Timestamp",

    // Export Messages
    exportInitiated: "PDF report generation in progress...",
    exportSuccess: "Report generated successfully",
    exportError: "Error during report generation",
    exportDownloading: "Downloading...",
    fileName: "security-audit-report",

    // Severity Matrix
    sevMatrix: "Severity Matrix",
    sevLikelihood: "Likelihood",
    sevImpact: "Impact",
    sevRating: "Rating",
  }
};

/**
 * Get translation string
 * @param {string} language - Language code ('fr' or 'en')
 * @param {string} key - Translation key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Translated string or default value
 */
function t(language = 'en', key, defaultValue = key) {
  if (!translations[language]) {
    language = 'en';
  }
  
  // Support nested keys like "headerDetails.Strict-Transport-Security.name"
  const keys = key.split('.');
  let value = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

module.exports = { translations, t };
