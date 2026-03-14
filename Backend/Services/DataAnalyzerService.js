const axios = require("axios");
const cheerio = require("cheerio");
const CrawlerService = require("./CrawlerService");

class DataAnalyzerService {

  static REQUEST_DELAY_MS = 500;
  static MAX_REQUESTS_PER_MINUTE = 30;
  static requestTimestamps = [];

  static extractURLParameters(endpoints) {

    const params = [];

    endpoints.forEach(url => {

      try {

        const parsed = new URL(url);

        parsed.searchParams.forEach((value, key) => {

          params.push({
            endpoint: parsed.pathname,
            parameter: key
          });

        });

      } catch {}

    });

    return params;
  }

  static validateUrl(url) {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;

      const publicTestDomains = [
        "demo.testfire.net",
        "testphp.vulnweb.com",
        "dvwa.co.uk",
        "hacme.altoromutual.com",
        "webgoat.owasp.org",
        "owasp.org"
      ];

      const localPatterns = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1"
      ];

      const isPublicTest = publicTestDomains.includes(hostname);

      const isLocal =
        localPatterns.includes(hostname) ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".test") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.");

      if (!isPublicTest && !isLocal) {
        console.warn(`[SECURITY] Domaine externe détecté : ${hostname}`);
      }

      return true;

    } catch (err) {
      console.error("URL invalide:", err.message);
      return false;
    }
  }

  static async enforceRateLimit() {

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.requestTimestamps =
      this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {

      const waitTime =
        this.requestTimestamps[0] + 60000 - now + 1000;

      console.warn(`Rate limit atteint. Attente ${waitTime}ms`);

      await new Promise(r => setTimeout(r, waitTime));
    }

    await new Promise(r =>
      setTimeout(r, this.REQUEST_DELAY_MS)
    );

    this.requestTimestamps.push(Date.now());
  }

  static detectPackages(html, headers) {

    const packages = {
      frameworks: [],
      libraries: [],
      cms: [],
      tools: []
    };

    const serverHeader = headers["server"] || "";
    const xPoweredBy = headers["x-powered-by"] || "";

    const serverPatterns = {
      Apache: /Apache/i,
      Nginx: /Nginx/i,
      IIS: /IIS|Microsoft/i,
      Express: /Express/i,
      PHP: /PHP/i,
      Node: /Node/i,
      Django: /Django/i,
      Laravel: /Laravel/i,
      WordPress: /WordPress/i
    };

    Object.entries(serverPatterns).forEach(([name, pattern]) => {

      if (pattern.test(serverHeader) || pattern.test(xPoweredBy)) {

        packages.frameworks.push({
          name,
          source: "headers"
        });

      }

    });

    const htmlPatterns = {
      jquery: /jquery/i,
      bootstrap: /bootstrap/i,
      react: /react/i,
      vue: /vue/i,
      angular: /angular/i,
      tailwind: /tailwind/i
    };

    Object.entries(htmlPatterns).forEach(([name, pattern]) => {

      if (pattern.test(html)) {

        packages.libraries.push({
          name,
          source: "html"
        });

      }

    });

    return packages;
  }

  static detectVulnerabilities(body) {

    const vulnerabilities = {

      sqlInjection: {
        patterns: [
          /SQL syntax/i,
          /MySQL error/i,
          /SQLSTATE/i,
          /syntax error/i
        ],
        detected: false
      },

      xss: {
        patterns: [
          /<script/i,
          /alert/i,
          /onerror/i,
          /onload/i
        ],
        detected: false
      },

      commandInjection: {
        patterns: [
          /command not found/i,
          /permission denied/i,
          /bin\/bash/i
        ],
        detected: false
      },

      pathTraversal: {
        patterns: [
          /\.\.\//,
          /etc\/passwd/i,
          /windows\/system32/i
        ],
        detected: false
      },

      openRedirect: {
        patterns: [
          /http:\/\/evil/i,
          /https:\/\/evil/i
        ],
        detected: false
      },

      ssrf: {
        patterns: [
          /127\.0\.0\.1/i,
          /localhost/i,
          /169\.254\.169\.254/i
        ],
        detected: false
      }

    };

    Object.keys(vulnerabilities).forEach(type => {

      const patterns = vulnerabilities[type].patterns;

      vulnerabilities[type].detected =
        patterns.some(pattern => pattern.test(body));

    });

    return vulnerabilities;
  }

  static async collectInitialData(url) {

    try {

      if (!this.validateUrl(url)) {
        throw new Error("URL non autorisée");
      }

      await this.enforceRateLimit();

      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 3,
        headers: {
          "User-Agent": "Mozilla/5.0 SecurityScanner"
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      let endpoints = new Set();

      $("a").each((i, link) => {

        let href = $(link).attr("href");

        if (!href) return;

        if (href.startsWith("/")) {
          href = new URL(url).origin + href;
        }

        if (href.startsWith("http")) {
          endpoints.add(href);
        }

      });

      const crawledEndpoints = await CrawlerService.crawl(url);

      crawledEndpoints.forEach(e => endpoints.add(e));

      endpoints = Array.from(endpoints);

      if (endpoints.length === 0) {
        endpoints.push(url);
      }

      const urlParameters =
        this.extractURLParameters(endpoints);

      const forms = [];

      $("form").each((i, form) => {

        const action = $(form).attr("action") || url;
        const method =
          ($(form).attr("method") || "GET").toUpperCase();

        const inputs = [];

        $(form)
          .find("input, textarea, select")
          .each((j, input) => {

            const name = $(input).attr("name");
            const type = $(input).attr("type") || "text";

            if (name) inputs.push({ name, type });

          });

        forms.push({
          action,
          method,
          inputs
        });

      });

      const securityHeaders = {

        "X-Content-Type-Options":
          response.headers["x-content-type-options"],

        "X-Frame-Options":
          response.headers["x-frame-options"],

        "Strict-Transport-Security":
          response.headers["strict-transport-security"],

        "Content-Security-Policy":
          response.headers["content-security-policy"]

      };

      const packages =
        this.detectPackages(html, response.headers);

      return {

        status: response.status,
        headers: response.headers,
        server: response.headers["server"] || null,
        cookies: response.headers["set-cookie"] || [],
        securityHeaders,
        packages,
        html,
        endpoints: endpoints.slice(0, 30),
        urlParameters,
        forms: forms.slice(0, 10)

      };

    } catch (err) {

      console.error("collectInitialData error:", err.message);

      return {
        status: err.response?.status || "Request failed",
        headers: {},
        server: null,
        cookies: [],
        securityHeaders: {},
        packages: {},
        endpoints: [url],
        urlParameters: [],
        forms: [],
        error: err.message
      };

    }

  }

  static analyzeRawResults(results) {

    return results.map(r => {

      const hasVulnerability =
        Object.values(r.vulnerabilities || {})
          .some(v => v.detected === true);

      return {

        endpoint: r.endpoint,
        status: r.status || null,
        method: r.method || "GET",
        responseTime: r.responseTime,
        bodyLength: r.bodyLength || 0,
        vulnerabilities: r.vulnerabilities || {},
        vulnerable: hasVulnerability,
        payload: r.payload || null,
        error: r.error || null

      };

    });

  }

}

module.exports = DataAnalyzerService;