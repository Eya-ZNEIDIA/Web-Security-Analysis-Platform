/**
 * Exemple d'utilisation du système de génération de rapports PDF
 * À placer dans Backend/scripts ou à utiliser comme référence
 */

const PDFGeneratorService = require("../services/PDFGeneratorService");
const HeaderAnalysisService = require("../services/HeaderAnalysisService");

// Exemple de données d'audit
const exampleAuditData = {
  urlCible: "https://example.com",
  date: new Date(),
  statut: "terminé",
  intensity: "medium",
  headers: [
    { name: "Server", value: "nginx/1.19.0" },
    { name: "X-Powered-By", value: "Express" },
    { name: "Content-Security-Policy", value: "default-src 'self'" },
    { name: "X-Frame-Options", value: "DENY" },
    { name: "Strict-Transport-Security", value: "max-age=31536000" }
  ]
};

// Exemple de données de rapport
const exampleReportData = {
  scoreGlobal: 72,
  durationMs: 15432,
  ai_model: "llama3.1",
  ai_prompt_version: "v2.0",
  risk_breakdown: {
    critical: 0,
    high: 2,
    medium: 5,
    low: 8,
    info: 3
  },
  statistics: {
    total_endpoints: 24,
    total_requests: 342,
    total_payloads: 156,
    total_vulnerabilities: 18,
    true_positives: 18,
    suppressed_false_positives: 14,
    avg_confidence: 0.87,
    avg_cvss: 5.2
  },
  timeline: [
    {
      ts: new Date(),
      phase: "VALIDATE",
      level: "info",
      message: "Validating URL and authorization"
    },
    {
      ts: new Date(Date.now() + 1000),
      phase: "RECON",
      level: "info",
      message: "Collecting initial data",
      meta: { endpoints: 24, forms: 5 }
    },
    {
      ts: new Date(Date.now() + 2000),
      phase: "EXECUTE",
      level: "info",
      message: "Sending attack scenarios",
      meta: { total: 156 }
    }
  ],
  recommendations: [
    "Mettre à jour les dépendances npm",
    "Implémenter des en-têtes de sécurité manquants",
    "Ajouter la validation des inputs",
    "Configurer un WAF"
  ]
};

// Exemple de vulnérabilités
const exampleVulnerabilities = [
  {
    severity: "high",
    type: "SQL Injection",
    niveauRisque: "high",
    description: "Vulnérabilité d'injection SQL détectée dans le paramètre 'id'",
    technical_details: "L'application n'échappes pas correctement les entrées utilisateur",
    endpoint: "/api/users",
    method: "GET",
    parameter: "id",
    payload: "' OR '1'='1",
    evidence: "Délai de réponse anormal détecté",
    owasp_category: "A03:2021-Injection",
    cwe: "CWE-89",
    cvss_score: 7.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    ai_confidence: 0.92,
    fix_recommendation: "Utiliser des requêtes paramétrées (prepared statements) pour toutes les requêtes SQL",
    secure_code_example: `
// ❌ Mauvais
const query = \`SELECT * FROM users WHERE id = \${userId}\`;

// ✅ Bon  
const query = "SELECT * FROM users WHERE id = ?";
db.query(query, [userId]);
    `,
    business_impact: "Un attaquant pourrait accéder à toutes les données utilisateurs",
    reproduction_steps: [
      "Accéder à /api/users?id=' OR '1'='1",
      "Observer que tous les utilisateurs sont retournés",
      "Confirmer que l'injection SQL fonctionne"
    ],
    detection_source: "hybrid"
  },
  {
    severity: "medium",
    type: "Missing Security Headers",
    niveauRisque: "medium",
    description: "L'en-tête Referrer-Policy est manquant",
    technical_details: "Cet en-tête contrôle comment les informations du référent sont transmises",
    endpoint: "/*",
    method: "GET",
    parameter: "N/A",
    payload: "N/A",
    owasp_category: "A05:2021-Security Misconfiguration",
    cwe: "CWE-693",
    cvss_score: 3.7,
    ai_confidence: 0.95,
    fix_recommendation: "Ajouter l'en-tête Referrer-Policy: strict-origin-when-cross-origin",
    business_impact: "Fuite potentielle d'informations sensibles",
    detection_source: "rule"
  }
];

/**
 * Test de génération du rapport
 */
async function generateExampleReport() {
  try {
    const outputPath = "./test-rapport.pdf";

    console.log("🔄 Génération du rapport PDF...");
    console.log(`📍 Chemin de sortie: ${outputPath}`);

    // Analyser les headers
    const headerAnalysis = HeaderAnalysisService.analyzeHeaders(exampleAuditData.headers);
    console.log(`📊 Analyse des headers:`);
    console.log(`   - Score de conformité: ${headerAnalysis.stats.complianceScore}%`);
    console.log(`   - Headers présents: ${headerAnalysis.stats.presentCount}/${headerAnalysis.stats.totalSecurityHeaders}`);
    console.log(`   - Headers manquants: ${headerAnalysis.stats.absentCount}`);

    // Générer le PDF
    const result = await PDFGeneratorService.generateFullReport(
      exampleAuditData,
      exampleReportData,
      exampleVulnerabilities,
      outputPath
    );

    console.log(`✅ Rapport généré avec succès!`);
    console.log(`📄 Fichier: ${result}`);
    console.log(`💾 Taille: ${require("fs").statSync(result).size} bytes`);

  } catch (err) {
    console.error("❌ Erreur lors de la génération:", err.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  generateExampleReport();
}

module.exports = { generateExampleReport, exampleAuditData, exampleReportData, exampleVulnerabilities };
