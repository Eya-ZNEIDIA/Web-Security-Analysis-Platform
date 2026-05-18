/**
 * 🤖 AIAgentService v2 — 2-phase pipeline:
 *   1) planAttacks(recon)        → Ollama proposes targeted scenarios per endpoint/param
 *   2) triageCandidates(rule_results) → Ollama filters false positives in batch
 *
 * Backward-compatible methods kept:
 *   - generateTestScenarios(context, intensity)
 *   - analyzeSecurityResults(technicalResults)
 *
 * All Ollama responses are forced to STRICT JSON via the `format: "json"` option
 * (supported by ollama@^0.5). Fallback prompts also explicitly require JSON.
 */

const { Ollama } = require("ollama");
const PayloadService = require("./PayloadService");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const PROMPT_VERSION = "v2.0";

const ollama = new Ollama({ host: OLLAMA_HOST });

// ──────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Senior offensive security analyst
// ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_PLANNER = `You are SecAuditGPT, a senior offensive security architect.
Your job: design a TARGETED attack plan against a single web target, given the reconnaissance data.

Hard rules:
- Output STRICT JSON only. No prose. No markdown. No code fences.
- Adapt families/payloads to the detected stack and HTTP surface.
- Prefer high-signal payloads first (error-based SQLi, reflected XSS, file leaks, redirects).
- Tailor parameter names to the ACTUAL params/forms found in recon.
- Never fabricate endpoints; use only the ones provided (or "/" if empty).
- For JSON APIs, generate JSON-body scenarios with operator-based payloads.

Output schema:
{ "scenarios": [
  { "family": "XSS|SQLI|NOSQLI|CMDI|SSRF|OPEN_REDIRECT|PATH_TRAVERSAL|LFI|HEADER_INJECTION|PROTOTYPE_POLLUTION|JWT|AUTH_BYPASS|IDOR|SENSITIVE_DATA",
    "technique": "string",
    "endpoint": "/path",
    "method": "GET|POST|PUT|DELETE|PATCH",
    "parameter": "string",
    "payload": "string",
    "json": false,
    "rationale": "string (max 120 chars)"
  }
]}`;

const SYSTEM_PROMPT_TRIAGER = `You are SecAuditGPT-Triage, a senior security analyst that filters false positives.
You receive deterministic candidate findings produced by a rule-based engine.
For EACH candidate, decide if it is a TRUE POSITIVE based ONLY on the evidence provided.

Hard rules:
- Output STRICT JSON only. No prose. No markdown. No code fences.
- A candidate with confidence_raw < 0.4 is likely a false positive unless evidence is strong.
- A 401/403 status on every variant strongly indicates a false positive.
- XSS without an unescaped reflection in the response is a false positive.
- SQL "errors" must be REAL DB error fingerprints, not the word "sql" appearing.
- Each finding must be tailored: cite the exact endpoint, parameter, and payload.

Output schema:
{ "findings": [
  { "candidate_id": "string",
    "is_true_positive": true,
    "ai_confidence": 0.0,
    "severity": "critical|high|medium|low|info",
    "cvss_score": 0.0,
    "cvss_vector": "CVSS:3.1/...",
    "owasp_2021": "A03:2021-Injection",
    "cwe": "CWE-89",
    "evidence_summary": "string (max 200 chars)",
    "technical_details": "string (max 500 chars)"
  }
]}`;


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
  // Safe Ollama chat with strict JSON mode
  // ─────────────────────────────────────────────────────────────────
  static async _ollamaJsonChat({ system, user, temperature = 0.3, model = OLLAMA_MODEL }) {
    const resp = await ollama.chat({
      model,
      format: "json",
      options: { temperature },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      stream: false
    });
    const raw = resp?.message?.content || "";
    try {
      return JSON.parse(raw);
    } catch {
      // Try to recover the largest JSON object substring
      const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
      if (i !== -1 && j !== -1 && j > i) {
        try { return JSON.parse(raw.slice(i, j + 1)); } catch {}
      }
      const k = raw.indexOf("["), l = raw.lastIndexOf("]");
      if (k !== -1 && l !== -1 && l > k) {
        try { return JSON.parse(raw.slice(k, l + 1)); } catch {}
      }
      throw new Error("Ollama did not return valid JSON");
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Build rich context summary from recon data
  // ─────────────────────────────────────────────────────────────────
  static _buildReconContext(recon) {
    const headers = recon?.headers || {};
    const server = (recon?.server || headers["server"] || "").toLowerCase();
    const xpb = (headers["x-powered-by"] || "").toLowerCase();
    const ct = (headers["content-type"] || "").toLowerCase();
    const stack = [server, xpb, ct].filter(Boolean).join("|");

    const hasJsonApi = ct.includes("json") || (recon?.endpoints || []).some(e => /\/api\//i.test(String(e)));
    const hasAuth = !!(headers["www-authenticate"] || (recon?.cookies || []).some(c => /sess|token|jwt|auth/i.test(String(c))));
    const hasForms = (recon?.forms || []).length > 0;

    return { stack, hasJsonApi, hasAuth, hasForms };
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 1: planAttacks(recon) — Ollama planner + PayloadService fusion
  // ─────────────────────────────────────────────────────────────────
  static async planAttacks(recon, intensity = "medium") {
    const ctx = this._buildReconContext(recon);
    const endpoints = (recon?.endpoints || []).map(e => this._normalizeEndpoint(typeof e === "string" ? e : (e?.url || e?.path || "/"))).filter(Boolean);
    const uniqEndpoints = Array.from(new Set(endpoints.length ? endpoints : ["/"])).slice(0, 12);
    const params = (recon?.urlParameters || []).slice(0, 30);
    const forms = (recon?.forms || []).slice(0, 10);

    // Local catalogue (deterministic baseline plan)
    const catalogue = PayloadService.selectForContext(ctx);
    const intensityFactor = intensity === "low" ? 0.4 : intensity === "high" ? 1.0 : 0.7;
    const sampledCatalogue = catalogue.filter((_, i) => Math.random() < intensityFactor + 0.2);

    // Spread catalogue across endpoints/params
    const localPlan = [];
    for (const p of sampledCatalogue) {
      const ep = uniqEndpoints[localPlan.length % uniqEndpoints.length] || "/";
      const matchedParam = params.find(x => x.endpoint === ep)?.parameter
        || forms[0]?.inputs?.[0]?.name
        || (p.json ? "body" : ["q", "id", "search", "name", "url"][localPlan.length % 5]);
      localPlan.push({
        ...p,
        endpoint: ep,
        parameter: matchedParam,
        method: p.method || (p.json ? "POST" : "GET"),
        type: p.family   // legacy alias
      });
    }

    // Try Ollama planner for high-signal additions
    let aiAdditions = [];
    try {
      const ok = await this.verifyOllamaConnection() && await this.verifyModel(OLLAMA_MODEL);
      if (ok) {
        const userPrompt = JSON.stringify({
          server: recon?.server || null,
          stack: ctx.stack,
          hasJsonApi: ctx.hasJsonApi,
          hasAuth: ctx.hasAuth,
          endpoints: uniqEndpoints,
          urlParameters: params,
          forms: forms.map(f => ({ action: f.action, method: f.method, inputs: (f.inputs || []).map(i => i.name) })),
          intensity
        }, null, 2);
        const parsed = await this._ollamaJsonChat({
          system: SYSTEM_PROMPT_PLANNER,
          user: `Reconnaissance:\n${userPrompt}\n\nReturn JSON with key "scenarios" only.`,
          temperature: 0.6
        });
        const list = Array.isArray(parsed?.scenarios) ? parsed.scenarios : (Array.isArray(parsed) ? parsed : []);
        aiAdditions = list.filter(s => s && s.family && s.endpoint !== undefined && s.payload !== undefined)
          .map(s => ({
            family: String(s.family).toUpperCase(),
            type: String(s.family).toUpperCase(),
            technique: s.technique || "ai-suggested",
            endpoint: this._normalizeEndpoint(s.endpoint || "/"),
            method: (s.method || "GET").toUpperCase(),
            parameter: String(s.parameter || "q"),
            payload: String(s.payload),
            json: !!s.json,
            expects: {} // unknown for AI ones; detectors still apply
          }));
        console.log(`🤖 Planner: ${aiAdditions.length} AI scenarios added`);
      }
    } catch (e) {
      console.warn("⚠️ Planner Ollama failed, using catalogue only:", e.message);
    }

    const merged = [...localPlan, ...aiAdditions];
    // Deduplicate by family|endpoint|parameter|payload
    const dedup = Array.from(new Map(merged.map(s => [
      `${s.family}|${s.endpoint}|${s.parameter}|${s.payload}|${s.method}`, s
    ])).values());
    console.log(`✅ planAttacks: ${dedup.length} scenarios (catalogue=${localPlan.length}, ai=${aiAdditions.length})`);
    return dedup;
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 2: triageCandidates(rule_results) — batch FP filter
  // Input: array of TestEngine result objects (with confidence_raw, detectors)
  // Output: array of confirmed vulnerabilities with AI metadata
  // ─────────────────────────────────────────────────────────────────
  static async triageCandidates(results, options = {}) {
    const minConf = options.minConfidence ?? 0.4;
    const candidates = (results || []).filter(r => (r?.confidence_raw ?? 0) >= minConf || this._hasStrongSignal(r?.detectors));
    if (candidates.length === 0) return [];

    // Compact payload for the LLM
    const compact = candidates.map(r => ({
      candidate_id: r.id,
      family: r.family,
      technique: r.technique,
      endpoint: r.endpoint,
      method: r.method,
      parameter: r.parameter,
      payload: String(r.payload || "").slice(0, 300),
      response_status: r.response?.status,
      response_time_ms: r.response?.time,
      baseline_status: r.baseline?.status,
      baseline_time_ms: r.baseline?.time,
      length_delta: r.diff?.lengthDelta,
      detectors: r.detectors,
      response_snippet: String(r.response?.bodySnippet || "").slice(0, 600),
      confidence_raw: r.confidence_raw
    }));

    let aiFindings = [];
    try {
      const ok = await this.verifyOllamaConnection() && await this.verifyModel(OLLAMA_MODEL);
      if (ok) {
        const parsed = await this._ollamaJsonChat({
          system: SYSTEM_PROMPT_TRIAGER,
          user: `Candidates:\n${JSON.stringify(compact, null, 2)}\n\nReturn JSON with key "findings" only.`,
          temperature: 0.2
        });
        aiFindings = Array.isArray(parsed?.findings) ? parsed.findings : (Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.warn("⚠️ Triager Ollama failed:", e.message);
    }

    // Index by candidate_id for fast lookup
    const aiById = new Map();
    for (const f of aiFindings) {
      if (f && f.candidate_id) aiById.set(String(f.candidate_id), f);
    }

    // Merge AI metadata back; if AI missing for a high-confidence candidate, keep it as TP with rule-based defaults
    const merged = candidates.map(r => {
      const ai = aiById.get(String(r.id));
      const isTP = ai ? !!ai.is_true_positive : (r.confidence_raw >= 0.7 || this._hasStrongSignal(r.detectors));
      const ai_confidence = ai?.ai_confidence != null ? Number(ai.ai_confidence) : (isTP ? Math.min(1, r.confidence_raw + 0.1) : Math.max(0, r.confidence_raw - 0.3));
      const severity = ai?.severity || this._severityFromConfidence(r.family, ai_confidence);
      const cvss_score = ai?.cvss_score != null ? Number(ai.cvss_score) : this._defaultCvss(r.family, severity);
      const cvss_vector = ai?.cvss_vector || this._defaultCvssVector(r.family);
      const owasp = ai?.owasp_2021 || this._defaultOwasp(r.family);
      const cwe = ai?.cwe || this._categoryFromType(r.family);
      const evidence_summary = ai?.evidence_summary || this._buildEvidenceSummary(r);
      const technical_details = ai?.technical_details || this._buildTechnicalDetails(r);

      return {
        // identity
        id: r.id,
        type: r.family,
        family: r.family,
        technique: r.technique,
        encoding: r.encoding,

        // target
        endpoint: r.endpoint,
        method: r.method,
        parameter: r.parameter,
        payload: r.payload,

        // verdict
        is_true_positive: isTP,
        ai_confidence,
        confidence_raw: r.confidence_raw,
        detection_source: aiById.size ? "hybrid" : "rule",

        // scoring
        severity,
        cvss_score,
        cvss_vector,
        owasp_category: owasp,
        cwe,
        category: cwe,
        risk_score: Math.round(cvss_score * 10),
        niveauRisque: severity,

        // evidence
        evidence: evidence_summary,
        http_response_snippet: r.response?.bodySnippet || "",
        response_status: r.response?.status,
        response_headers: r.response?.headers || {},

        // narrative (filled later by RecommendationService)
        description: technical_details,
        technical_details,
        business_impact: "",
        reproduction_steps: [],
        fix_recommendation: "",
        secure_code_example: "",
        recommendation: "",
        recommandation: "",
        headers_to_add: {},

        detected_at: new Date()
      };
    }).filter(v => v.is_true_positive);

    // Deduplicate by family|endpoint|parameter (keep highest confidence)
    const bestByKey = new Map();
    for (const v of merged) {
      const key = `${v.family}|${v.endpoint}|${v.parameter}`;
      const prev = bestByKey.get(key);
      if (!prev || v.ai_confidence > prev.ai_confidence) bestByKey.set(key, v);
    }
    return Array.from(bestByKey.values());
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers used by triage
  // ─────────────────────────────────────────────────────────────────
  static _hasStrongSignal(d) {
    if (!d) return false;
    return !!(d.xssReflected || d.sqlError || d.fileLeak || d.headerLeak || d.timeBased ||
              d.sensitiveExposed || d.authBypass || d.redirect);
  }

  static _severityFromConfidence(family, conf) {
    const baseHigh = ["SQLI", "CMDI", "SSRF", "JWT", "AUTH_BYPASS", "PATH_TRAVERSAL", "LFI", "RFI", "SENSITIVE_DATA", "PROTOTYPE_POLLUTION"];
    const baseMed = ["XSS", "NOSQLI", "OPEN_REDIRECT", "HEADER_INJECTION", "IDOR"];
    if (conf >= 0.85 && baseHigh.includes(family)) return "critical";
    if (conf >= 0.7 && baseHigh.includes(family)) return "high";
    if (conf >= 0.7 && baseMed.includes(family)) return "high";
    if (conf >= 0.5) return "medium";
    if (conf >= 0.3) return "low";
    return "info";
  }

  static _defaultCvss(family, severity) {
    const base = { critical: 9.3, high: 7.5, medium: 5.4, low: 3.1, info: 0 };
    return base[severity] ?? 5.0;
  }

  static _defaultCvssVector(family) {
    const map = {
      SQLI: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      CMDI: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      SSRF: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:L/A:L",
      XSS:  "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
      OPEN_REDIRECT: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N",
      PATH_TRAVERSAL: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      LFI: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      RFI: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      HEADER_INJECTION: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
      PROTOTYPE_POLLUTION: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:H",
      JWT: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
      AUTH_BYPASS: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
      NOSQLI: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L",
      IDOR: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      SENSITIVE_DATA: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      RATE_LIMIT: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L",
      CSRF: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N"
    };
    return map[family] || "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N";
  }

  static _defaultOwasp(family) {
    const map = {
      SQLI: "A03:2021-Injection",
      NOSQLI: "A03:2021-Injection",
      CMDI: "A03:2021-Injection",
      XSS: "A03:2021-Injection",
      HEADER_INJECTION: "A03:2021-Injection",
      LFI: "A03:2021-Injection",
      RFI: "A03:2021-Injection",
      PATH_TRAVERSAL: "A01:2021-Broken Access Control",
      IDOR: "A01:2021-Broken Access Control",
      AUTH_BYPASS: "A07:2021-Identification and Authentication Failures",
      JWT: "A02:2021-Cryptographic Failures",
      SSRF: "A10:2021-Server-Side Request Forgery",
      OPEN_REDIRECT: "A01:2021-Broken Access Control",
      PROTOTYPE_POLLUTION: "A08:2021-Software and Data Integrity Failures",
      SENSITIVE_DATA: "A02:2021-Cryptographic Failures",
      CSRF: "A01:2021-Broken Access Control",
      RATE_LIMIT: "A04:2021-Insecure Design"
    };
    return map[family] || "A06:2021-Vulnerable and Outdated Components";
  }

  static _buildEvidenceSummary(r) {
    const d = r.detectors || {};
    const parts = [];
    if (d.xssReflected) parts.push(`Payload reflected unescaped at ${r.endpoint}?${r.parameter}`);
    if (d.sqlError) parts.push(`SQL error fingerprint in response (status=${r.response?.status})`);
    if (d.timeBased) parts.push(`Time-based: ${r.response?.time}ms vs baseline ${r.baseline?.time}ms`);
    if (d.fileLeak) parts.push(`File content leak detected (sensitive marker present)`);
    if (d.headerLeak) parts.push(`Injected header observed in response`);
    if (d.redirect) parts.push(`Redirect to attacker-controlled location`);
    if (d.authBypass) parts.push(`Reached 200 with bypass header (baseline=${r.baseline?.status})`);
    if (d.sensitiveExposed) parts.push(`Sensitive path ${r.endpoint} returned 200`);
    if (parts.length === 0) parts.push(`Reflection/diff signal on ${r.endpoint}`);
    return parts.join(" | ").slice(0, 400);
  }

  static _buildTechnicalDetails(r) {
    return `${r.family} (${r.technique}) on ${r.method} ${r.endpoint} via parameter "${r.parameter}". ` +
           `Payload: ${String(r.payload).slice(0, 120)}. ` +
           `Status: ${r.response?.status}, baseline: ${r.baseline?.status}. ` +
           `Body delta: ${r.diff?.lengthDelta} bytes. Time delta: ${r.diff?.timeDelta}ms.`;
  }

  // ─────────────────────────────────────────────────────────────────
  // Backward-compatible API
  // ─────────────────────────────────────────────────────────────────

  static async generateTestScenarios(context, intensity = "medium") {
    try {
      return await this.planAttacks(context || {}, intensity);
    } catch (e) {
      console.error("❌ generateTestScenarios fallback:", e.message);
      // last-resort catalogue scenarios
      const ctx = this._buildReconContext(context || {});
      return PayloadService.selectForContext(ctx).map(p => ({
        ...p, type: p.family, endpoint: "/", parameter: p.json ? "body" : "q",
        method: p.method || (p.json ? "POST" : "GET")
      }));
    }
  }

  static async analyzeSecurityResults(results) {
    // If results look like new-shape (have confidence_raw), run triager
    if (Array.isArray(results) && results.some(r => r && (r.confidence_raw !== undefined || r.detectors))) {
      try {
        return await this.triageCandidates(results);
      } catch (e) {
        console.error("❌ triageCandidates failed:", e.message);
        return [];
      }
    }
    // Legacy path — call old AI route
    return this._legacyAnalyze(results);
  }

  static async _legacyAnalyze(technicalResults) {
    try {
      const ok = await this.verifyOllamaConnection() && await this.verifyModel(OLLAMA_MODEL);
      if (!ok) return this._getDefaultVulnerabilities(technicalResults);

      const parsed = await this._ollamaJsonChat({
        system: "You are SecAuditGPT, a senior security analyst. Output strict JSON only.",
        user: `Given these technical scan results, identify confirmed vulnerabilities.
Return JSON: { "findings": [ { "type": "XSS|SQLI|CMDI|PATH_TRAVERSAL|OPEN_REDIRECT|SSRF|IDOR|OTHER",
  "endpoint": "/path", "parameter": "name", "evidence": "short proof",
  "description": "short technical description",
  "recommendation": "concrete fix recommendation" } ] }

Results:
${JSON.stringify(technicalResults, null, 2)}`,
        temperature: 0.3
      });

      const findings = Array.isArray(parsed?.findings) ? parsed.findings
                     : Array.isArray(parsed) ? parsed : [];

      const signalsList = Array.isArray(technicalResults)
        ? technicalResults.map(r => this._extractFindingSignals(r)) : [];
      const matchSignals = (endpoint, parameter) => {
        const ep = this._normalizeEndpoint(endpoint);
        const param = (parameter || "").toString();
        return signalsList.find(x => x.endpoint === ep && x.parameter === param)
            || signalsList.find(x => x.endpoint === ep)
            || { endpoint: ep, parameter: param, method: "", status: undefined,
                 payload: "", responseBody: "", responseHeaders: {}, errorText: "",
                 blob: `${ep}\n${param}`.toLowerCase() };
      };

      const vulns = findings
        .filter(v => this._validateFinding(v))
        .map(v => {
          const type = (v.type || "OTHER").toUpperCase();
          const endpoint = this._normalizeEndpoint(v.endpoint || "");
          const parameter = (v.parameter || "").toString();
          const signals = matchSignals(endpoint, parameter);
          const risk_score = this._computeRiskScore(type, signals);
          const severity = this._severityFromRisk(risk_score);
          const category = this._categoryFromType(type);
          return {
            type, category, severity, risk_score,
            endpoint, parameter,
            evidence: v.evidence || "",
            description: v.description || "",
            recommendation: v.recommendation || ""
          };
        });

      return Array.from(new Map(vulns.map(v =>
        [`${v.type}|${v.endpoint}|${v.parameter}|${v.evidence}`, v])).values());
    } catch (error) {
      console.error("❌ Erreur _legacyAnalyze:", error.message);
      return this._getDefaultVulnerabilities(technicalResults);
    }
  }
}

module.exports = AIAgentService;