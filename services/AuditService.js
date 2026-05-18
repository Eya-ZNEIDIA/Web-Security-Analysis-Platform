const Audit = require("../models/Audit");
const Rapport = require("../models/Rapport");
const Vulnerabilite = require("../models/Vulnerabilite");
const Alert = require("../models/Alert");
const ValidationService = require("./ValidationService");
const DataAnalyzerService = require("./DataAnalyzerService");
const TestEngineService = require("./TestEngineService");
const RiskEngineService = require("./RiskEngineService");
const AIAgentService = require("./AIAgentService");
const RecommendationService = require("./RecommendationService");
const CorrelationEngine = require("./CorrelationEngine");
const Settings = require("../models/Settings");
const NotificationService = require("./NotificationService");

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const PROMPT_VERSION = "v2.0";

class AuditService {
  static async launchAudit({ targetUrl, intensity = "medium", userId }) {
    const auditStart = Date.now();
    const timeline = [];
    const log = (phase, message, meta) => {
      const evt = { ts: new Date(), phase, level: "info", message, meta };
      timeline.push(evt);
      console.log(`[AUDIT][${phase}] ${message ?? ""}`, meta ?? "");
    };
    const warn = (phase, message, meta) => {
      timeline.push({ ts: new Date(), phase, level: "warn", message, meta });
      console.warn(`[AUDIT][${phase}] ${message ?? ""}`, meta ?? "");
    };

    try {
      log("START", `target=${targetUrl} intensity=${intensity}`);
      if (!userId) throw new Error("userId manquant dans AuditService");

      // =========================
      // 1. VALIDATION
      // =========================
      log("VALIDATE", "Validating URL and authorization");
      await ValidationService.validateURL(targetUrl);
      await ValidationService.verifyAuthorization(targetUrl);

      // =========================
      // 2. RECONNAISSANCE
      // =========================
      log("RECON", "Collecting initial data (crawl + fingerprint)");
      const initialData = await DataAnalyzerService.collectInitialData(targetUrl);
      const endpointCount = (initialData.endpoints || []).length;
      log("RECON", `endpoints=${endpointCount} forms=${(initialData.forms || []).length}`);

      // =========================
      // 3. ATTACK PLAN (Ollama planner + PayloadService catalogue)
      // =========================
      log("PLAN", "Generating attack scenarios via Ollama planner");
      const scenarios = await AIAgentService.planAttacks(initialData, intensity);
      const families = Array.from(new Set(scenarios.map(s => s.family || s.type)));
      log("PLAN", `total=${scenarios.length} families=${families.join(",")}`);

      // =========================
      // 4. EXECUTION (baseline diff + full capture)
      // =========================
      log("EXECUTE", `Sending ${scenarios.length} scenarios with concurrency=4`);
      const rawResults = await TestEngineService.executeScenarios(targetUrl, scenarios, { concurrency: 4 });
      log("EXECUTE", `responses=${rawResults.length}`);

      // =========================
      // 5. CORRELATION (anti false-positive)
      // =========================
      log("CORRELATE", "Cross-result analysis");
      const { results: correlated, observations } = CorrelationEngine.analyze(rawResults);
      log("CORRELATE", `observations=${observations.length}`,
        observations.map(o => o.type));

      // =========================
      // 6. TRIAGE (AI confirms TP and provides CVSS/severity)
      // =========================
      log("DETECT", "AI triage of candidates");
      const triagedVulns = await AIAgentService.triageCandidates(correlated, { minConfidence: 0.4 });

      // Add structural pseudo-vulns (missing headers, no rate-limit, stack traces)
      const structuralVulns = CorrelationEngine.observationsToVulnerabilities(observations, targetUrl);
      const allRawVulns = [...triagedVulns, ...structuralVulns];

      const suppressedFP = correlated.filter(r => (r.confidence_raw || 0) >= 0.4).length - triagedVulns.length;
      log("DETECT", `confirmed=${triagedVulns.length} structural=${structuralVulns.length} suppressed_fp=${Math.max(0, suppressedFP)}`);

      // =========================
      // 7. ENRICHMENT (per-vuln contextual fix via Ollama)
      // =========================
      log("ENRICH", `Enriching ${allRawVulns.length} vulnerabilities`);
      const detectedStack = (initialData.headers?.["x-powered-by"] || initialData.server || "").toLowerCase();
      const enrichedList = await Promise.all(
        allRawVulns.map(v =>
          RecommendationService.enrichVulnerability(
            { ...v, stack: detectedStack },
            targetUrl
          )
        )
      );
      const vulnerabilities = allRawVulns.map((v, i) => ({ ...v, ...enrichedList[i] }));

      // =========================
      // 8. RISK SCORING
      // =========================
      log("SCORE", "Computing global risk score");
      const riskScore = RiskEngineService.calculateGlobalRiskScore(vulnerabilities);
      const breakdown = RiskEngineService.breakdown(vulnerabilities);
      const stats = RiskEngineService.statistics(vulnerabilities, {
        totalRequests: rawResults.length,
        totalEndpoints: endpointCount,
        totalPayloads: scenarios.length,
        suppressedFalsePositives: Math.max(0, suppressedFP)
      });
      log("SCORE", `score=${riskScore}`,
        { breakdown, stats });

      // =========================
      // 9. HEADERS NORMALIZATION
      // =========================
      const headersRaw = initialData.headers || [];
      const headers = Array.isArray(headersRaw)
        ? headersRaw
        : Object.entries(headersRaw).map(([key, value]) => ({
            name: key,
            present: value != null,
            critical: false
          }));

      // =========================
      // 10. AUDIT CREATE
      // =========================
      log("REPORT", "Persisting audit + report");
      const durationMs = Date.now() - auditStart;
      const endpointsTested = Array.from(new Set(rawResults.map(r => r.endpoint)));

      const newAudit = await Audit.create({
        userId,
        date: new Date(),
        statut: "terminé",
        urlCible: targetUrl,
        requetes: [],
        reponses: [],
        rapport: null,
        headers,
        scoreGlobal: riskScore,
        durationMs,
        totalRequests: rawResults.length,
        totalEndpoints: endpointsTested.length,
        totalVulnerabilities: vulnerabilities.length,
        intensity
      });

      // =========================
      // 11. SAVE VULNERABILITIES + ALERTS
      // =========================
      const savedVulns = [];
      const alerts = [];
      for (const v of vulnerabilities) {
        const vuln = await Vulnerabilite.create({
          userId,
          auditId: newAudit._id,
          // legacy
          type: v.type || v.family,
          niveauRisque: v.severity || v.niveauRisque || "low",
          description: v.description || v.technical_details || "",
          recommandation: v.recommendation || v.fix_recommendation || "",
          priorite: this._priorityFromSeverity(v.severity),
          category: v.category || v.cwe || "Général",
          risk_score: Number(v.risk_score) || 0,
          // extended
          technique: v.technique || "",
          owasp_category: v.owasp_category || "",
          cwe: v.cwe || "",
          severity: v.severity || "low",
          cvss_score: Number(v.cvss_score) || 0,
          cvss_vector: v.cvss_vector || "",
          endpoint: v.endpoint || "/",
          method: v.method || "GET",
          parameter: v.parameter || "",
          payload: typeof v.payload === "string" ? v.payload : JSON.stringify(v.payload || ""),
          encoding: v.encoding || "raw",
          evidence: v.evidence || "",
          http_response_snippet: v.http_response_snippet || "",
          response_status: v.response_status || null,
          response_headers: v.response_headers || {},
          technical_details: v.technical_details || v.technical_impact || "",
          business_impact: v.business_impact || v.impact || "",
          reproduction_steps: Array.isArray(v.reproduction_steps) ? v.reproduction_steps : [],
          fix_recommendation: v.fix_recommendation || v.recommendation || "",
          secure_code_example: v.secure_code_example || v.secure_fix_example || "",
          headers_to_add: v.headers_to_add || {},
          ai_confidence: typeof v.ai_confidence === "number" ? v.ai_confidence : null,
          detection_source: v.detection_source || "rule",
          is_true_positive: v.is_true_positive !== false,
          detected_at: v.detected_at || new Date()
        });
        savedVulns.push(vuln._id);

        try {
          const alertLevel = AuditService._alertLevelFromSeverity(v.severity);
          const alert = await Alert.create({
            userId,
            auditId: newAudit._id,
            vulnerabiliteId: vuln._id,
            level: alertLevel,
            title: v.type || v.family,
            message: `Nouvelle vulnérabilité détectée: ${v.type || v.family}`,
            description: v.description || v.technical_details || "",
            urlCible: targetUrl,
            read: false
          });
          alerts.push(alert._id);
        } catch (alertErr) {
          warn("ALERT", `Alert creation failed for ${v.type || v.family}: ${alertErr.message}`);
        }
      }

      // =========================
      // 12. REPORT
      // =========================
      const recommendations = vulnerabilities
        .map(v => v.recommendation || v.fix_recommendation)
        .filter(Boolean);

      const exec = this._buildExecutiveSummary({ targetUrl, riskScore, breakdown, stats, vulnerabilities });

      const newReport = await Rapport.create({
        auditId: newAudit._id,
        dateGeneration: new Date(),
        durationMs,
        ai_model: OLLAMA_MODEL,
        ai_prompt_version: PROMPT_VERSION,
        resume: `Audit de sécurité pour ${targetUrl} — score ${riskScore}/100, ${vulnerabilities.length} vulnérabilité(s).`,
        executive_summary: exec,
        scoreGlobal: riskScore,
        risk_breakdown: breakdown,
        statistics: stats,
        endpoints_tested: endpointsTested,
        families_tested: families,
        timeline,
        headers,
        recommendations,
        vulnerabilites: savedVulns
      });

      newAudit.rapport = newReport._id;
      await newAudit.save();
      log("REPORT", `report=${newReport._id} duration=${durationMs}ms`);

      // =========================
      // 13. NOTIFICATIONS
      // =========================
      try {
        log("LOAD_SETTINGS");

        const settings = await Settings.findOneAndUpdate(
          { key: "global" },
          { $setOnInsert: { key: "global" } },
          { new: true, upsert: true }
        ).lean();

        log("SETTINGS", settings);

        if (settings?.notifications?.inAppAlert) {
          log("SEND_AUDIT_NOTIFICATION");

          await NotificationService.createAdminNotification({
            type: "audit_event",
            level: "info",
            title: "Audit terminé",
            message: `Audit terminé pour ${targetUrl}. Score: ${riskScore}`,
            audit: newAudit._id,
            actor: userId
          });

          const hasCritical = vulnerabilities.some(
            x => String(x?.severity).toLowerCase() === "critical"
          );

          log("HAS_CRITICAL", hasCritical);

          if (hasCritical) {
            await NotificationService.createAdminNotification({
              type: "critical_alert",
              level: "critical",
              title: "Alerte critique",
              message: `Vulnérabilité critique détectée sur ${targetUrl}`,
              audit: newAudit._id,
              actor: userId
            });
          }
        }
      } catch (notifErr) {
        log("NOTIFICATION_ERROR", notifErr.message);
      }

      // =========================
      // FINAL RESPONSE
      // =========================
      const result = {
        success: true,
        auditId: newAudit._id,
        reportId: newReport._id,
        score: riskScore,
        scoreGlobal: riskScore,
        headers,
        vulnerabilities,
        vulns: vulnerabilities.map((v, i) => ({
          id: `V-${String(i + 1).padStart(3, "0")}`,
          severity: v.severity || v.niveauRisque || "Moyen",
          title: v.type || v.family || "Vulnérabilité",
          description: v.description || v.technical_details || "",
          endpoint: v.endpoint || "",
          method: v.method || "GET",
          parameter: v.parameter || "",
          payload: typeof v.payload === "string" ? v.payload : JSON.stringify(v.payload || ""),
          evidence: v.evidence || "",
          impact: v.business_impact || v.impact || "",
          reproduction_steps: Array.isArray(v.reproduction_steps) ? v.reproduction_steps : [],
          recommendation: v.fix_recommendation || v.recommendation || "",
          owasp: v.owasp_category || "",
          cwe: v.cwe || "",
          cvss_score: Number(v.cvss_score) || 0,
          code_example: v.secure_code_example || v.secure_fix_example || "",
          technical_details: v.technical_details || "",
          business_impact: v.business_impact || "",
          ai_confidence: typeof v.ai_confidence === "number" ? v.ai_confidence : null,
          detection_source: v.detection_source || "rule",
        })),
        recommendations,
        alerts,
        ssl: /^https:\/\//i.test(String(targetUrl)),
        sslExpiry: initialData.sslExpiry || "N/A",
        redirect: initialData.redirect !== false,
        server: initialData.server || "Unknown",
        statusCode: initialData.statusCode || 200,
        ttfbMs: initialData.ttfbMs || 0,
        dnsMs: initialData.dnsMs || 0,
        tcpMs: initialData.tcpMs || 0,
        tlsMs: initialData.tlsMs || 0,
        ip: initialData.ip || "",
        tls: initialData.tls || "",
        bytes: initialData.bytes || 0,
        reportMeta: {
          durationMs,
          ai_model: OLLAMA_MODEL,
          ai_prompt_version: PROMPT_VERSION,
          executive_summary: exec,
          risk_breakdown: breakdown,
          statistics: stats,
          endpoints_tested: endpointsTested,
          families_tested: families,
          timeline,
        },
      };

      log("FINAL_RESULT", { auditId: newAudit._id, reportId: newReport._id, score: riskScore, vulns: vulnerabilities.length });

      return result;

    } catch (error) {
      log("ERROR", error.message);

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
            actor: userId || null
          });
        }
      } catch (e) {
        log("NOTIFICATION_FAIL", e.message);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  static _priorityFromSeverity(sev) {
    const s = String(sev || "").toLowerCase();
    if (s === "critical") return "haute";
    if (s === "high") return "haute";
    if (s === "medium") return "moyenne";
    if (s === "low") return "basse";
    return "à définir";
  }

  static _alertLevelFromSeverity(sev) {
    const s = String(sev || "").toLowerCase();
    if (s === "critical" || s === "critique") return "Critique";
    if (s === "high" || s === "élevé" || s === "eleve" || s === "éleve") return "Élevé";
    if (s === "medium" || s === "moyen") return "Moyen";
    if (s === "low" || s === "faible") return "Faible";
    return "Faible";
  }

  static _buildExecutiveSummary({ targetUrl, riskScore, breakdown, stats, vulnerabilities }) {
    const { critical = 0, high = 0, medium = 0, low = 0, info = 0 } = breakdown || {};
    const total = vulnerabilities.length;

    const topByCvss = [...vulnerabilities]
      .sort((a, b) => (Number(b.cvss_score) || 0) - (Number(a.cvss_score) || 0))
      .slice(0, 3)
      .map(v => `${v.severity?.toUpperCase() || "LOW"} • ${v.type || v.family} on ${v.endpoint} (CVSS ${v.cvss_score || "?"})`);

    const verdict = riskScore >= 80 ? "Faible exposition"
                  : riskScore >= 50 ? "Exposition modérée"
                  : riskScore >= 30 ? "Exposition élevée"
                                    : "Exposition critique";

    return [
      `Cible : ${targetUrl}`,
      `Verdict : ${verdict} — score ${riskScore}/100.`,
      `Vulnérabilités confirmées : ${total} (critique=${critical}, haute=${high}, moyenne=${medium}, basse=${low}, info=${info}).`,
      `Surface testée : ${stats.total_endpoints} endpoint(s), ${stats.total_payloads} payloads, ${stats.total_requests} requêtes envoyées.`,
      `Faux positifs supprimés : ${stats.suppressed_false_positives}. Confiance IA moyenne : ${stats.avg_confidence}.`,
      topByCvss.length ? `Top risques :\n  - ${topByCvss.join("\n  - ")}` : ""
    ].filter(Boolean).join("\n");
  }
}

module.exports = AuditService;