const ValidationService = require("./ValidationService");
const DataAnalyzerService = require("./DataAnalyzerService");
const TestEngineService = require("./TestEngineService");
const RiskEngineService = require("./RiskEngineService");
const ReportService = require("./ReportService");
const AIAgentService = require("./AIAgentService");
const Vulnerabilite = require("../models/Vulnerabilite");
const Audit = require("../models/Audit");
const Rapport = require("../models/Rapport");
class AuditService {

  static async launchAudit({ targetUrl, intensity = "medium" }) {
    try {
      console.log("Lancement audit :", targetUrl);

      await ValidationService.validateURL(targetUrl);
      await ValidationService.verifyAuthorization(targetUrl);

      console.log("URL validée et autorisée");

      const initialData = await DataAnalyzerService.collectInitialData(targetUrl);
      console.log("Données initiales collectées :", initialData);

      let scenarios = await AIAgentService.generateTestScenarios(initialData, intensity);

      if (!scenarios || scenarios.length === 0) {
        throw new Error("Aucun scénario généré par l'IA");
      }

      console.log(`${scenarios.length} scénarios générés par l'IA`);

      const rawResults = await TestEngineService.executeScenarios(targetUrl, scenarios);
      console.log(` Tests exécutés sur ${rawResults.length} endpoints`);

      const technicalAnalysis = DataAnalyzerService.analyzeRawResults(rawResults);
      console.log(" Analyse technique terminée");

      const vulnerabilities = await AIAgentService.analyzeSecurityResults(technicalAnalysis);
      console.log(` Vulnérabilités détectées : ${vulnerabilities.length}`);

      const riskScore = RiskEngineService.calculateGlobalRiskScore(vulnerabilities);
      console.log(" Risk score calculé :", riskScore);

      const report = ReportService.generateAuditReport({
        targetUrl,
        intensity,
        initialData,
        technicalAnalysis,
        vulnerabilities,
        riskScore
      });

      const savedVulns = [];

      for (const v of vulnerabilities) {

         const vuln = new Vulnerabilite({
          type: v.type,
          niveauRisque: v.severity,         
          description: v.description,
          recommandation: v.recommendation, 
          priorite: "à définir"             
       });


  await vuln.save();
  savedVulns.push(vuln._id);
}
   

      const newReport = new Rapport({
        dateGeneration: new Date(),
        resume: `Audit pour ${targetUrl}`,
        scoreGlobal: riskScore,
        vulnerabilites: savedVulns
      });
      await newReport.save();

      const newAudit = new Audit({
        date: new Date(),
        statut: "terminé",
        urlCible: targetUrl,  
        requetes: [],        
        reponses: [],       
        rapport: newReport._id
      });
      await newAudit.save();

      console.log("Audit et rapport sauvegardés dans la BD");

      console.log(" Audit terminé :", targetUrl);

      return {
  success: true,

  scoreGlobal: riskScore,

  vulnerabilities: vulnerabilities.map((v, i) => ({
    id: `V-${i}`,
    severity: v.severity,
    title: v.type,
    description: v.description,
    fix: v.recommendation
  })),

  recommendations: vulnerabilities.map(v => v.recommendation),

  headers:[],
};

    } catch (error) {
      console.error(" Erreur Audit :", error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AuditService;