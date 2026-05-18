/**
 * 📊 RiskEngineService
 *
 * - calculateGlobalRiskScore(vulns)
 *     Returns a 0..100 score where 100 = no risk and 0 = critical exposure.
 *     Weighted by CVSS score AND AI confidence, so low-confidence findings
 *     don't tank the score artificially.
 *
 * - breakdown(vulns) → { critical, high, medium, low, info }
 * - statistics(vulns, requests, endpoints) → roll-up for the report
 */

const SEVERITY_WEIGHT = {
  critical: 28,
  high:     18,
  medium:   9,
  low:      4,
  info:     1
};

class RiskEngineService {
  static calculateGlobalRiskScore(vulnerabilities = []) {
    let score = 100;
    for (const v of vulnerabilities) {
      const sev = String(v.severity || v.niveauRisque || "low").toLowerCase();
      const cvss = Number(v.cvss_score) || 0;
      const conf = typeof v.ai_confidence === "number"
        ? v.ai_confidence
        : (typeof v.confidence_raw === "number" ? v.confidence_raw : 0.6);

      const baseImpact = SEVERITY_WEIGHT[sev] ?? 4;
      // CVSS contribution: 0..10 mapped to 0..1.5×, average ~1.0
      const cvssFactor = cvss > 0 ? (0.5 + cvss / 10) : 1.0;
      // Confidence: 0..1 directly scales the deduction
      const impact = baseImpact * cvssFactor * Math.max(0.2, conf);
      score -= impact;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static breakdown(vulnerabilities = []) {
    const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of vulnerabilities) {
      const sev = String(v.severity || v.niveauRisque || "low").toLowerCase();
      if (out[sev] != null) out[sev] += 1;
      else out.low += 1;
    }
    return out;
  }

  static statistics(vulnerabilities = [], { totalRequests = 0, totalEndpoints = 0, totalPayloads = 0, suppressedFalsePositives = 0 } = {}) {
    const true_positives = vulnerabilities.length;
    const avgConf = true_positives > 0
      ? vulnerabilities.reduce((s, v) => s + (Number(v.ai_confidence) || 0), 0) / true_positives
      : 0;
    const avgCvss = true_positives > 0
      ? vulnerabilities.reduce((s, v) => s + (Number(v.cvss_score) || 0), 0) / true_positives
      : 0;
    return {
      total_requests: totalRequests,
      total_endpoints: totalEndpoints,
      total_payloads: totalPayloads,
      total_vulnerabilities: true_positives,
      true_positives,
      suppressed_false_positives: suppressedFalsePositives,
      avg_confidence: Number(avgConf.toFixed(3)),
      avg_cvss: Number(avgCvss.toFixed(2))
    };
  }
}

module.exports = RiskEngineService;