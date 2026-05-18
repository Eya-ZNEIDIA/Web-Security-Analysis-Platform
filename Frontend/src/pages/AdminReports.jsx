import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShieldAlert,
  BarChart3,
  Clock,
  Cpu,
  Globe,
  Server,
  FileText,
  List,
  Activity,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowLeft,
} from "lucide-react";
import { getAdminAuditReport, normalizeAuditReport } from "../services/authService";
import VulnerabilityCard from "../components/VulnerabilityCard";
import PDFExportModal from "../components/PDFExportModal";
import { useLanguageToggle } from "../hooks/useLanguageToggle";
import { useDownloadPDF } from "../hooks/useDownloadPDF";

const severityMeta = {
  Critique: { color: "#dc2626", bg: "#fee2e2", border: "#fecaca", label: "Critique" },
  "Élevé": { color: "#ea580c", bg: "#ffedd5", border: "#fed7aa", label: "Élevé" },
  Moyen: { color: "#ca8a04", bg: "#fef9e7", border: "#fef3c7", label: "Moyen" },
  Faible: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "Faible" },
  Info: { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", label: "Info" },
};

const scoreColor = (s) => (s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#ef4444");
const scoreLabel = (s) => (s >= 75 ? "Sécurisé" : s >= 50 ? "Risque modéré" : "Critique");

function ScoreRing({ score, size = 140 }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size / 18} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size / 18}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(.4,0,.2,1)" }}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={size / 5} fill={color} fontWeight="800">{score}</text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize={size / 12} fill="#9ca3af" fontWeight="500">/100</text>
    </svg>
  );
}

function StatTile({ icon, label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function TimelineEvent({ evt }) {
  const levelColor =
    evt.level === "error" ? "#dc2626" : evt.level === "warn" ? "#ca8a04" : "#16a34a";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: levelColor }} />
        <div className="w-px flex-1 bg-gray-200 my-1" />
      </div>
      <div className="pb-4">
        <p className="text-[11px] font-semibold text-gray-700">{evt.phase}</p>
        <p className="text-xs text-gray-500">{evt.message}</p>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [searchParams] = useSearchParams();
  const auditId = searchParams.get("auditId");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPDFModal, setShowPDFModal] = useState(false);

  // Langue du rapport
  const { reportLanguage, handleLanguageChange } = useLanguageToggle();
  const { downloadPDF, loading: pdfLoading } = useDownloadPDF();

  const fetchReport = async () => {
    if (!auditId) {
      setError("Paramètre auditId manquant dans l'URL");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const raw = await getAdminAuditReport(auditId);
      setReport(normalizeAuditReport(raw));
    } catch (e) {
      console.error(e);
      setError(e?.message || "Impossible de charger le rapport");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [auditId]);

  const severityCounts = useMemo(() => {
    const counts = { Critique: 0, "Élevé": 0, Moyen: 0, Faible: 0, Info: 0 };
    (report?.vulns || []).forEach((v) => {
      const s = v.severity;
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [report]);

  const topVulns = useMemo(() => {
    return [...(report?.vulns || [])]
      .sort((a, b) => (b.cvss_score || 0) - (a.cvss_score || 0))
      .slice(0, 5);
  }, [report]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-20 text-gray-400 text-sm">Chargement du rapport IA...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-20 text-gray-400 text-sm">Aucun rapport disponible</div>
      </div>
    );
  }

  const meta = report.reportMeta || {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-green-600" />
            Rapport d'audit IA
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{report.url}</p>
        </div>
        <div className="flex gap-2">
          {/* Sélecteur de langue */}
          <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleLanguageChange('fr')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportLanguage === 'fr'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🇫🇷 Français
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportLanguage === 'en'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🇬🇧 English
            </button>
          </div>

          {/* Bouton télécharger PDF */}
          <button
            onClick={() => setShowPDFModal(true)}
            className={`inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 transition`}
          >
            <Download size={13} />
            Télécharger PDF
          </button>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            <ArrowLeft size={13} />
            Retour
          </button>
        </div>
      </div>

      {/* Score hero */}
      <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-6 flex-wrap">
          <ScoreRing score={report.score} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Score global</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{report.score}/100 — {scoreLabel(report.score)}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(severityCounts).map(([sev, count]) => {
                if (!count) return null;
                const m = severityMeta[sev];
                return (
                  <span
                    key={sev}
                    className="text-xs px-2.5 py-1 rounded-full border font-semibold"
                    style={{ backgroundColor: m.bg, borderColor: m.border, color: m.color }}
                  >
                    {count} {m.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<ShieldAlert size={16} className="text-red-500" />}
          label="Vulnérabilités"
          value={report.vulns?.length || 0}
          sub={`${meta.statistics?.true_positives || 0} vrais positifs`}
        />
        <StatTile
          icon={<Activity size={16} className="text-blue-500" />}
          label="Requêtes envoyées"
          value={meta.statistics?.total_requests || 0}
          sub={`${meta.statistics?.total_endpoints || 0} endpoints testés`}
        />
        <StatTile
          icon={<Cpu size={16} className="text-purple-500" />}
          label="Modèle IA"
          value={meta.ai_model || "—"}
          sub={meta.ai_prompt_version || ""}
        />
        <StatTile
          icon={<Clock size={16} className="text-amber-500" />}
          label="Durée"
          value={meta.durationMs ? `${(meta.durationMs / 1000).toFixed(1)}s` : "—"}
          sub={`${meta.statistics?.total_payloads || 0} payloads`}
        />
      </div>

      {/* Executive summary */}
      {meta.executive_summary && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-green-600" />
            Résumé exécutif
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
            {meta.executive_summary}
          </div>
        </div>
      )}

      {/* Risk breakdown + timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            Répartition par sévérité
          </h2>
          <div className="space-y-3">
            {Object.entries(meta.risk_breakdown || {}).map(([key, count]) => {
              const m = severityMeta[key.charAt(0).toUpperCase() + key.slice(1)] || severityMeta.Info;
              const total = Object.values(meta.risk_breakdown || {}).reduce((a, b) => a + (b || 0), 0) || 1;
              const pct = Math.round(((count || 0) / total) * 100);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 capitalize">{key}</span>
                    <span className="text-gray-500">{count || 0} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <List size={16} className="text-amber-500" />
            Timeline de l'audit
          </h2>
          <div className="max-h-72 overflow-y-auto pr-1">
            {(meta.timeline || []).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun événement dans la timeline</p>
            ) : (
              (meta.timeline || []).map((evt, idx) => <TimelineEvent key={idx} evt={evt} />)
            )}
          </div>
        </div>
      </div>

      {/* Top vulnerabilities */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ShieldAlert size={16} className="text-red-500" />
          Top vulnérabilités (par CVSS)
        </h2>
        <div className="space-y-3">
          {topVulns.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune vulnérabilité détectée</p>
          ) : (
            topVulns.map((v, i) => (
              <VulnerabilityCard key={v.id} vulnerability={v} index={i} />
            ))
          )}
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-green-900 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            Recommandations
          </h2>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/60 rounded-xl px-3.5 py-2.5 border border-green-100">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">{i + 1}</span>
                <p className="text-xs text-green-800 leading-relaxed flex-1">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <PDFExportModal
        isOpen={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        reportId={report._id || report.reportId}
        reportTitle="Security Audit Report"
      />
    </div>
  );
}
