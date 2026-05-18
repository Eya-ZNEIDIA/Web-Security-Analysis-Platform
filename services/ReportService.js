class ReportService {

  static generateAuditReport(data) {

    return {
      target: data.targetUrl,
      score: data.riskScore,
      summary: {
        totalVulnerabilities: data.vulnerabilities.length
      },
      vulnerabilities: data.vulnerabilities,
      generatedAt: new Date()
    };
  }
}

module.exports = ReportService;