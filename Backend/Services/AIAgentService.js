const { Ollama } = require("ollama");

const ollama = new Ollama({
  host: "http://127.0.0.1:11434"
});

class AIAgentService {
  // -----------------------------
  // Helpers: normalisation / extraction
  // -----------------------------
  static _normalizeEndpoint(ep) {
    if (!ep) return "/";
    const s = String(ep).trim();
    // Convert full URL to path
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
    // Tries to adapt to many shapes of technicalResults entries
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

    // Build a searchable blob for deterministic pattern checks
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

  // -----------------------------
  // Deterministic risk score formula (0..100)
  // -----------------------------
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

    // Strong server-side error indicators
    const sqlError =
      /(sql syntax|mysql|psql|postgres|sqlite|oracle|odbc|jdbc|syntax error|unterminated|sqlstate|query failed)/i.test(
        b
      );

    // ✅ FIXED REGEX (no unterminated group)
    const cmdError =
      /(command not found|cannot execute|sh:|bash:|powershell|cmd\.exe|permission denied)/i.test(
        b
      );

    const pathError =
      /(no such file|file not found|failed to open stream|directory traversal|invalid path|not a directory)/i.test(
        b
      );

    const ssrfHints =
      /(169\.254\.169\.254|metadata|aws_ec2|gcp metadata|instance\/service-accounts|localhost|127\.0\.0\.1|internal)/i.test(
        b
      );

    const openRedirectHints =
      /(location:\s*(https?:)?\/\/|302|301)/i.test(b) && /(redirect|returnto=|next=|url=)/i.test(b);

    if (t === "SQLI" && sqlError) score += 15;
    if (t === "CMDI" && cmdError) score += 15;
    if (t === "PATH_TRAVERSAL" && pathError) score += 12;
    if (t === "SSRF" && ssrfHints) score += 12;
    if (t === "OPEN_REDIRECT" && openRedirectHints) score += 10;

    // Reflected payload check
    if (signals.payload && signals.responseBody) {
      const payloadLower = String(signals.payload).toLowerCase();
      const bodyLower = String(signals.responseBody).toLowerCase();
      if (payloadLower.length >= 6 && bodyLower.includes(payloadLower)) {
        if (t === "XSS") score += 20;
        else score += 6;
      }
    }

    // Status code heuristics
    if (signals.status) {
      if (signals.status >= 500) score += 8;
      if (signals.status === 200) score += 3;
      if (signals.status === 302 || signals.status === 301) score += t === "OPEN_REDIRECT" ? 8 : 2;
      if (signals.status === 401 || signals.status === 403) score -= 10;
      if (signals.status === 404) score -= 5;
    }

    // Method heuristic
    if (signals.method === "POST" || signals.method === "PUT" || signals.method === "PATCH") score += 3;

    // IDOR heuristics
    if (t === "IDOR") {
      if (/(id=|user_id|account_id|order_id|invoice_id|profile_id)/i.test(b)) score += 8;
      if (/(forbidden|unauthorized|permission|access denied)/i.test(b)) score -= 8;
      if ((signals.status === 200) && /(id=|user_id|account_id)/i.test(b)) score += 5;
    }

    // Mitigation headers reduce XSS risk a bit
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

  // -----------------------------
  // 1) Generate test scenarios
  // -----------------------------
  static async generateTestScenarios(context, intensity) {
    if ((!context.endpoints || context.endpoints.length === 0) && (!context.forms || context.forms.length === 0)) {
      context.endpoints = ["/"];
    }

    const prompt = `
Tu es un expert en cybersécurité opérant dans un cadre légal et défensif.

Informations sur la cible :

Server : ${context.server || "inconnu"}

Headers :
${JSON.stringify(context.headers, null, 2)}

Endpoints détectés :
${JSON.stringify(context.endpoints, null, 2)}

Forms détectés :
${JSON.stringify(context.forms, null, 2)}

Niveau d'intensité : ${intensity}

Tâche : Génère EXACTEMENT 40 scénarios répartis comme suit : - 6 XSS - 6 SQL Injection - 6 Command Injection - 6 Path Traversal - 6 Open Redirect - 5 SSRF - 5 IDOR

Si aucun endpoint n’est détecté, crée des tests basés sur les headers et la configuration du serveur.

Return ONLY a valid JSON array.
No explanation.
No markdown.
No text before or after.
If you fail, return [].

Format :
[
 {
   "type": "XSS",
   "endpoint": "/search",
   "parameter": "q",
   "payload": "<script>alert(1)</script>"
 }
]

Ne rajoute aucun texte avant ou après.
`;

    try {
      const response = await ollama.chat({
        model: "llama3.1",
        temperature: 0.8,
        max_tokens: 3000,
        messages: [
          { role: "system", content: "Tu es un agent IA spécialisé en audit de sécurité défensive." },
          { role: "user", content: prompt }
        ]
      });

      const raw = response.message.content;

      let scenarios = [];
      try {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          scenarios = JSON.parse(raw.substring(start, end + 1));
        } else {
          console.log("No JSON found in AI response");
        }
      } catch (e) {
        console.log("JSON parse error:", e.message);
        console.log("RAW AI:", raw);
        scenarios = [];
      }

      scenarios = (scenarios || []).map(s => ({
        type: s.type || "TEST",
        endpoint: this._normalizeEndpoint(s.endpoint || ""),
        parameter: s.parameter || "test",
        payload: s.payload || "test"
      }));

      scenarios = Array.from(
        new Map(scenarios.map(s => [s.type + s.endpoint + s.parameter + s.payload, s])).values()
      );

      console.log("Scenarios générés:", scenarios);
      return scenarios;
    } catch (error) {
      console.log("Erreur génération scénarios IA :", error.message);
      return [];
    }
  }

  // -----------------------------
  // 2) Analyze results (AI classifies, code scores deterministically)
  // -----------------------------
  static async analyzeSecurityResults(technicalResults) {
    const prompt = `
Tu es un expert en analyse de vulnérabilités défensives.

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
   "evidence": "preuve courte basée sur les résultats fournis",
   "description": "Description courte.",
   "recommendation": "Recommandation concrète."
 }
]

Return ONLY a valid JSON array.
No explanation.
No markdown.
No text before or after.
If you fail, return [].
`;

    try {
      const response = await ollama.chat({
        model: "llama3.1",
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          { role: "system", content: "Tu es un expert en analyse de vulnérabilités défensives." },
          { role: "user", content: prompt }
        ]
      });

      const raw = response.message.content;

      let findings = [];
      try {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          findings = JSON.parse(raw.substring(start, end + 1));
        }
      } catch (e) {
        console.log("JSON parse error:", e.message);
        console.log("RAW AI:", raw);
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

      let vulnerabilities = (findings || []).map(v => {
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
          risk_score,
          severity,
          endpoint,
          parameter,
          evidence: v.evidence || "",
          description: v.description || "",
          recommendation: v.recommendation || ""
        };
      });

      vulnerabilities = Array.from(
        new Map(
          vulnerabilities.map(v => [
            `${v.type}|${v.endpoint}|${v.parameter}|${v.category}|${v.risk_score}`,
            v
          ])
        ).values()
      );

      return vulnerabilities;
    } catch (error) {
      console.log("Erreur parsing JSON vulnérabilités IA :", error.message);
      return [];
    }
  }
}

module.exports = AIAgentService;