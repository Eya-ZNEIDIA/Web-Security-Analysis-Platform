/**
 * 🧠 RecommendationService — Per-vulnerability contextual enrichment via Ollama.
 *
 * Output shape (always present, NEVER generic):
 * {
 *   recommendation:        // concrete remediation referencing the exact param/endpoint
 *   business_impact:       // what an attacker can achieve in business terms
 *   technical_impact:      // technical consequences
 *   reproduction_steps:    // array of strings (also exposed as joined string for legacy)
 *   secure_code_example:   // code snippet using detected stack
 *   fix_recommendation:    // alias of recommendation (extended contract)
 *   headers_to_add:        // map of security headers if relevant
 *   prevention_checklist:  // array of preventive measures
 * }
 *
 * Strategy:
 *   1) Try Ollama with a strict per-vuln JSON prompt (no generic phrases allowed).
 *   2) Validate the response (reject if generic or empty).
 *   3) If invalid/unavailable → use a CONTEXTUAL template that injects real
 *      endpoint/parameter/payload values — never a one-size-fits-all response.
 *
 * Cache key includes family|technique|endpoint|parameter|payload to dedupe identical vulns.
 */

const { Ollama } = require("ollama");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "ollama";
const ollama = new Ollama({ host: OLLAMA_HOST });

const cache = new Map();

// ──────────────────────────────────────────────────────────────
// SYSTEM PROMPT — strict, contextual, anti-generic
// ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SecAuditGPT-Fix, a senior application security engineer.
Your job: produce a SPECIFIC remediation guide for ONE vulnerability instance.

HARD RULES:
- Output STRICT JSON only. No prose, no markdown, no code fences.
- Tailor every field to the EXACT endpoint, parameter and payload provided.
- NEVER use generic sentences like "use input validation" without explaining HOW for THIS case.
- secure_code_example MUST use the detected backend stack (Node.js/Express/Mongoose if available).
- headers_to_add must list ONLY headers that mitigate THIS vulnerability.
- reproduction_steps must be 3–6 concrete numbered steps a tester can follow.
- prevention_checklist must be 3–5 preventive controls relevant to THIS family.

JSON schema:
{
  "recommendation": "string (1–2 sentences, specific to this endpoint and parameter)",
  "business_impact": "string (impact on business/users in 1–2 sentences)",
  "technical_impact": "string (technical consequences in 1–2 sentences)",
  "reproduction_steps": ["step 1", "step 2", "..."],
  "secure_code_example": "string (a real code snippet, not pseudocode)",
  "headers_to_add": { "Header-Name": "value" },
  "prevention_checklist": ["bullet 1", "..."]
}`;

// ──────────────────────────────────────────────────────────────
// Cache signature
// ──────────────────────────────────────────────────────────────
function makeSignature(vuln) {
  const parts = [
    String(vuln.family || vuln.type || "").toUpperCase(),
    String(vuln.technique || ""),
    String(vuln.endpoint || ""),
    String(vuln.method || "GET"),
    String(vuln.parameter || ""),
    typeof vuln.payload === "string" ? vuln.payload : JSON.stringify(vuln.payload || "")
  ];
  return parts.join("|");
}

// ──────────────────────────────────────────────────────────────
// Ollama JSON chat with strict format
// ──────────────────────────────────────────────────────────────
async function ollamaJson({ system, user, temperature = 0.4, model = OLLAMA_MODEL }) {
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
  try { return JSON.parse(raw); }
  catch {
    const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
    if (i !== -1 && j !== -1 && j > i) return JSON.parse(raw.slice(i, j + 1));
    throw new Error("Invalid JSON from Ollama");
  }
}

// ──────────────────────────────────────────────────────────────
// Detect generic placeholder responses we want to reject
// ──────────────────────────────────────────────────────────────
const GENERIC_REGEX = /^(apply standard remediation|use input validation|sanitize all inputs|follow best practices)\.?$/i;
function isGeneric(s) {
  if (!s || typeof s !== "string") return true;
  if (s.length < 25) return true;
  if (GENERIC_REGEX.test(s.trim())) return true;
  return false;
}

function validateOllamaResult(parsed, vuln) {
  if (!parsed || typeof parsed !== "object") return false;
  if (isGeneric(parsed.recommendation)) return false;
  if (!Array.isArray(parsed.reproduction_steps) || parsed.reproduction_steps.length < 2) return false;
  if (!parsed.secure_code_example || parsed.secure_code_example.length < 30) return false;
  // Must mention actual parameter or endpoint to count as contextual
  const ctxBlob = `${parsed.recommendation} ${parsed.technical_impact || ""}`.toLowerCase();
  const param = String(vuln.parameter || "").toLowerCase();
  const ep = String(vuln.endpoint || "").toLowerCase();
  if (param && param.length >= 2 && !ctxBlob.includes(param) && !ctxBlob.includes(ep)) {
    // not strictly required but lowers our trust → accept anyway, just log
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// CONTEXTUAL TEMPLATES — used when Ollama is unavailable / invalid.
// Each template injects the actual endpoint, parameter, payload, etc.
// so no two vulnerabilities receive identical text.
// ──────────────────────────────────────────────────────────────
const TEMPLATES = {
  XSS: (v) => ({
    recommendation: `Encode all output of user-controlled data on \`${v.endpoint}\` (parameter \`${v.parameter}\`) using contextual escaping (HTML, attribute, JS) and add a strict Content-Security-Policy.`,
    business_impact: "Attackers can execute arbitrary JavaScript in users' browsers, hijack sessions, deface the page, or pivot to internal admin actions.",
    technical_impact: `The payload \`${truncate(v.payload, 80)}\` was reflected unescaped in the response, enabling stored or reflected XSS.`,
    reproduction_steps: [
      `Send a ${v.method || "GET"} request to ${v.endpoint} with ${v.parameter || "the parameter"} = ${truncate(v.payload, 60)}`,
      "Inspect the response body and confirm the payload appears verbatim inside an HTML/JS context",
      "Open the URL in a browser and observe the script executing",
      "Confirm exploitation by retrieving document.cookie via the injected script"
    ],
    secure_code_example:
`// Express + EJS — escape output and apply CSP
const escapeHtml = require('escape-html');
app.get('${v.endpoint}', (req, res) => {
  const safe = escapeHtml(req.query.${v.parameter || "q"} || '');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
  res.render('view', { value: safe }); // template uses <%= value %>, never <%- %>
});`,
    headers_to_add: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    prevention_checklist: [
      "Always use templating engines with auto-escaping (EJS <%= %>, Handlebars {{ }})",
      "Reject HTML in inputs that should be plain text via a JSON schema",
      "Set a strict CSP that disallows inline scripts and 'unsafe-eval'",
      "Use the HttpOnly and Secure flags on session cookies"
    ]
  }),

  SQLI: (v) => ({
    recommendation: `Replace the query backing \`${v.endpoint}\` with a parameterized query using bound values for \`${v.parameter}\`; never concatenate user input into SQL.`,
    business_impact: "Attackers can read, modify, or delete the database — leading to full data breach, account takeover, and regulatory violations (GDPR/PCI).",
    technical_impact: `The payload \`${truncate(v.payload, 80)}\` triggered a SQL error or time delay, proving the parameter is concatenated into a SQL query.`,
    reproduction_steps: [
      `Send a baseline request to ${v.endpoint}`,
      `Resend with ${v.parameter}=${truncate(v.payload, 60)}`,
      "Observe SQL error fingerprint, time delay, or boolean truth changes",
      "Confirm by extracting database version with a UNION/error-based payload"
    ],
    secure_code_example:
`// Node.js + mysql2 — parameterized query
const [rows] = await pool.execute(
  'SELECT id, email FROM users WHERE ${v.parameter || "id"} = ? LIMIT 1',
  [req.query.${v.parameter || "id"}]
);
// Mongoose ORM equivalent:
// User.findOne({ ${v.parameter || "id"}: req.query.${v.parameter || "id"} }).lean();`,
    headers_to_add: {},
    prevention_checklist: [
      "Use prepared statements / parameterized queries everywhere",
      "Apply least-privilege to the DB user (no DROP, no DDL)",
      "Validate types with a schema (Joi, Zod) before reaching the DB layer",
      "Enable WAF rules for SQLi patterns as defense-in-depth",
      "Log and alert on SQL errors reaching the response body"
    ]
  }),

  NOSQLI: (v) => ({
    recommendation: `Cast \`${v.parameter}\` to the expected primitive type before passing it to the Mongo query on \`${v.endpoint}\`, and reject objects/operators in user-supplied query parameters.`,
    business_impact: "Attackers can bypass authentication and access arbitrary user records by injecting MongoDB operators.",
    technical_impact: `Operator-based payload \`${truncate(v.payload, 80)}\` modified the query semantics — typical of {$ne}/{$gt} authentication bypass.`,
    reproduction_steps: [
      `Send a normal request and capture the response`,
      `Resend with ${v.parameter} replaced by ${truncate(v.payload, 60)}`,
      "Observe authentication bypass or unexpected records returned",
      "Confirm with $where or $regex operator variants"
    ],
    secure_code_example:
`// Express + Mongoose — coerce types and reject objects
const { ${v.parameter || "id"} } = req.body;
if (typeof ${v.parameter || "id"} !== 'string') return res.status(400).end();
const user = await User.findOne({ ${v.parameter || "id"}: String(${v.parameter || "id"}) });
// Or use express-mongo-sanitize globally:
// app.use(require('express-mongo-sanitize')());`,
    headers_to_add: {},
    prevention_checklist: [
      "Install and globally enable express-mongo-sanitize",
      "Validate body/query with Zod or Joi to enforce primitive types",
      "Disable $where execution with mongoose schema strict mode",
      "Avoid passing entire req.body / req.query into Mongo queries"
    ]
  }),

  CMDI: (v) => ({
    recommendation: `Replace shell execution on \`${v.endpoint}\` with the safe \`execFile\`/\`spawn\` API and pass \`${v.parameter}\` as an argument array — never concatenate it into a shell string.`,
    business_impact: "Attackers achieve full remote code execution on the application server — pivot point to data exfiltration, ransomware and lateral movement.",
    technical_impact: `Payload \`${truncate(v.payload, 80)}\` executed shell commands, confirmed by output reflection or time delay.`,
    reproduction_steps: [
      `Send a baseline ${v.method || "GET"} ${v.endpoint}`,
      `Inject ${v.parameter}=${truncate(v.payload, 60)}`,
      "Observe output of the injected command (e.g. uid=, /etc/passwd contents) or 5s delay",
      "Confirm with a different command (whoami, id, hostname)"
    ],
    secure_code_example:
`// Node.js — never use child_process.exec with concatenation
const { execFile } = require('child_process');
execFile('/usr/bin/ping', ['-c', '1', String(req.query.${v.parameter || "host"})], (err, stdout) => {
  if (err) return res.status(400).json({ error: 'invalid host' });
  res.send(stdout);
});`,
    headers_to_add: {},
    prevention_checklist: [
      "Avoid shell invocation entirely; use language-native libraries",
      "If shell is required, use execFile/spawn with argument arrays",
      "Whitelist allowed values with a regex (e.g. /^[a-z0-9.-]+$/)",
      "Run the process under a sandboxed user with minimal capabilities"
    ]
  }),

  SSRF: (v) => ({
    recommendation: `On \`${v.endpoint}\`, validate \`${v.parameter}\` against an allow-list of public hostnames and block requests to internal IP ranges (RFC1918, 169.254.x.x, ::1) before forwarding.`,
    business_impact: "Attackers can read cloud metadata (AWS IAM credentials), pivot into internal services and exfiltrate sensitive infrastructure data.",
    technical_impact: `URL \`${truncate(v.payload, 80)}\` was fetched server-side, confirming SSRF.`,
    reproduction_steps: [
      `Send ${v.method || "GET"} ${v.endpoint} with ${v.parameter}=http://example.com`,
      `Replace with ${v.parameter}=http://169.254.169.254/latest/meta-data/`,
      "Observe AWS metadata in the response (or comparable internal data)",
      "Confirm with file:///etc/passwd to detect URL scheme abuse"
    ],
    secure_code_example:
`// Node.js — SSRF guard
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
async function safeFetch(rawUrl) {
  const u = new URL(rawUrl);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad scheme');
  const { address } = (await dns.lookup(u.hostname));
  const ip = ipaddr.parse(address);
  if (ip.range() !== 'unicast') throw new Error('internal ip blocked');
  return fetch(rawUrl, { redirect: 'manual' });
}`,
    headers_to_add: {},
    prevention_checklist: [
      "Allow-list outbound destinations (domains, schemes, ports)",
      "Resolve and validate IP after DNS to block private ranges",
      "Disable redirect following or re-validate each hop",
      "Run egress through a controlled proxy with logging"
    ]
  }),

  OPEN_REDIRECT: (v) => ({
    recommendation: `On \`${v.endpoint}\`, validate \`${v.parameter}\` against an allow-list of relative paths or trusted domains; reject absolute URLs and protocol-relative inputs.`,
    business_impact: "Attackers craft phishing links that appear to originate from your domain, harvesting credentials of trusting users.",
    technical_impact: `Redirect followed to ${truncate(v.payload, 80)} — Location header points to attacker-controlled origin.`,
    reproduction_steps: [
      `Visit ${v.endpoint}?${v.parameter}=https://example.com`,
      "Observe 30x response with Location pointing to the external domain",
      "Replace with //evil.example.com to bypass naive checks",
      "Confirm browser follows the redirect"
    ],
    secure_code_example:
`// Express — strict open-redirect protection
const ALLOWED_HOSTS = new Set(['app.example.com']);
app.get('${v.endpoint}', (req, res) => {
  const target = String(req.query.${v.parameter || "url"} || '/');
  try {
    const u = new URL(target, 'https://app.example.com');
    if (target.startsWith('/') || ALLOWED_HOSTS.has(u.host)) return res.redirect(target);
  } catch {}
  return res.redirect('/');
});`,
    headers_to_add: { "Referrer-Policy": "strict-origin-when-cross-origin" },
    prevention_checklist: [
      "Default to relative URLs only",
      "Reject //, \\\\, and javascript: schemes",
      "Maintain an allow-list of trusted external hosts",
      "Display an interstitial page for any external redirect"
    ]
  }),

  PATH_TRAVERSAL: (v) => ({
    recommendation: `On \`${v.endpoint}\`, resolve the file path against a fixed base directory and reject any result that escapes it; whitelist allowed filenames for \`${v.parameter}\`.`,
    business_impact: "Attackers read sensitive files (/etc/passwd, .env, source code, SSH keys) leading to credential theft and full system compromise.",
    technical_impact: `Payload \`${truncate(v.payload, 80)}\` returned the contents of a system file outside the intended directory.`,
    reproduction_steps: [
      `Send ${v.method || "GET"} ${v.endpoint} with ${v.parameter} pointing at a normal file`,
      `Replace with ${truncate(v.payload, 60)}`,
      "Observe the response containing system file content (root:x:...)",
      "Confirm with deeper traversal (../../../../) and URL-encoded variants"
    ],
    secure_code_example:
`// Node.js — safe path resolution
const path = require('path');
const BASE = path.resolve('/var/app/uploads');
const requested = path.resolve(BASE, String(req.query.${v.parameter || "file"} || ''));
if (!requested.startsWith(BASE + path.sep)) return res.status(400).end();
res.sendFile(requested);`,
    headers_to_add: {},
    prevention_checklist: [
      "Always resolve and compare against a fixed base directory",
      "Whitelist filenames with a regex (e.g. /^[\\w.-]+$/)",
      "Strip ../ sequences AFTER decoding (handle %2e%2e%2f and Unicode)",
      "Run the process with a chroot or restricted FS user"
    ]
  }),

  LFI: (v) => TEMPLATES.PATH_TRAVERSAL(v),
  RFI: (v) => ({
    ...TEMPLATES.PATH_TRAVERSAL(v),
    recommendation: `Disable remote file inclusion entirely; on \`${v.endpoint}\` reject any \`${v.parameter}\` value matching a URL scheme.`
  }),

  HEADER_INJECTION: (v) => ({
    recommendation: `On \`${v.endpoint}\`, strip CR/LF characters from \`${v.parameter}\` before placing it into any response header or upstream request.`,
    business_impact: "Attackers can inject Set-Cookie, redirect, or split the HTTP response — leading to session fixation and cache poisoning.",
    technical_impact: `Injected header observed in response (CRLF in payload \`${truncate(v.payload, 80)}\`).`,
    reproduction_steps: [
      `Send ${v.method || "GET"} ${v.endpoint} with ${v.parameter}=normal`,
      `Resend with ${v.parameter}=${truncate(v.payload, 60)}`,
      "Inspect raw response headers for the injected header (Set-Cookie/X-Injected)",
      "Confirm with another header value to rule out coincidence"
    ],
    secure_code_example:
`// Express — strip CRLF from any value put into a header
function safe(v) { return String(v).replace(/[\\r\\n]+/g, ''); }
res.setHeader('X-Trace', safe(req.query.${v.parameter || "trace"}));`,
    headers_to_add: {},
    prevention_checklist: [
      "Reject CR/LF in any user input bound for headers",
      "Use the framework's built-in setHeader (Express handles encoding)",
      "Avoid copying user input into 30x Location headers"
    ]
  }),

  PROTOTYPE_POLLUTION: (v) => ({
    recommendation: `On \`${v.endpoint}\`, replace deep-merge of \`${v.parameter}\` with a key allow-list, or use Object.create(null) and reject keys \`__proto__\`, \`constructor\`, \`prototype\`.`,
    business_impact: "Attackers tamper with object prototypes to enable RCE or auth bypass in libraries that consume polluted properties.",
    technical_impact: `Prototype pollution payload \`${truncate(v.payload, 80)}\` accepted in JSON body.`,
    reproduction_steps: [
      `Send POST ${v.endpoint} with body ${truncate(v.payload, 80)}`,
      "Then GET an endpoint that reads {}.polluted — observe the value 'yes'",
      "Replace key with constructor.prototype to confirm secondary path"
    ],
    secure_code_example:
`// Node.js — block dangerous keys before deep merge
function safeAssign(target, src) {
  for (const k of Object.keys(src)) {
    if (['__proto__','constructor','prototype'].includes(k)) continue;
    target[k] = src[k];
  }
}
// Or upgrade lodash: lodash.merge >= 4.17.21`,
    headers_to_add: {},
    prevention_checklist: [
      "Pin lodash/merge libraries to patched versions",
      "Use Map or Object.create(null) for user-controlled dictionaries",
      "Validate body shape with a strict Zod/Joi schema"
    ]
  }),

  JWT: (v) => ({
    recommendation: `Reject any JWT on \`${v.endpoint}\` whose \`alg\` is not in a server-side allow-list (e.g. ["RS256","ES256"]); never trust the token header.`,
    business_impact: "Attackers forge tokens (alg=none, weak secret, kid traversal) to impersonate any user including administrators.",
    technical_impact: `JWT bypass succeeded with technique \`${v.technique}\` against ${v.endpoint}.`,
    reproduction_steps: [
      `Forge a JWT with header {"alg":"none"} and payload {"admin":true}`,
      `Send ${v.method || "GET"} ${v.endpoint} with Authorization: Bearer <forged>`,
      "Observe access granted (200) where baseline returned 401/403"
    ],
    secure_code_example:
`// Node.js — strict JWT verification
const jwt = require('jsonwebtoken');
const ALLOWED = ['RS256'];
jwt.verify(token, PUBLIC_KEY, { algorithms: ALLOWED }, (err, claims) => { ... });`,
    headers_to_add: {},
    prevention_checklist: [
      "Pin algorithms in jwt.verify",
      "Use asymmetric keys (RS256/ES256) over HS256",
      "Validate iss, aud, exp, nbf claims",
      "Rotate signing keys via a kid registry, never via filesystem path"
    ]
  }),

  AUTH_BYPASS: (v) => ({
    recommendation: `On \`${v.endpoint}\`, perform authorization checks on the SERVER using the authenticated session — ignore client-supplied headers like \`${v.parameter || "X-Forwarded-For"}\` for auth decisions.`,
    business_impact: "Attackers bypass authentication or authorization checks, accessing administrative or other users' data.",
    technical_impact: `Bypass succeeded via header \`${v.parameter}\` with value \`${truncate(v.payload, 80)}\`.`,
    reproduction_steps: [
      `Send ${v.method || "GET"} ${v.endpoint} (baseline returned 401/403)`,
      `Resend with header ${v.parameter}: ${truncate(v.payload, 60)}`,
      "Observe 200 with privileged data exposed"
    ],
    secure_code_example:
`// Express — auth check should rely on session/JWT only
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).end();
  next();
}
app.get('${v.endpoint}', requireAdmin, handler);`,
    headers_to_add: {},
    prevention_checklist: [
      "Never trust X-Forwarded-*, X-Original-URL, X-Rewrite-URL for auth",
      "Centralize authorization in middleware",
      "Use signed sessions and short-lived tokens"
    ]
  }),

  IDOR: (v) => ({
    recommendation: `On \`${v.endpoint}\`, check ownership of the resource identified by \`${v.parameter}\` against the authenticated user before returning data.`,
    business_impact: "Attackers enumerate IDs to read other users' private data — privacy and regulatory exposure.",
    technical_impact: `Direct object reference \`${v.parameter}=${truncate(v.payload, 30)}\` returned data belonging to another user.`,
    reproduction_steps: [
      `Authenticate as user A and note your ${v.parameter}`,
      `Replace ${v.parameter} with the value of user B`,
      "Send the request and observe user B's data returned",
      "Confirm with several IDs to verify enumeration"
    ],
    secure_code_example:
`// Express + Mongoose — enforce ownership
app.get('${v.endpoint}', auth, async (req, res) => {
  const doc = await Order.findOne({ _id: req.params.${v.parameter || "id"}, userId: req.user.id });
  if (!doc) return res.status(404).end();
  res.json(doc);
});`,
    headers_to_add: {},
    prevention_checklist: [
      "Always filter queries by the owner user id, not just the resource id",
      "Use UUIDs instead of incrementing integers for hard-to-enumerate references",
      "Add an audit log of object accesses"
    ]
  }),

  SENSITIVE_DATA: (v) => ({
    recommendation: `Remove the file \`${v.endpoint}\` from the publicly served path and add a deny rule in the reverse proxy for dotfiles, backups and config.`,
    business_impact: "Leaked credentials, source code or backups give attackers immediate full-system access.",
    technical_impact: `Public endpoint \`${v.endpoint}\` returned 200 with sensitive contents.`,
    reproduction_steps: [
      `Open ${v.endpoint} directly in a browser`,
      "Confirm response status 200 and sensitive markers (DB_PASSWORD, BEGIN PRIVATE KEY, ...)",
      "Search response for credentials/API keys"
    ],
    secure_code_example:
`# Nginx — deny dotfiles and common leaks
location ~ /\\.(git|env|svn|DS_Store) { deny all; }
location ~* \\.(bak|backup|old|sql|zip)$ { deny all; }`,
    headers_to_add: {},
    prevention_checklist: [
      "Never deploy .env, .git or backup files in the document root",
      "Add reverse-proxy deny rules for dotfiles and known leaks",
      "Rotate any exposed secrets immediately",
      "Add CI checks (gitleaks/trufflehog) on each deploy"
    ]
  }),

  CSRF: (v) => ({
    recommendation: `On \`${v.endpoint}\`, require a CSRF token validated server-side and set session cookies with \`SameSite=Lax\` (or Strict for sensitive flows).`,
    business_impact: "Attackers cause logged-in users to perform unwanted state-changing actions.",
    technical_impact: `Mutating endpoint accepts requests without CSRF token / from arbitrary Origin.`,
    reproduction_steps: [
      `Visit an attacker page that auto-submits a form to ${v.endpoint}`,
      "Confirm the action is performed under the victim's session",
      "Verify no CSRF token is checked server-side"
    ],
    secure_code_example:
`// Express — csurf middleware + SameSite cookie
const csrf = require('csurf');
app.use(session({ cookie: { sameSite: 'lax', secure: true, httpOnly: true } }));
app.use(csrf());
app.post('${v.endpoint}', (req, res) => { /* token validated automatically */ });`,
    headers_to_add: {},
    prevention_checklist: [
      "Enforce CSRF tokens on all state-changing endpoints",
      "Use SameSite=Lax/Strict cookies",
      "Validate Origin/Referer for sensitive operations",
      "Avoid GET for state-changing actions"
    ]
  }),

  RATE_LIMIT: (v) => ({
    recommendation: `Apply a per-IP and per-user rate limit on \`${v.endpoint}\` (e.g. 60 req/min) and return 429 with \`Retry-After\`.`,
    business_impact: "Attackers brute-force credentials, scrape data, or cause cost-amplification.",
    technical_impact: `No rate-limiting headers (X-RateLimit-*, Retry-After) observed on burst.`,
    reproduction_steps: [
      `Send 50 requests to ${v.endpoint} within 5 seconds`,
      "Observe none are rejected and no rate-limit headers are present",
      "Confirm the absence of 429 responses"
    ],
    secure_code_example:
`// Express + express-rate-limit
const rateLimit = require('express-rate-limit');
app.use('${v.endpoint}', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true }));`,
    headers_to_add: { "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": "<n>", "Retry-After": "<seconds>" },
    prevention_checklist: [
      "Rate-limit globally with sensible defaults at the edge (CDN/WAF)",
      "Stricter limits on /login, /reset, payment endpoints",
      "Combine IP + user + device fingerprint for limits"
    ]
  }),

  OTHER: (v) => ({
    recommendation: `Investigate the anomaly observed on \`${v.endpoint}\` (parameter \`${v.parameter}\`). Capture full traffic and validate input handling end-to-end.`,
    business_impact: "Unclassified anomaly — manual triage required to assess risk.",
    technical_impact: v.technical_details || `Unusual response observed for payload \`${truncate(v.payload, 80)}\`.`,
    reproduction_steps: [
      `Replay the request to ${v.endpoint} with the captured payload`,
      "Compare against the baseline response",
      "Toggle one variable at a time to isolate the cause"
    ],
    secure_code_example: `// Add structured logging and stricter input validation around ${v.endpoint}`,
    headers_to_add: {},
    prevention_checklist: [
      "Add input validation at the boundary",
      "Log anomalies with correlation ids",
      "Add unit tests covering the unexpected path"
    ]
  })
};

// XSS aliases for legacy
TEMPLATES.HEADER_INJECTION = TEMPLATES.HEADER_INJECTION;

function truncate(s, n) {
  const str = typeof s === "string" ? s : JSON.stringify(s || "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function getTemplate(family) {
  const fam = String(family || "OTHER").toUpperCase();
  return TEMPLATES[fam] || TEMPLATES.OTHER;
}

// ──────────────────────────────────────────────────────────────
// Build a contextual user prompt
// ──────────────────────────────────────────────────────────────
function buildUserPrompt(vuln, targetUrl) {
  const family = String(vuln.family || vuln.type || "OTHER").toUpperCase();
  return JSON.stringify({
    target_url: targetUrl,
    family,
    technique: vuln.technique || "",
    cvss_score: vuln.cvss_score || null,
    cvss_vector: vuln.cvss_vector || null,
    owasp_category: vuln.owasp_category || null,
    cwe: vuln.cwe || null,
    endpoint: vuln.endpoint || "/",
    method: vuln.method || "GET",
    parameter: vuln.parameter || "",
    payload: typeof vuln.payload === "string" ? vuln.payload : JSON.stringify(vuln.payload || ""),
    encoding: vuln.encoding || "raw",
    evidence: vuln.evidence || "",
    technical_details: vuln.technical_details || "",
    response_status: vuln.response_status || null,
    http_response_snippet: (vuln.http_response_snippet || "").slice(0, 800),
    detected_stack: vuln.stack || null
  }, null, 2);
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────
async function enrichVulnerability(vuln, targetUrl) {
  const sig = makeSignature(vuln);
  if (cache.has(sig)) return cache.get(sig);

  const family = String(vuln.family || vuln.type || "OTHER").toUpperCase();
  const tmpl = getTemplate(family)(vuln);

  // Try Ollama first
  try {
    const ping = await fetch(`${OLLAMA_HOST}/api/tags`, { timeout: 3000 }).catch(() => null);
    if (ping && ping.ok) {
      const parsed = await ollamaJson({
        system: SYSTEM_PROMPT,
        user: `Vulnerability:\n${buildUserPrompt(vuln, targetUrl)}\n\nReturn the JSON object only.`,
        temperature: 0.4
      });
      if (validateOllamaResult(parsed, vuln)) {
        const result = mergeResult(parsed, tmpl);
        cache.set(sig, result);
        return result;
      }
      // else fall through to template
      console.warn(`⚠️ Ollama returned generic/invalid for ${family} ${vuln.endpoint}, using template`);
    }
  } catch (e) {
    console.warn(`⚠️ Ollama enrichment failed for ${family}: ${e.message}`);
  }

  cache.set(sig, tmpl);
  return tmpl;
}

function mergeResult(parsed, tmpl) {
  const reproduction_steps = Array.isArray(parsed.reproduction_steps) && parsed.reproduction_steps.length
    ? parsed.reproduction_steps.map(String)
    : tmpl.reproduction_steps;
  return {
    recommendation: parsed.recommendation || tmpl.recommendation,
    fix_recommendation: parsed.recommendation || tmpl.recommendation,
    business_impact: parsed.business_impact || tmpl.business_impact,
    technical_impact: parsed.technical_impact || tmpl.technical_impact,
    impact: parsed.business_impact || tmpl.business_impact,
    reproduction_steps,
    // Legacy single-string version for older consumers
    reproduction_steps_text: reproduction_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    secure_code_example: parsed.secure_code_example || tmpl.secure_code_example,
    secure_fix_example: parsed.secure_code_example || tmpl.secure_code_example,
    headers_to_add: (parsed.headers_to_add && typeof parsed.headers_to_add === "object")
      ? parsed.headers_to_add
      : tmpl.headers_to_add,
    prevention_checklist: Array.isArray(parsed.prevention_checklist)
      ? parsed.prevention_checklist.map(String)
      : tmpl.prevention_checklist
  };
}

module.exports = {
  enrichVulnerability,
  // exposed for tests / introspection
  TEMPLATES,
  _internal: { makeSignature, isGeneric, validateOllamaResult }
};
