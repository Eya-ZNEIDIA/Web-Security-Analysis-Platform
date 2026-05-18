const mongoose = require("mongoose");

const VulnerabiliteSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit" },

  // ─── Legacy / French fields (preserved for backward compat) ───
  type: String,
  niveauRisque: String,         // critical|high|medium|low
  description: String,
  recommandation: String,
  priorite: String,
  category: String,             // CWE / family for radar chart
  risk_score: Number,           // 0..100

  // ─── Extended fields (new audit pipeline) ─────────────────────
  // Identity
  technique: String,            // e.g. "time-mysql", "img-onerror"
  owasp_category: String,       // e.g. "A03:2021-Injection"
  cwe: String,                  // e.g. "CWE-89"

  // Severity
  severity: String,             // critical|high|medium|low|info
  cvss_score: Number,           // 0..10
  cvss_vector: String,          // "CVSS:3.1/AV:N/AC:L/..."

  // HTTP target
  endpoint: String,
  method: String,
  parameter: String,
  payload: String,
  encoding: String,             // raw | url | double-url | unicode | base64

  // Evidence
  evidence: String,             // short proof
  http_response_snippet: String,// up to 4KB
  response_status: Number,
  response_headers: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Narrative (per-vuln, contextual — NOT generic)
  technical_details: String,
  business_impact: String,
  reproduction_steps: { type: [String], default: [] },
  fix_recommendation: String,
  secure_code_example: String,
  headers_to_add: { type: mongoose.Schema.Types.Mixed, default: {} },

  // AI / scoring meta
  ai_confidence: Number,        // 0..1
  detection_source: String,     // rule | ai | hybrid
  is_true_positive: { type: Boolean, default: true },
  detected_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Useful indexes
VulnerabiliteSchema.index({ auditId: 1, severity: 1 });
VulnerabiliteSchema.index({ userId: 1, detected_at: -1 });

module.exports = mongoose.model("Vulnerabilite", VulnerabiliteSchema);