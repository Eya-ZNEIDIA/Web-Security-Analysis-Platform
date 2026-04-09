const Audit = require("../models/Audit");
const Rapport = require("../models/Rapport");
const Vulnerabilite = require("../models/Vulnerabilite");
const Alert = require("../models/Alert");
const ValidationService = require("./ValidationService");
const DataAnalyzerService = require("./DataAnalyzerService");
const TestEngineService = require("./TestEngineService");
const RiskEngineService = require("./RiskEngineService");
const AIAgentService = require("./AIAgentService");

class AuditService {
  static async launchAudit({ targetUrl, intensity = "medium", userId }) {
    console.log("AuditService: userId reçu =", userId);
    if (!userId) throw new Error("userId manquant dans AuditService");

    console.log("Lancement audit :", targetUrl);

    await ValidationService.validateURL(targetUrl);
    await ValidationService.verifyAuthorization(targetUrl);

    const initialData = await DataAnalyzerService.collectInitialData(targetUrl);
    const scenarios = await AIAgentService.generateTestScenarios(initialData, intensity);
    const rawResults = await TestEngineService.executeScenarios(targetUrl, scenarios);
    const technicalAnalysis = DataAnalyzerService.analyzeRawResults(rawResults);
    const vulnerabilities = await AIAgentService.analyzeSecurityResults(technicalAnalysis);
    const riskScore = RiskEngineService.calculateGlobalRiskScore(vulnerabilities);

    const headersRaw = initialData.headers || [];
    const headers = Array.isArray(headersRaw)
      ? headersRaw
      : Object.entries(headersRaw).map(([key, value]) => ({
          name: key,
          present: value != null,
          critical: false
        }));

    const recommendations = vulnerabilities
      .map(v => v.recommendation)
      .filter(r => r);

    // 🔹 Création Audit
    const newAudit = await Audit.create({
      userId,
      date: new Date(),
      statut: "terminé",
      urlCible: targetUrl,
      requetes: [],
      reponses: [],
      rapport: null,
      headers: headers,
      recommendations: recommendations,
      scoreGlobal: riskScore
    });
    console.log("Audit créé avec ID:", newAudit._id);

    // 🔹 Création Vulnérabilités et Alertes
    const savedVulns = [];
    const alerts = [];

    const severityMap = {
      "critical": "Critique",
      "Critique": "Critique",
      "high": "Élevé",
      "Élevé": "Élevé",
      "medium": "Moyen",
      "Moyen": "Moyen",
      "low": "Faible",
      "Faible": "Faible"
    };

    for (const v of vulnerabilities) {
      const mappedSeverity = severityMap[v.severity] || "Moyen";

      const vuln = await Vulnerabilite.create({
        userId,
        auditId: newAudit._id,
        type: v.type,
        niveauRisque: mappedSeverity,
        description: v.description,
        recommandation: v.recommendation,
        priorite: "à définir",
        category: v.category || "Général",   // valeur par défaut
        score: Number(v.score) || 0            
      });
      savedVulns.push(vuln._id);

      const alert = await Alert.create({
        userId,
        auditId: newAudit._id,
        vulnerabiliteId: vuln._id,
        level: mappedSeverity,
        title: v.type,
        message: `Nouvelle vulnérabilité détectée: ${v.type}`,
        description: v.description,
        urlCible: targetUrl,
        read: false
      });
      alerts.push(alert._id);
      console.log("Alerte créée:", alert._id);
    }
    console.log("Vulnérabilités et alertes créées:", savedVulns.length);

    // 🔹 Création Rapport ✅ CECI ÉTAIT MANQUANT
    const newReport = await Rapport.create({
      dateGeneration: new Date(),
      resume: `Audit pour ${targetUrl}`,
      scoreGlobal: riskScore,
      vulnerabilites: savedVulns,
      headers: headers,
      recommendations: recommendations
    });

    newAudit.rapport = newReport._id;
    await newAudit.save();
    console.log("Rapport créé avec ID:", newReport._id);

    // ✅ RETOURNER LA RÉPONSE
    return {
      success: true,
      auditId: newAudit._id,
      reportId: newReport._id,
      scoreGlobal: riskScore,
      headers: headers.map(h => ({
        name: h.name || h,
        present: h.present !== false,
        critical: h.critical || false
      })),
      vulnerabilities: vulnerabilities.map((v, i) => ({
        id: `V-${i}`,
        severity: v.severity,
        title: v.type,
        description: v.description,
        fix: v.recommendation
      })),
      recommendations: recommendations,
      alerts: alerts
    };
  }
}

module.exports = AuditService;