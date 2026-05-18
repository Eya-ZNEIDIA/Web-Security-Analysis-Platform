/**
 * 🔗 CorrelationEngine — Cross-result analysis to:
 *  - Reduce false positives by detecting auth-wall noise (everything 401/403)
 *  - Boost confidence when multiple independent signals confirm one vuln
 *  - Detect structural issues across endpoints (missing security headers, no rate-limit)
 *  - Annotate vulnerabilities with related findings (correlation_ids)
 *
 * Input: array of TestEngine results (rich shape with detectors + diff + response)
 * Output: { results, observations } — results may have updated confidence_raw and metadata
 */

const STRUCTURAL_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "strict-transport-security",
  "referrer-policy",
  "permissions-policy"
];

class CorrelationEngine {
  /**
   * @param {Array} results — TestEngine result objects
   * @returns {{ results: Array, observations: Array }}
   */
  static analyze(results = []) {
    const observations = [];
    if (!Array.isArray(results) || results.length === 0) {
      return { results, observations };
    }

    // 1) AUTH WALL DETECTION — if EVERY request returned 401/403, suppress most findings
    const total = results.length;
    const blocked = results.filter(r => r.response?.status === 401 || r.response?.status === 403).length;
    const authWallRatio = blocked / total;
    if (authWallRatio > 0.85) {
      observations.push({
        type: "auth_wall",
        message: `Authentication wall detected (${Math.round(authWallRatio * 100)}% of requests blocked).`
      });
      for (const r of results) {
        if (r.response?.status === 401 || r.response?.status === 403) {
          r.confidence_raw = Math.max(0, (r.confidence_raw || 0) - 0.4);
          r.suppressed_by = "auth_wall";
        }
      }
    }

    // 2) CSP MISSING — note as a structural observation (and add a pseudo-vuln later in audit if needed)
    const baselineHeaders = (results.find(r => r.baseline)?.baseline?.headers) || {};
    // We rely on response headers from the very first probe baseline
    const sampleResp = results.find(r => r.response?.headers);
    const respHeaders = sampleResp?.response?.headers || {};
    const missing = STRUCTURAL_HEADERS.filter(h => !respHeaders[h]);
    if (missing.length > 0) {
      observations.push({
        type: "missing_security_headers",
        message: `Missing security headers: ${missing.join(", ")}`,
        meta: { missing }
      });
    }

    // 3) RATE LIMIT — note if no rate-limit header on any response
    const hasAnyRateHeader = results.some(r => {
      const h = r.response?.headers || {};
      return h["x-ratelimit-limit"] || h["ratelimit-limit"] || h["retry-after"];
    });
    if (!hasAnyRateHeader && total >= 20) {
      observations.push({
        type: "no_rate_limit",
        message: `No rate-limiting headers observed across ${total} requests.`
      });
    }

    // 4) SIGNAL CORRELATION — boost confidence when same family is confirmed by multiple techniques on same endpoint
    const groups = new Map(); // `${family}|${endpoint}|${parameter}` → list of results
    for (const r of results) {
      const key = `${r.family}|${r.endpoint}|${r.parameter}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    for (const [key, group] of groups.entries()) {
      const strong = group.filter(r => (r.confidence_raw || 0) >= 0.5);
      if (strong.length >= 2) {
        const correlationId = `corr_${key.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}`;
        for (const r of strong) {
          r.confidence_raw = Math.min(1, (r.confidence_raw || 0) + 0.1);
          r.correlation_id = correlationId;
        }
        observations.push({
          type: "correlated_signals",
          message: `${strong.length} confirming techniques for ${key}`,
          meta: { key, count: strong.length, correlation_id: correlationId }
        });
      }
    }

    // 5) STACK TRACE LEAKAGE — flag any endpoint that returned a stack trace as info-level finding
    const leakyEndpoints = new Set();
    for (const r of results) {
      if (r.detectors?.stackTrace) leakyEndpoints.add(r.endpoint);
    }
    if (leakyEndpoints.size > 0) {
      observations.push({
        type: "stack_trace_leak",
        message: `Stack traces leaked at: ${Array.from(leakyEndpoints).join(", ")}`,
        meta: { endpoints: Array.from(leakyEndpoints) }
      });
    }

    return { results, observations };
  }

  /**
   * Convert structural observations into pseudo-vulnerabilities (for the report).
   */
  static observationsToVulnerabilities(observations = [], targetUrl = "/") {
    const vulns = [];
    for (const o of observations) {
      if (o.type === "missing_security_headers") {
        vulns.push({
          family: "OTHER",
          type: "OTHER",
          technique: "missing-security-headers",
          endpoint: "/",
          method: "GET",
          parameter: "",
          payload: "",
          severity: "low",
          niveauRisque: "low",
          cvss_score: 3.1,
          cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N",
          owasp_category: "A05:2021-Security Misconfiguration",
          cwe: "CWE-693",
          category: "CWE-693",
          risk_score: 30,
          ai_confidence: 0.8,
          confidence_raw: 0.8,
          detection_source: "rule",
          is_true_positive: true,
          evidence: o.message,
          description: o.message,
          technical_details: o.message,
          response_status: 200,
          response_headers: {},
          http_response_snippet: "",
          detected_at: new Date()
        });
      }
      if (o.type === "no_rate_limit") {
        vulns.push({
          family: "RATE_LIMIT",
          type: "RATE_LIMIT",
          technique: "no-rate-limit",
          endpoint: "/",
          method: "GET",
          parameter: "",
          payload: "",
          severity: "low",
          niveauRisque: "low",
          cvss_score: 3.7,
          cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L",
          owasp_category: "A04:2021-Insecure Design",
          cwe: "CWE-770",
          category: "CWE-770",
          risk_score: 37,
          ai_confidence: 0.7,
          confidence_raw: 0.7,
          detection_source: "rule",
          is_true_positive: true,
          evidence: o.message,
          description: o.message,
          technical_details: o.message,
          response_status: 200,
          response_headers: {},
          http_response_snippet: "",
          detected_at: new Date()
        });
      }
      if (o.type === "stack_trace_leak") {
        const eps = (o.meta?.endpoints || []).join(", ");
        vulns.push({
          family: "SENSITIVE_DATA",
          type: "SENSITIVE_DATA",
          technique: "stack-trace-leak",
          endpoint: o.meta?.endpoints?.[0] || "/",
          method: "GET",
          parameter: "",
          payload: "",
          severity: "medium",
          niveauRisque: "medium",
          cvss_score: 5.0,
          cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
          owasp_category: "A05:2021-Security Misconfiguration",
          cwe: "CWE-209",
          category: "CWE-209",
          risk_score: 50,
          ai_confidence: 0.85,
          confidence_raw: 0.85,
          detection_source: "rule",
          is_true_positive: true,
          evidence: `Stack traces leaked at: ${eps}`,
          description: `Verbose error responses expose internal stack traces (${eps}).`,
          technical_details: `Stack traces detected in responses for endpoints: ${eps}.`,
          response_status: 500,
          response_headers: {},
          http_response_snippet: "",
          detected_at: new Date()
        });
      }
    }
    return vulns;
  }
}

module.exports = CorrelationEngine;
