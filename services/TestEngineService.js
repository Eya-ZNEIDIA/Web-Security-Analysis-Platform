/**
 * 🧪 TestEngineService — Sends baseline + attack requests, captures full evidence,
 * runs deterministic detectors, and returns rich result objects per scenario.
 *
 * Result shape:
 * {
 *   id, family, technique, encoding, endpoint, method, parameter,
 *   payload, headersSent, bodySent,
 *   request: { url, method, headers, body },
 *   response: { status, headers, bodySnippet, bodyLength, redirectChain, contentType, time },
 *   baseline: { status, bodyLength, time },
 *   diff: { statusChanged, lengthDelta, timeDelta, redirected },
 *   detectors: { sqlError, reflectedMarker, fileLeak, headerLeak, redirect, timeBased, xssReflected, stackTrace },
 *   confidence_raw,           // 0..1, computed by deterministic rules
 *   detection_source: "rule",
 *   error
 * }
 */

const axios = require("axios");
const crypto = require("crypto");
const PayloadService = require("./PayloadService");

const MAX_BODY_SNIPPET = 4000;
const REQUEST_TIMEOUT = 10000;
const TIME_BASED_TIMEOUT = 8000;
const DEFAULT_UA = "WebSecurityPlatform/2.0 (+audit)";

// ─── Deterministic detector regexes ─────────────────────────────
const SQL_ERROR_PATTERNS = [
  /sql syntax/i, /mysql_fetch/i, /mysql server version/i, /you have an error in your sql/i,
  /pg_query|postgres|psql/i, /ORA-\d{4,5}/i, /SQLSTATE\[/i, /sqlite_/i, /odbc_/i, /jdbc/i,
  /unterminated quoted string/i, /quoted string not properly terminated/i,
  /System\.Data\.SqlClient/i, /Microsoft OLE DB Provider/i
];
const STACK_TRACE_PATTERNS = [
  /at\s+\w+\.<anonymous>\s+\(/i, /at\s+[\w\.\$]+\([^)]+:\d+:\d+\)/i,
  /Traceback \(most recent call last\)/i, /\sat\s+[\w\.]+\(/i,
  /Exception in thread/i, /Fatal error:/i, /Warning:\s+\w+\(\)/i
];
const SENSITIVE_FILE_HINTS = [
  /root:x:0:0:/i, /\[fonts\]/i, /\[extensions\]/i,
  /APP_KEY=|DB_PASSWORD=|AWS_SECRET/i, /\[core\]\s+repositoryformatversion/i,
  /BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY/i
];

class TestEngineService {
  // ───────────────────────────────────────────────────────────
  // Public: execute a list of scenarios with baselining
  // ───────────────────────────────────────────────────────────
  static async executeScenarios(baseUrl, scenarios, options = {}) {
    const concurrency = Number(options.concurrency || 4);
    const baselines = new Map(); // key endpoint|method → baseline
    const results = [];

    // 1) collect baselines per (endpoint, method) so we don't refetch
    const baseKeys = new Set();
    for (const s of scenarios) {
      const ep = s.endpoint || "/";
      const m = (s.method || "GET").toUpperCase();
      baseKeys.add(`${m}|${ep}`);
    }
    await Promise.all(
      [...baseKeys].map(async key => {
        const [method, endpoint] = key.split("|");
        const baseline = await this._fetchBaseline(baseUrl, endpoint, method);
        baselines.set(key, baseline);
      })
    );

    // 2) execute scenarios with bounded concurrency
    let i = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (i < scenarios.length) {
        const idx = i++;
        const s = scenarios[idx];
        try {
          const r = await this._executeOne(baseUrl, s, baselines);
          results.push(r);
        } catch (e) {
          results.push({
            id: crypto.randomUUID(),
            family: s.family || s.type || "OTHER",
            technique: s.technique || "",
            endpoint: s.endpoint || "/",
            method: (s.method || "GET").toUpperCase(),
            parameter: s.parameter || "",
            payload: s.payload || "",
            error: e.message,
            confidence_raw: 0,
            detection_source: "rule"
          });
        }
      }
    });
    await Promise.all(workers);
    return results;
  }

  // ───────────────────────────────────────────────────────────
  // Baseline fetch (no payload)
  // ───────────────────────────────────────────────────────────
  static async _fetchBaseline(baseUrl, endpoint, method) {
    const url = this._joinUrl(baseUrl, endpoint);
    const start = Date.now();
    try {
      const r = await axios.request({
        url,
        method,
        timeout: REQUEST_TIMEOUT,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: { "User-Agent": DEFAULT_UA, Accept: "*/*" }
      });
      const body = this._toString(r.data);
      return {
        status: r.status,
        headers: r.headers || {},
        bodyLength: body.length,
        bodyHash: crypto.createHash("sha1").update(body.slice(0, 8000)).digest("hex"),
        time: Date.now() - start,
        contentType: (r.headers && r.headers["content-type"]) || ""
      };
    } catch (err) {
      const r = err.response;
      const body = r ? this._toString(r.data) : "";
      return {
        status: r?.status ?? null,
        headers: r?.headers || {},
        bodyLength: body.length,
        bodyHash: crypto.createHash("sha1").update(body.slice(0, 8000)).digest("hex"),
        time: Date.now() - start,
        contentType: (r?.headers && r.headers["content-type"]) || "",
        error: err.message
      };
    }
  }

  // ───────────────────────────────────────────────────────────
  // Execute a single scenario
  // ───────────────────────────────────────────────────────────
  static async _executeOne(baseUrl, scenario, baselines) {
    const endpoint = scenario.endpoint || "/";
    const method = (scenario.method || (scenario.json ? "POST" : "GET")).toUpperCase();
    const parameter = scenario.parameter || (scenario.json ? "body" : "q");
    const payload = scenario.payload != null ? String(scenario.payload) : "";
    const family = scenario.family || scenario.type || "OTHER";

    const baseKey = `${method}|${endpoint}`;
    const baseline = baselines.get(baseKey);

    // Build request based on injection point
    const reqConfig = {
      method,
      url: this._joinUrl(baseUrl, scenario.urlPath || endpoint),
      timeout: scenario.expects?.timeDelay ? TIME_BASED_TIMEOUT : REQUEST_TIMEOUT,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { "User-Agent": DEFAULT_UA, Accept: "*/*" }
    };

    // Header injection
    if (scenario.asHeader) {
      const value = scenario.originHeaderValue || `${scenario.prefix || ""}${payload}`;
      reqConfig.headers[scenario.asHeader] = value;
    }

    // Probe-only paths (sensitive data)
    const isPathProbe = !!scenario.urlPath;

    // Body / Query placement
    if (!isPathProbe && !scenario.asHeader && !scenario.probeOnly) {
      if (scenario.json || method === "POST" || method === "PUT" || method === "PATCH") {
        reqConfig.headers["Content-Type"] = scenario.json ? "application/json" : "application/x-www-form-urlencoded";
        if (scenario.json) {
          // try parsing payload as JSON, otherwise wrap
          let bodyObj;
          try { bodyObj = JSON.parse(payload); }
          catch { bodyObj = { [parameter]: payload }; }
          reqConfig.data = bodyObj;
        } else if (method === "GET") {
          reqConfig.params = { [parameter]: payload };
        } else {
          reqConfig.data = new URLSearchParams({ [parameter]: payload }).toString();
        }
      } else {
        reqConfig.params = { [parameter]: payload };
      }
    }

    const start = Date.now();
    let resp, err;
    try {
      resp = await axios.request(reqConfig);
    } catch (e) {
      err = e;
      resp = e.response || null;
    }
    const elapsed = Date.now() - start;

    const status = resp?.status ?? null;
    const headers = resp?.headers || {};
    const bodyRaw = this._toString(resp?.data);
    const bodyLength = bodyRaw.length;
    const bodySnippet = bodyRaw.slice(0, MAX_BODY_SNIPPET);
    const contentType = headers["content-type"] || "";

    // Diff vs baseline
    const diff = baseline ? {
      statusChanged: status !== baseline.status,
      lengthDelta: bodyLength - (baseline.bodyLength || 0),
      timeDelta: elapsed - (baseline.time || 0),
      bodyHashChanged: crypto.createHash("sha1").update(bodyRaw.slice(0, 8000)).digest("hex") !== baseline.bodyHash,
      redirected: !!headers["location"]
    } : null;

    // Deterministic detectors
    const detectors = this._runDetectors({
      family, scenario, payload, status, headers, body: bodyRaw, elapsed, baseline
    });

    // Confidence (0..1) from rule-based signals
    const confidence_raw = this._scoreConfidence(family, detectors, diff, scenario);

    return {
      id: crypto.randomUUID(),
      family,
      technique: scenario.technique || "",
      encoding: scenario.encoding || "raw",
      endpoint,
      method,
      parameter,
      payload,
      request: {
        url: reqConfig.url,
        method,
        headers: reqConfig.headers,
        params: reqConfig.params || null,
        body: reqConfig.data || null
      },
      response: {
        status,
        headers,
        bodySnippet,
        bodyLength,
        contentType,
        location: headers["location"] || null,
        time: elapsed
      },
      baseline: baseline ? {
        status: baseline.status,
        bodyLength: baseline.bodyLength,
        time: baseline.time
      } : null,
      diff,
      detectors,
      confidence_raw,
      detection_source: "rule",
      error: err?.message || null
    };
  }

  // ───────────────────────────────────────────────────────────
  // Detectors — return booleans + extracted evidence
  // ───────────────────────────────────────────────────────────
  static _runDetectors({ family, scenario, payload, status, headers, body, elapsed, baseline }) {
    const lower = (body || "").toLowerCase();
    const headerStr = JSON.stringify(headers || {}).toLowerCase();
    const expects = scenario.expects || {};

    // Marker reflection (specific token from payload)
    let reflectedMarker = false;
    let reflectionSnippet = "";
    if (scenario.marker && body && body.includes(scenario.marker)) {
      reflectedMarker = true;
      const idx = body.indexOf(scenario.marker);
      reflectionSnippet = body.slice(Math.max(0, idx - 80), idx + scenario.marker.length + 80);
    } else if (payload && payload.length >= 6 && body && body.includes(payload)) {
      reflectedMarker = true;
      const idx = body.indexOf(payload);
      reflectionSnippet = body.slice(Math.max(0, idx - 80), idx + payload.length + 80);
    }

    // Raw XSS reflection (script tag intact)
    const xssReflected = family === "XSS" && reflectedMarker &&
      /<script|onerror=|onload=|javascript:|<svg|<iframe/i.test(reflectionSnippet);

    // SQL errors
    const sqlError = SQL_ERROR_PATTERNS.some(rx => rx.test(body || ""));
    const sqlErrorBaselineFree = sqlError && (!baseline || !SQL_ERROR_PATTERNS.some(rx => rx.test("")));

    // Stack traces
    const stackTrace = STACK_TRACE_PATTERNS.some(rx => rx.test(body || ""));

    // File leak (path traversal / SSRF file:// / sensitive data)
    const fileLeak = SENSITIVE_FILE_HINTS.some(rx => rx.test(body || "")) ||
      (expects.fileContent && lower.includes(String(expects.fileContent).toLowerCase()));

    // Header leak (CRLF injection)
    const headerLeak = !!(expects.headerLeak && headerStr.includes(String(expects.headerLeak).toLowerCase()));

    // Redirect to attacker domain
    const loc = (headers && headers["location"]) || "";
    const redirect = !!(expects.redirect && loc && String(loc).toLowerCase().includes(String(expects.redirect).toLowerCase()));

    // Time-based (only meaningful if expected)
    const timeBased = !!(expects.timeDelay && elapsed >= expects.timeDelay && (!baseline || elapsed - baseline.time >= expects.timeDelay - 500));

    // Sensitive data exposure
    const sensitiveExposed = family === "SENSITIVE_DATA" &&
      status === 200 && body && body.length > 0 &&
      (!baseline || baseline.status === 404 || baseline.status >= 400);

    // Auth bypass: 200 reached on a path that should require auth (heuristic — rely on diff)
    const authBypass = (family === "AUTH_BYPASS" || family === "JWT") &&
      status === 200 && baseline && (baseline.status === 401 || baseline.status === 403);

    // IDOR heuristic: 200 + appears to leak user-shaped data
    const idorLeak = family === "IDOR" && status === 200 &&
      /(email|user_id|account_id|firstName|lastName|phone)/i.test(body || "");

    // Open redirect detection by Location header
    const openRedirected = family === "OPEN_REDIRECT" &&
      (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
      !!loc && /(evil\.example\.com|attacker|\/\/)/i.test(loc);

    // Rate limit missing: probeOnly burst was sent in ScenarioPlanner; here we just look at headers
    const rateLimitMissing = family === "RATE_LIMIT" &&
      !headers["x-ratelimit-limit"] && !headers["ratelimit-limit"] && !headers["retry-after"];

    return {
      reflectedMarker,
      reflectionSnippet,
      xssReflected,
      sqlError: sqlErrorBaselineFree,
      stackTrace,
      fileLeak,
      headerLeak,
      redirect: redirect || openRedirected,
      timeBased,
      sensitiveExposed,
      authBypass,
      idorLeak,
      rateLimitMissing
    };
  }

  // ───────────────────────────────────────────────────────────
  // Confidence scoring 0..1 from detectors+diff
  // ───────────────────────────────────────────────────────────
  static _scoreConfidence(family, d, diff, scenario) {
    let c = 0;
    switch (family) {
      case "XSS":
        if (d.xssReflected) c += 0.85;
        else if (d.reflectedMarker) c += 0.3;
        break;
      case "SQLI":
        if (d.sqlError) c += 0.7;
        if (d.timeBased) c += 0.7;
        if (d.stackTrace) c += 0.2;
        break;
      case "NOSQLI":
        if (d.timeBased) c += 0.7;
        if (diff?.statusChanged && diff?.lengthDelta > 100) c += 0.4;
        break;
      case "CMDI":
        if (d.fileLeak) c += 0.85;
        if (d.timeBased) c += 0.7;
        if (d.reflectedMarker && scenario.marker === "uid=") c += 0.6;
        break;
      case "SSRF":
        if (d.fileLeak) c += 0.85;
        if (diff?.statusChanged) c += 0.3;
        break;
      case "OPEN_REDIRECT":
        if (d.redirect) c += 0.9;
        break;
      case "PATH_TRAVERSAL":
      case "LFI":
      case "RFI":
        if (d.fileLeak) c += 0.9;
        else if (d.reflectedMarker) c += 0.4;
        break;
      case "HEADER_INJECTION":
        if (d.headerLeak) c += 0.85;
        break;
      case "PROTOTYPE_POLLUTION":
        if (diff?.statusChanged && diff?.lengthDelta !== 0) c += 0.3;
        break;
      case "JWT":
      case "AUTH_BYPASS":
        if (d.authBypass) c += 0.8;
        break;
      case "IDOR":
        if (d.idorLeak) c += 0.55;
        break;
      case "SENSITIVE_DATA":
        if (d.sensitiveExposed) c += 0.85;
        break;
      case "RATE_LIMIT":
        if (d.rateLimitMissing) c += 0.4;
        break;
      case "CSRF":
        // CSRF inferred elsewhere from response headers (SameSite, CSRF token)
        c += 0;
        break;
      default:
        if (d.reflectedMarker) c += 0.2;
    }
    if (d.stackTrace) c += 0.05;
    return Math.max(0, Math.min(1, Number(c.toFixed(3))));
  }

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────
  static _joinUrl(base, ep) {
    if (!ep) return base;
    if (/^https?:\/\//i.test(ep)) return ep;
    const b = String(base || "").replace(/\/+$/, "");
    const e = String(ep).startsWith("/") ? ep : `/${ep}`;
    return b + e;
  }

  static _toString(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (Buffer.isBuffer(x)) return x.toString("utf8");
    try { return JSON.stringify(x); } catch { return String(x); }
  }

  // ───────────────────────────────────────────────────────────
  // Convenience — fuzz an endpoint with all relevant payloads
  // ───────────────────────────────────────────────────────────
  static async fuzzEndpoint(baseUrl, endpoint, parameter, methods = ["GET"], context = {}) {
    const payloads = PayloadService.selectForContext(context);
    const scenarios = [];
    for (const m of methods) {
      for (const p of payloads) {
        scenarios.push({ ...p, endpoint, parameter, method: m });
      }
    }
    return this.executeScenarios(baseUrl, scenarios);
  }
}

module.exports = TestEngineService;