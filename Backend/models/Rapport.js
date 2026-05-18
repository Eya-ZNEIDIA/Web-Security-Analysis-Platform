const mongoose = require("mongoose");

const TimelineEventSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  phase: String,           // VALIDATE | RECON | PLAN | EXECUTE | DETECT | ENRICH | REPORT
  level: String,           // info | warn | error
  message: String,
  meta: mongoose.Schema.Types.Mixed
}, { _id: false });

const RapportSchema = new mongoose.Schema({
  auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit" },

  // Generation meta
  dateGeneration: { type: Date, default: Date.now },
  durationMs: Number,
  ai_model: String,
  ai_prompt_version: String,

  // Narrative
  resume: String,
  executive_summary: String,

  // Scoring
  scoreGlobal: Number,
  risk_breakdown: {
    critical: { type: Number, default: 0 },
    high:     { type: Number, default: 0 },
    medium:   { type: Number, default: 0 },
    low:      { type: Number, default: 0 },
    info:     { type: Number, default: 0 }
  },

  // Statistics
  statistics: {
    total_requests:               { type: Number, default: 0 },
    total_endpoints:              { type: Number, default: 0 },
    total_payloads:               { type: Number, default: 0 },
    total_vulnerabilities:        { type: Number, default: 0 },
    true_positives:               { type: Number, default: 0 },
    suppressed_false_positives:   { type: Number, default: 0 },
    avg_confidence:               { type: Number, default: 0 },
    avg_cvss:                     { type: Number, default: 0 }
  },

  // Surface tested
  endpoints_tested: { type: [String], default: [] },
  families_tested:  { type: [String], default: [] },

  // Timeline of phases
  timeline: { type: [TimelineEventSchema], default: [] },

  // Headers / recommendations roll-up
  headers: { type: Array, default: [] },
  recommendations: { type: [String], default: [] },

  // Vulnerabilities
  vulnerabilites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vulnerabilite" }]
}, { timestamps: true });

module.exports = mongoose.model("Rapport", RapportSchema);
