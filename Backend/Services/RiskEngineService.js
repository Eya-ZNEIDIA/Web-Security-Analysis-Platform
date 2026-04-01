class RiskEngineService {

  static calculateGlobalRiskScore(vulnerabilities) {

    let score = 100;

    vulnerabilities.forEach(vuln => {
      if (vuln.severity === "critical") score -= 30;
      if (vuln.severity === "high") score -= 20;
      if (vuln.severity === "medium") score -= 10;
      if (vuln.severity === "low") score -= 5;
    });

    return score < 0 ? 0 : score;
  }
}

module.exports = RiskEngineService;