const Audit = require("../models/Audit");
const Rapport = require("../models/Rapport");
const Vulnerabilite = require("../models/Vulnerabilite");
const Alert = require("../models/Alert");
const ValidationService = require("./ValidationService");
const DataAnalyzerService = require("./DataAnalyzerService");
const TestEngineService = require("./TestEngineService");
const RiskEngineService = require("./RiskEngineService");
const AIAgentService = require("./AIAgentService");
const Settings = require("../models/Settings"); // Assurez-vous que ce modèle existe
const NotificationService = require("./NotificationService"); // idem

class AuditService {
  static async launchAudit({ targetUrl, intensity = "medium", userId }) {
    try {
      console.log("AuditService: userId reçu =", userId);
      if (!userId) throw new Error("userId manquant dans AuditService");

      console.log("Lancement audit :", targetUrl);

      // 🔹 Validation et autorisation
      await ValidationService.validateURL(targetUrl);
      await ValidationService.verifyAuthorization(targetUrl);

      // 🔹 Collecte des données et analyse
      const initialData = await DataAnalyzerService.collectInitialData(targetUrl);
      const scenarios = await AIAgentService.generateTestScenarios(initialData, intensity);
      const rawResults = await TestEngineService.executeScenarios(targetUrl, scenarios);
      const technicalAnalysis = DataAnalyzerService.analyzeRawResults(rawResults);
      const vulnerabilities = await AIAgentService.analyzeSecurityResults(technicalAnalysis);
      const riskScore = RiskEngineService.calculateGlobalRiskScore(vulnerabilities);

      // 🔹 Préparation des headers
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
        headers,
        recommendations,
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
          category: v.category || "Général",
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
      }

      // 🔹 Création Rapport
      const newReport = await Rapport.create({
        dateGeneration: new Date(),
        resume: `Audit pour ${targetUrl}`,
        scoreGlobal: riskScore,
        vulnerabilites: savedVulns,
        headers,
        recommendations
      });

      newAudit.rapport = newReport._id;
      await newAudit.save();

      // 🔹 Notifications admin (in-app)
      try {
        const settings = await Settings.findOneAndUpdate(
          { key: "global" },
          { $setOnInsert: { key: "global" } },
          { new: true, upsert: true }
        ).lean();

        if (settings?.notifications?.inAppAlert) {
          await NotificationService.createAdminNotification({
            type: "audit_event",
            level: "info",
            title: "Audit terminé",
            message: `Audit terminé pour ${targetUrl}. Score global: ${riskScore}`,
            audit: newAudit._id,
            actor: userId || null,
          });

          const hasCritical = vulnerabilities.some(
            x => String(x?.severity).toLowerCase() === "critical"
          );

          if (hasCritical) {
            await NotificationService.createAdminNotification({
              type: "critical_alert",
              level: "critical",
              title: "Alerte critique",
              message: `Vulnérabilité critique détectée sur ${targetUrl}.`,
              audit: newAudit._id,
              actor: userId || null,
            });
          }
        }
      } catch (e) {
        console.error("[AUDIT][NOTIF] failed:", e.message);
      }

      // 🔹 Retourner réponse
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
        recommendations,
        alerts
      };
    } catch (error) {
      console.error("Erreur Audit :", error.message);

      try {
        const settings = await Settings.findOneAndUpdate(
          { key: "global" },
          { $setOnInsert: { key: "global" } },
          { new: true, upsert: true }
        ).lean();

        if (settings?.notifications?.inAppAlert) {
          await NotificationService.createAdminNotification({
            type: "audit_event",
            level: "warning",
            title: "Audit échoué",
            message: `Audit échoué pour ${targetUrl}: ${error.message}`,
            actor: userId || null,
          });
        }
      } catch (e) {
        console.error("[AUDIT][NOTIF] audit_failed notification failed:", e.message);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = AuditService;