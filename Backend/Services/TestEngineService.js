const axios = require("axios");
const PayloadService = require("./PayloadService");

class TestEngineService {


  static async executeScenarios(baseUrl, scenarios) {
    const results = [];

    for (const scenario of scenarios) {
      const endpoint = scenario.endpoint || "/";
      const param = scenario.parameter || "test";
      const payload = scenario.payload || "";

      const targetUrl = baseUrl + endpoint;

      const start = Date.now();

      try {
        let response;

 
        if (scenario.method && scenario.method.toUpperCase() === "POST") {
          response = await axios.post(targetUrl, {
            [param]: payload
          }, {
            timeout: 10000,
            headers: { "User-Agent": "SecurityScanner" }
          });
        } else {
          response = await axios.get(targetUrl, {
            params: { [param]: payload },
            timeout: 10000,
            headers: { "User-Agent": "SecurityScanner" }
          });
        }

        const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

        const vulnerabilities = this.detectVulnerabilities(body, payload);

        results.push({
          endpoint,
          method: scenario.method || "GET",
          parameter: param,
          payload,
          status: response.status,
          bodyLength: body.length,
          responseTime: Date.now() - start,
          vulnerabilities
        });

      } catch (error) {

        const res = error.response || {};
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data || "");

        results.push({
          endpoint,
          method: scenario.method || "GET",
          parameter: param,
          payload,
          status: res.status || null,
          bodyLength: body.length,
          responseTime: Date.now() - start,
          vulnerabilities: {}
        });
      }
    }

    return results;
  }

  
  static detectVulnerabilities(body, payload) {
    const lower = body.toLowerCase();

    return {
      xss: { detected: payload.includes("<script") && body.includes(payload) },
      sqlInjection: { detected: lower.includes("sql") || lower.includes("syntax error") || lower.includes("mysql") },
      commandInjection: { detected: lower.includes("bin/bash") || lower.includes("command not found") },
      pathTraversal: { detected: lower.includes("root:x:") || lower.includes("etc/passwd") },
      openRedirect: { detected: lower.includes("evil.com") },
      ssrf: { detected: lower.includes("127.0.0.1") || lower.includes("localhost") },
      idor: { detected: lower.includes("user_id") || lower.includes("account_id") }
    };
  }


  static async fuzzEndpoint(baseUrl, endpoint, param, methods = ["GET"]) {
    const payloads = [
      ...PayloadService.getXSSPayloads(),
      ...PayloadService.getSQLiPayloads()
    ];

    const scenarios = [];

    methods.forEach(method => {
      payloads.forEach(payload => {
        scenarios.push({ endpoint, parameter: param, payload, method });
      });
    });

    return await this.executeScenarios(baseUrl, scenarios);
  }
}

module.exports = TestEngineService;