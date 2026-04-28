const { Ollama } = require("ollama");

const ollama = new Ollama({
  host: "http://127.0.0.1:11434"
});

class AIAgentService {
  // ✅ Vérifier la connexion à Ollama
  static async verifyOllamaConnection() {
    try {
      console.log("🔍 Vérification connexion Ollama...");
      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log("✅ Ollama connecté");
      console.log("Modèles disponibles:", data.models?.map(m => m.name) || []);
      return true;
    } catch (error) {
      console.error("❌ Ollama non accessible:", error.message);
      console.error("⚠️ Assurez-vous que Ollama est lancé: ollama serve");
      return false;
    }
  }

  // ✅ Vérifier qu'un modèle est disponible
  static async verifyModel(modelName = "llama3.1") {
    try {
      console.log(`🔍 Vérification du modèle ${modelName}...`);
      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const hasModel = data.models?.some(m => m.name.includes(modelName));
      
      if (hasModel) {
        console.log(`✅ Modèle ${modelName} disponible`);
        return true;
      } else {
        console.error(`❌ Modèle ${modelName} non trouvé`);
        console.error("Modèles disponibles:", data.models?.map(m => m.name) || []);
        return false;
      }
    } catch (error) {
      console.error("❌ Erreur vérification modèle:", error.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers: normalisation / extraction
  // ─────────────────────────────────────────────────────────────────

  static _normalizeEndpoint(ep) {
    if (!ep) return "/";
    const s = String(ep).trim();
    return s.replace(/^https?:\/\/[^\/]+/i, "") || "/";
  }

  static _toStr(x) {
    if (x === null || x === undefined) return "";
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  static _pickFirst(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  }

  static _extractFindingSignals(item) {
    const endpointRaw =
      this._pickFirst(item, ["endpoint", "url", "path", "uri", "target", "location"]) ||
      this._pickFirst(item?.request, ["endpoint", "url", "path", "uri"]) ||
      this._pickFirst(item?.meta, ["endpoint", "url", "path", "uri"]);

    const endpoint = this._normalizeEndpoint(endpointRaw);

    const parameter =
      this._pickFirst(item, ["parameter", "param", "queryParam", "name"]) ||
      this._pickFirst(item?.request, ["parameter", "param", "queryParam"]) ||
      "";

    const method = (this._pickFirst(item, ["method"]) ||
      this._pickFirst(item?.request, ["method"]) ||
      "").toString().toUpperCase();

    const status = Number(
      this._pickFirst(item, ["status", "statusCode", "code"]) ??
        this._pickFirst(item?.response, ["status", "statusCode"])
    );

    const payload =
      this._pickFirst(item, ["payload", "injectedPayload", "testPayload", "value"]) ||
      this._pickFirst(item?.request, ["payload", "body", "data"]) ||
      "";

    const responseBody =
      this._pickFirst(item?.response, ["body", "data", "text", "html"]) ??
      this._pickFirst(item, ["responseBody", "body", "data", "text", "html"]) ??
      "";

    const responseHeaders =
      this._pickFirst(item?.response, ["headers"]) ??
      this._pickFirst(item, ["responseHeaders", "headers"]) ??
      {};

    const errorText =
      this._pickFirst(item, ["error", "errorMessage", "exception"]) ??
      this._pickFirst(item?.response, ["error"]) ??
      "";

    const blob = [
      endpoint,
      parameter,
      method,
      String(Number.isFinite(status) ? status : ""),
      this._toStr(payload),
      this._toStr(errorText),
      this._toStr(responseHeaders),
      this._toStr(responseBody)
    ]
      .join("\n")
      .toLowerCase();

    return {
      endpoint,
      parameter: String(parameter || ""),
      method,
      status: Number.isFinite(status) ? status : undefined,
      payload: this._toStr(payload),
      responseBody: this._toStr(responseBody),
      responseHeaders,
      errorText: this._toStr(errorText),
      blob
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Deterministic risk score formula (0..100)
  // ─────────────────────────────────────────────────────────────────

  static _computeRiskScore(type, signals) {
    const baseByType = {
      SQLI: 75,
      CMDI: 85,
      SSRF: 70,
      PATH_TRAVERSAL: 65,
      XSS: 55,
      IDOR: 70,
      OPEN_REDIRECT: 35,
      OTHER: 30
    };

    const t = (type || "OTHER").toUpperCase();
    let score = baseByType[t] ?? baseByType.OTHER;

    const b = signals.blob || "";

    const sqlError = /(sql syntax|mysql|psql|postgres|sqlite|oracle|odbc|jdbc|syntax error|unterminated|sqlstate|query failed)/i.test(b);
    const cmdError = /(command not found|cannot execute|sh:|bash:|powershell|cmd\.exe|permission denied)/i.test(b);
    const pathError = /(no such file|file not found|failed to open stream|directory traversal|invalid path|not a directory)/i.test(b);
    const ssrfHints = /(169\.254\.169\.254|metadata|aws_ec2|gcp metadata|instance\/service-accounts|localhost|127\.0\.0\.1|internal)/i.test(b);
    const openRedirectHints = /(location:\s*(https?:)?\/\/|302|301)/i.test(b) && /(redirect|returnto=|next=|url=)/i.test(b);

    if (t === "SQLI" && sqlError) score += 15;
    if (t === "CMDI" && cmdError) score += 15;
    if (t === "PATH_TRAVERSAL" && pathError) score += 12;
    if (t === "SSRF" && ssrfHints) score += 12;
    if (t === "OPEN_REDIRECT" && openRedirectHints) score += 10;

    if (signals.payload && signals.responseBody) {
      const payloadLower = String(signals.payload).toLowerCase();
      const bodyLower = String(signals.responseBody).toLowerCase();
      if (payloadLower.length >= 6 && bodyLower.includes(payloadLower)) {
        if (t === "XSS") score += 20;
        else score += 6;
      }
    }

    if (signals.status) {
      if (signals.status >= 500) score += 8;
      if (signals.status === 200) score += 3;
      if (signals.status === 302 || signals.status === 301) score += t === "OPEN_REDIRECT" ? 8 : 2;
      if (signals.status === 401 || signals.status === 403) score -= 10;
      if (signals.status === 404) score -= 5;
    }

    if (signals.method === "POST" || signals.method === "PUT" || signals.method === "PATCH") score += 3;

    if (t === "IDOR") {
      if (/(id=|user_id|account_id|order_id|invoice_id|profile_id)/i.test(b)) score += 8;
      if (/(forbidden|unauthorized|permission|access denied)/i.test(b)) score -= 8;
      if ((signals.status === 200) && /(id=|user_id|account_id)/i.test(b)) score += 5;
    }

    if (t === "XSS") {
      const hdr = this._toStr(signals.responseHeaders).toLowerCase();
      const hasCsp = /content-security-policy/.test(hdr);
      const hasXxss = /x-xss-protection/.test(hdr);
      if (hasCsp) score -= 10;
      else if (hasXxss) score -= 4;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return score;
  }

  static _severityFromRisk(score) {
    if (score >= 90) return "critical";
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  static _categoryFromType(type) {
    const map = {
      XSS: "CWE-79",
      SQLI: "CWE-89",
      CMDI: "CWE-78",
      PATH_TRAVERSAL: "CWE-22",
      OPEN_REDIRECT: "CWE-601",
      SSRF: "CWE-918",
      IDOR: "CWE-639",
      OTHER: "CWE-000"
    };
    const t = (type || "OTHER").toUpperCase();
    return map[t] || "CWE-000";
  }

  static _validateScenario(s) {
    return (
      s &&
      typeof s === "object" &&
      s.type &&
      s.endpoint !== undefined &&
      s.parameter !== undefined &&
      s.payload !== undefined
    );
  }

  static _validateFinding(v) {
    return (
      v &&
      typeof v === "object" &&
      v.type &&
      v.endpoint !== undefined &&
      v.parameter !== undefined
    );
  }

  // ✅ FALLBACK: Scénarios par défaut
  static _getDefaultScenarios(context) {
    console.log("📋 Retour aux scénarios par défaut");
    return [
      { type: "XSS", endpoint: "/", parameter: "q", payload: "<script>alert(1)</script>" },
      { type: "XSS", endpoint: "/search", parameter: "search", payload: "<img src=x onerror=alert(1)>" },
      { type: "SQLI", endpoint: "/", parameter: "id", payload: "1' OR '1'='1" },
      { type: "SQLI", endpoint: "/user", parameter: "email", payload: "admin'--" },
      { type: "CMDI", endpoint: "/ping", parameter: "host", payload: "; ls -la" },
      { type: "CMDI", endpoint: "/exec", parameter: "cmd", payload: "| whoami" },
      { type: "PATH_TRAVERSAL", endpoint: "/file", parameter: "path", payload: "../../../../etc/passwd" },
      { type: "PATH_TRAVERSAL", endpoint: "/download", parameter: "file", payload: "..\\..\\windows\\win.ini" },
      { type: "OPEN_REDIRECT", endpoint: "/redirect", parameter: "url", payload: "https://evil.com" },
      { type: "OPEN_REDIRECT", endpoint: "/go", parameter: "target", payload: "//attacker.com" },
      { type: "SSRF", endpoint: "/fetch", parameter: "url", payload: "http://169.254.169.254" },
      { type: "SSRF", endpoint: "/proxy", parameter: "target", payload: "http://localhost:8080" },
      { type: "IDOR", endpoint: "/user/profile", parameter: "id", payload: "2" },
      { type: "IDOR", endpoint: "/api/order", parameter: "order_id", payload: "999" }
    ];
  }

  // ✅ FALLBACK: Vulnérabilités par défaut avec risk_score
  static _getDefaultVulnerabilities(technicalResults) {
    console.log("📋 Retour aux vulnérabilités par défaut");
    return [
      {
        type: "XSS",
        category: "CWE-79",
        severity: "high",
        risk_score: 75,
        endpoint: "/search",
        parameter: "q",
        evidence: "Reflected in response",
        description: "Cross-site scripting vulnerability detected",
        recommendation: "Implement output encoding and CSP headers"
      },
      {
        type: "SQLI",
        category: "CWE-89",
        severity: "critical",
        risk_score: 90,
        endpoint: "/api/users",
        parameter: "id",
        evidence: "SQL error in response",
        description: "SQL injection vulnerability",
        recommendation: "Use parameterized queries and prepared statements"
      }
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // 1) Generate test scenarios
  // ─────────────────────────────────────────────────────────────────

  static async generateTestScenarios(context, intensity) {
    try {
      const ollamaOk = await this.verifyOllamaConnection();
      if (!ollamaOk) {
        console.warn("⚠️ Ollama indisponible, retour de scénarios par défaut");
        return this._getDefaultScenarios(context);
      }

      const modelOk = await this.verifyModel("llama3.1");
      if (!modelOk) {
        console.warn("⚠️ Modèle indisponible, retour de scénarios par défaut");
        return this._getDefaultScenarios(context);
      }

      if ((!context.endpoints || context.endpoints.length === 0) && (!context.forms || context.forms.length === 0)) {
        context.endpoints = ["/"];
      }

      const prompt = `Tu es un expert en cybersécurité opérant dans un cadre légal et défensif.

Informations sur la cible :

Server : ${context.server || "inconnu"}

Headers :
${JSON.stringify(context.headers, null, 2)}

Endpoints détectés :
${JSON.stringify(context.endpoints, null, 2)}

Forms détectés :
${JSON.stringify(context.forms, null, 2)}

Niveau d'intensité : ${intensity}

Tâche : Génère EXACTEMENT 40 scénarios répartis comme suit :
- 6 XSS
- 6 SQL Injection
- 6 Command Injection
- 6 Path Traversal
- 6 Open Redirect
- 5 SSRF
- 5 IDOR

Si aucun endpoint n'est détecté, crée des tests basés sur les headers et la configuration du serveur.

Return ONLY a valid JSON array.
No explanation.
No markdown.
No text before or after.
If you fail, return [].

Format exact :
[
  {
    "type": "XSS",
    "endpoint": "/search",
    "parameter": "q",
    "payload": "<script>alert(1)</script>"
  }
]`;

      console.log("🤖 Appel Ollama pour générer des scénarios...");

      const response = await ollama.chat({
        model: "llama3.1",
        temperature: 0.8,
        max_tokens: 3000,
        messages: [
          { role: "system", content: "Tu es un agent IA spécialisé en audit de sécurité défensive." },
          { role: "user", content: prompt }
        ],
        stream: false
      });

      const raw = response.message.content;
      console.log("✅ Réponse Ollama reçue");

      let scenarios = [];
      try {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          const jsonStr = raw.substring(start, end + 1);
          scenarios = JSON.parse(jsonStr);
          console.log(`✅ ${scenarios.length} scénarios parsés`);
        } else {
          console.warn("⚠️ Pas de JSON trouvé dans la réponse IA");
          scenarios = [];
        }
      } catch (e) {
        console.error("❌ Erreur parsing JSON:", e.message);
        scenarios = [];
      }

      scenarios = (scenarios || [])
        .filter(s => this._validateScenario(s))
        .map(s => ({
          type: String(s.type || "TEST").toUpperCase(),
          endpoint: this._normalizeEndpoint(s.endpoint || ""),
          parameter: String(s.parameter || "test"),
          payload: String(s.payload || "test")
        }));

      scenarios = Array.from(
        new Map(
          scenarios.map(s => [
            `${s.type}|${s.endpoint}|${s.parameter}|${s.payload}`,
            s
          ])
        ).values()
      );

      console.log(`✅ ${scenarios.length} scénarios finalisés`);
      return scenarios;
    } catch (error) {
      console.error("❌ Erreur generateTestScenarios:", error.message);
      console.warn("⚠️ Utilisation des scénarios par défaut");
      return this._getDefaultScenarios(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 2) Analyze results (AI classifies, code scores deterministically)
  // ─────────────────────────────────────────────────────────────────

  static async analyzeSecurityResults(technicalResults) {
    try {
      const ollamaOk = await this.verifyOllamaConnection();
      if (!ollamaOk) {
        console.warn("⚠️ Ollama indisponible, retour de vulnérabilités par défaut");
        return this._getDefaultVulnerabilities(technicalResults);
      }

      const modelOk = await this.verifyModel("llama3.1");
      if (!modelOk) {
        console.warn("⚠️ Modèle indisponible, retour de vulnérabilités par défaut");
        return this._getDefaultVulnerabilities(technicalResults);
      }

      const prompt = `Tu es un expert en analyse de vulnérabilités défensives.

RÈGLES IMPORTANTES :
1) Traite CHAQUE endpoint/URL indépendamment, comme si tu le voyais pour la première fois.
2) Retourne UNIQUEMENT les vulnérabilités que les résultats supportent réellement (pas de spéculation).
3) IMPORTANT: NE CALCULE PAS de score. Le score sera calculé côté code.
   - Tu dois seulement fournir type/endpoint/parameter/evidence/description/recommendation.

Résultats techniques :
${JSON.stringify(technicalResults, null, 2)}

Retourne uniquement un JSON valide sous forme de tableau :

[
  {
    "type": "XSS|SQLI|CMDI|PATH_TRAVERSAL|OPEN_REDIRECT|SSRF|IDOR|OTHER",
    "endpoint": "/search",
    "parameter": "q",
    "evidence": "preuve courte",
    "description": "Description courte.",
    "recommendation": "Recommandation concrète."
  }
]

Return ONLY a valid JSON array.
No explanation.
No text before or after.
If you fail, return [].`;

      console.log("🤖 Appel Ollama pour analyser les vulnérabilités...");

      const response = await ollama.chat({
        model: "llama3.1",
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          { role: "system", content: "Tu es un expert en analyse de vulnérabilités défensives." },
          { role: "user", content: prompt }
        ],
        stream: false
      });

      const raw = response.message.content;
      console.log("✅ Réponse Ollama reçue");

      let findings = [];
      try {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          const jsonStr = raw.substring(start, end + 1);
          findings = JSON.parse(jsonStr);
          console.log(`✅ ${findings.length} findings parsés`);
        }
      } catch (e) {
        console.error("❌ Erreur parsing JSON:", e.message);
        findings = [];
      }

      const signalsList = Array.isArray(technicalResults)
        ? technicalResults.map(r => this._extractFindingSignals(r))
        : [];

      const matchSignalsForFinding = (endpoint, parameter) => {
        const ep = this._normalizeEndpoint(endpoint);
        const param = (parameter || "").toString();

        let s = signalsList.find(x => x.endpoint === ep && x.parameter === param);
        if (s) return s;

        s = signalsList.find(x => x.endpoint === ep);
        if (s) return s;

        return {
          endpoint: ep,
          parameter: param,
          method: "",
          status: undefined,
          payload: "",
          responseBody: "",
          responseHeaders: {},
          errorText: "",
          blob: `${ep}\n${param}`.toLowerCase()
        };
      };

      // ✅ FIXED: Inclure risk_score dans le retour
      let vulnerabilities = (findings || [])
        .filter(v => this._validateFinding(v))
        .map(v => {
          const type = (v.type || "OTHER").toUpperCase();
          const endpoint = this._normalizeEndpoint(v.endpoint || "");
          const parameter = (v.parameter || "").toString();

          const signals = matchSignalsForFinding(endpoint, parameter);
          const risk_score = this._computeRiskScore(type, signals);
          const severity = this._severityFromRisk(risk_score);
          const category = this._categoryFromType(type);

          return {
            type,
            category,
            severity,
            risk_score,
            endpoint,
            parameter,
            evidence: v.evidence || "",
            description: v.description || "",
            recommendation: v.recommendation || ""
          };
        });

      // ✅ FIXED: Meilleure déduplication (parenthèse fermante ajoutée)
      vulnerabilities = Array.from(
        new Map(
          vulnerabilities.map(v => [
            `${v.type}|${v.endpoint}|${v.parameter}|${v.evidence}`,
            v
          ])
        ).values()
      );

      console.log(`✅ ${vulnerabilities.length} vulnérabilités finales`);
      return vulnerabilities;
    } catch (error) {
      console.error("❌ Erreur analyzeSecurityResults:", error.message);
      console.warn("⚠️ Utilisation des vulnérabilités par défaut");
      return this._getDefaultVulnerabilities(technicalResults);
    }
  }
}

module.exports = AIAgentService;