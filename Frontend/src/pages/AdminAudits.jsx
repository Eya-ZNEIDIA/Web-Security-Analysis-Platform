import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, ExternalLink, ChevronRight, ChevronLeft, Filter, X, Clock, ShieldAlert, Server, Globe, BarChart3, FileText, List, Activity, Download, ArrowUpDown } from "lucide-react";
import { getAllAuditsAdmin, getAdminAuditReport, normalizeVulnerability } from "../services/authService";
import { isLikelyUrl, extractDomain, faviconUrl, displayUrl, isTechnicalId } from "../utils/urlHelpers";

const normalizeRiskLabel = (risk) => {
  const r = (risk ?? "").toString().trim().toLowerCase();
  if (r === "critical" || r === "critique") return "Critique";
  if (r === "high" || r === "élevé" || r === "eleve" || r === "éleve") return "Élevé";
  if (r === "medium" || r === "moyen") return "Moyen";
  if (r === "low" || r === "faible") return "Faible";
  return "Inconnu";
};

const riskColor = {
  Faible: "bg-green-100 text-green-700 border-green-200",
  Moyen: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Élevé": "bg-orange-100 text-orange-700 border-orange-200",
  Critique: "bg-red-100 text-red-700 border-red-200",
  Inconnu: "bg-gray-100 text-gray-600 border-gray-200",
};

const normalizeScore = (s) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 10) return Math.round(n * 10);
  return Math.max(0, Math.min(100, Math.round(n)));
};

const scoreColor = (s) => {
  const x = normalizeScore(s);
  return x >= 75 ? "#16a34a" : x >= 50 ? "#eab308" : "#ef4444";
};

const toYYYYMMDD = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
};

// --- Ton PDF generator (inchangé) ---
function generatePDF(url, results) {
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sc = results.score;
  const col = sc >= 75 ? "#16a34a" : sc >= 50 ? "#ca8a04" : "#dc2626";

  const headerRows = (results.headers || [])
    .map(
      (h) => `
    <tr>
      <td style="padding:6px 10px;font-family:monospace;font-size:11px;">${h.name}</td>
      <td style="padding:6px 10px;text-align:center;">
        ${
          h.present
            ? '<span style="color:#16a34a;font-weight:600;">✓ Présent</span>'
            : h.critical
              ? '<span style="color:#dc2626;font-weight:600;">✗ Absent</span>'
              : '<span style="color:#ca8a04;font-weight:600;">⚠ Absent</span>'
        }
      </td>
      <td style="padding:6px 10px;text-align:center;font-size:11px;">${h.critical ? "Critique" : "Recommandé"}</td>
    </tr>`
    )
    .join("");

  const vulnRows = (results.vulns || [])
    .map((v) => {
      const c =
        v.severity === "Élevé" || v.severity === "Critique"
          ? "#dc2626"
          : v.severity === "Moyen"
            ? "#ca8a04"
            : "#16a34a";
      return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="background:${c}20;color:${c};border:1px solid ${c}40;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;">${v.severity}</span>
        <strong style="font-size:13px;">${v.title}</strong>
        <span style="margin-left:auto;color:#9ca3af;font-size:11px;font-family:monospace;">${v.id}</span>
      </div>
      <p style="font-size:12px;color:#4b5563;margin:0 0 8px;">${v.description}</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;">
        <span style="font-size:11px;color:#15803d;font-weight:600;">Recommandation IA : </span>
        <span style="font-size:11px;color:#166534;">${v.fix}</span>
      </div>
    </div>`;
    })
    .join("");

  const recRows = (results.recommendations || [])
    .map(
      (r, i) => `
    <li style="font-size:12px;color:#166534;margin-bottom:6px;display:flex;gap:8px;">
      <span style="background:#bbf7d0;color:#15803d;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 1}</span>
      <span>${r}</span>
    </li>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Rapport SecureAudit — ${url}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;color:#111827;background:#fff;padding:40px;}
    h2{font-size:15px;color:#111827;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #f3f4f6;}
    table{width:100%;border-collapse:collapse;font-size:12px;}
    th{background:#f9fafb;text-align:left;padding:8px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;}
    tr:nth-child(even){background:#fafafa;}
    @media print{body{padding:20px;}}
  </style></head><body>
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:28px 32px;border-radius:12px;margin-bottom:28px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:11px;letter-spacing:2px;color:#93c5fd;margin-bottom:6px;">RAPPORT D'AUDIT DE SÉCURITÉ</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${url}</div>
        <div style="font-size:12px;color:#94a3b8;">Généré le ${date} — Mode: standard</div>
      </div>
      <div style="text-align:center;background:rgba(255,255,255,0.1);border-radius:10px;padding:16px 24px;">
        <div style="font-size:38px;font-weight:800;color:${col};">${sc}</div>
        <div style="font-size:11px;color:#94a3b8;">/100 — ${sc >= 75 ? "Sécurisé" : sc >= 50 ? "Risque modéré" : "Critique"}</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;">
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">SSL / TLS</div>
      <div style="font-size:14px;font-weight:600;color:${results.ssl ? "#16a34a" : "#dc2626"};">${results.ssl ? "✓ Valide" : "✗ Absent"}</div>
      <div style="font-size:11px;color:#6b7280;">Expire : ${results.sslExpiry || "N/A"}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Serveur</div>
      <div style="font-size:14px;font-weight:600;color:#111827;">${results.server || "Unknown"}</div>
      <div style="font-size:11px;color:#6b7280;">Redirection HTTPS : ${results.redirect ? "Oui" : "Non"}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Vulnérabilités</div>
      <div style="font-size:14px;font-weight:600;color:#dc2626;">${(results.vulns || []).length} détectée(s)</div>
      <div style="font-size:11px;color:#6b7280;">${(results.headers || []).filter((h) => !h.present && h.critical).length} en-têtes critiques manquants</div>
    </div>
  </div>

  <h2>En-têtes de sécurité HTTP</h2>
  <table style="margin-bottom:28px;">
    <thead><tr><th>En-tête</th><th>Statut</th><th>Priorité</th></tr></thead>
    <tbody>${headerRows}</tbody>
  </table>

  <h2>Vulnérabilités détectées</h2>
  <div style="margin-bottom:28px;">${vulnRows}</div>

  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:28px;">
    <h2 style="border-color:#bbf7d0;color:#166534;">Recommandations IA</h2>
    <ul style="list-style:none;padding:0;">${recRows}</ul>
  </div>

  <div style="text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
    SecureAudit Platform — Rapport confidentiel — ${date}
  </div>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

const ITEMS_PER_PAGE = 12;

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);

const TableSkeleton = () => (
  <div className="space-y-3 p-4">
    {[1,2,3,4,5,6].map(i => (
      <div key={i} className="flex items-center gap-4 animate-pulse">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="w-12 h-6 rounded-full" />
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-20 h-4" />
      </div>
    ))}
  </div>
);

export default function AdminAudits() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("Tous");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getAllAuditsAdmin();
      const list = Array.isArray(data) ? data : data?.audits || [];

      const normalized = list.map((a) => {
        const auditId = a?._id || a?.id || a?.auditId;
        const rawUrl = a?.urlCible || a?.site || a?.targetUrl || "";
        const url = isLikelyUrl(rawUrl) ? rawUrl : "";

        const vulnsArr = a?.rapport?.vulnerabilites || [];
        const vulnsCount = Array.isArray(vulnsArr) ? vulnsArr.length : 0;

        const scoreRaw =
          a?.rapport?.scoreGlobal ??
          a?.scoreGlobal ??
          a?.rapport?.score ??
          a?.score ??
          0;

        const riskFromVulns = (() => {
          const labels = (Array.isArray(vulnsArr) ? vulnsArr : [])
            .map((v) => normalizeRiskLabel(v?.severity || v?.niveauRisque))
            .filter((x) => x !== "Inconnu");

          if (labels.includes("Critique")) return "Critique";
          if (labels.includes("Élevé")) return "Élevé";
          if (labels.includes("Moyen")) return "Moyen";
          if (labels.includes("Faible")) return "Faible";
          return "Inconnu";
        })();

        return {
          auditId,
          id: auditId,
          site: url,
          score: normalizeScore(scoreRaw),
          risk: riskFromVulns,
          ssl: /^https:\/\//i.test(String(url)),
          vulns: vulnsCount,
          headers: Array.isArray(a?.headers) ? a.headers.length : 0,
          status: a?.statut || a?.status || "—",
          date: toYYYYMMDD(a?.date),
          user: a?.user?.email || a?.user?.nom || "—",
          vulnList: Array.isArray(vulnsArr) ? vulnsArr.map(normalizeVulnerability) : [],
          reportMeta: {
            durationMs: a?.rapport?.durationMs || 0,
            ai_model: a?.rapport?.ai_model || "",
            ai_prompt_version: a?.rapport?.ai_prompt_version || "",
            statistics: a?.rapport?.statistics || {},
            risk_breakdown: a?.rapport?.risk_breakdown || {},
            executive_summary: a?.rapport?.executive_summary || "",
            timeline: (a?.rapport?.timeline || []).map((t) => ({
              phase: t.phase,
              message: t.message,
              level: t.level,
            })),
          },
        };
      });

      setAudits(normalized);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Impossible de charger les audits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const toggleSort = useCallback((col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  }, [sortBy]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = audits.filter((a) => {
      if (!isLikelyUrl(a.site)) return false;
      const matchSearch =
        !q || String(a.site || "").toLowerCase().includes(q) ||
        String(a.user || "").toLowerCase().includes(q);
      const matchRisk = filterRisk === "Tous" || a.risk === filterRisk;
      return matchSearch && matchRisk;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.date) - new Date(b.date);
      else if (sortBy === "score") cmp = a.score - b.score;
      else if (sortBy === "vulns") cmp = a.vulns - b.vulns;
      else if (sortBy === "site") cmp = (a.site || "").localeCompare(b.site || "");
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [audits, search, filterRisk, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, filterRisk]);

  const downloadPdfSameDesign = async (auditId) => {
    try {
      setDownloadingPdf(true);
      setError("");

      const report = await getAdminAuditReport(auditId);
      generatePDF(report.url, report);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Erreur téléchargement PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Audits</h1>
        <p className="text-sm text-gray-500 mt-0.5">{audits.length} audits enregistrés</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un site ou utilisateur..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>

        <Filter size={14} className="text-gray-400" />
        {["Tous", "Critique", "Élevé", "Moyen", "Faible"].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRisk(r)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              filterRisk === r
                ? "bg-green-50 text-green-700 border-green-300 font-medium"
                : "border-gray-200 text-gray-500 hover:text-gray-700 bg-white"
            }`}
          >
            {r}
          </button>
        ))}

        <button
          onClick={fetchAudits}
          className="text-xs px-3 py-1.5 rounded-lg border transition border-gray-200 text-gray-500 hover:text-gray-700 bg-white"
        >
          Rafraîchir
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 bg-gray-50/80">
                <th className="text-left px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("site")} className="inline-flex items-center gap-1 hover:text-gray-600 transition">
                    Site <ArrowUpDown size={10} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("score")} className="inline-flex items-center gap-1 hover:text-gray-600 transition">
                    Score <ArrowUpDown size={10} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">Risque</th>
                <th className="text-left px-4 py-3 font-medium">SSL</th>
                <th className="text-left px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("vulns")} className="inline-flex items-center gap-1 hover:text-gray-600 transition">
                    Vulns <ArrowUpDown size={10} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-gray-600 transition">
                    Date <ArrowUpDown size={10} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {paged.map((a) => {
                const scoreCls = a.score >= 75 ? "bg-green-100 text-green-700 border-green-200" : a.score >= 50 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200";
                const domain = extractDomain(a.site);
                return (
                  <tr
                    key={a.id}
                    className="group hover:bg-gray-50/60 cursor-pointer transition-all duration-150"
                    onClick={() => setSelected(a)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-green-300 transition">
                          <img src={faviconUrl(a.site)} alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                          <div className="w-4 h-4 items-center justify-center hidden"><Globe size={14} className="text-gray-400" /></div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{displayUrl(a.site)}</p>
                          <p className="text-[10px] text-gray-400 truncate">{domain}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreCls}`}>
                        {a.score}/100
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md border ${riskColor[a.risk] || riskColor.Inconnu}`}>
                        {a.risk}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${a.ssl ? "text-green-600" : "text-red-500"}`}>
                        {a.ssl ? "✓ HTTPS" : "✗ HTTP"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${a.vulns > 10 ? "text-red-500" : a.vulns > 5 ? "text-yellow-600" : "text-gray-700"}`}>
                        {a.vulns}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        a.status === "En cours" ? "text-amber-600" : a.score >= 75 ? "text-green-600" : a.score >= 50 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {a.status === "En cours" ? a.status : a.score >= 75 ? "Sécurisé" : a.score >= 50 ? "Modéré" : "Critique"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-400">{a.date}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[120px]">{isTechnicalId(a.user) ? "—" : a.user}</td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-green-500 transition" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <Globe size={28} className="opacity-30 mb-2" />
            <p className="text-sm">Aucun audit trouvé</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{filtered.length} audit(s) — page {page}/{totalPages}</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                    p === page ? "bg-green-50 text-green-700 border border-green-300" : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}>
                  {p}
                </button>
              );
            })}
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-gray-200 z-40 overflow-y-auto shadow-xl">
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Détails de l'audit</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            {/* Hero: Score + Site */}
            <div className="text-center py-4">
              <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor(selected.score)} strokeWidth="6"
                  strokeDasharray={`${(selected.score / 100) * 213} 213`} strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{ transition: "stroke-dasharray 700ms ease" }} />
                <text x="40" y="46" textAnchor="middle" fontSize="20" fill={scoreColor(selected.score)} fontWeight="700">{selected.score}</text>
              </svg>
              <div className="flex items-center justify-center gap-2 mt-2">
                <img src={faviconUrl(selected.site)} alt="" className="w-4 h-4" onError={(e) => e.currentTarget.style.display = "none"} />
                <p className="text-gray-900 font-medium">{displayUrl(selected.site)}</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{extractDomain(selected.site)}</p>
            </div>

            {/* Info rows */}
            <div className="space-y-2">
              {[
                ["Niveau de risque", <span className={`text-xs px-2 py-0.5 rounded border ${riskColor[selected.risk] || riskColor.Inconnu}`}>{selected.risk}</span>],
                ["SSL/HTTPS", <span className={selected.ssl ? "text-green-600 text-xs" : "text-red-500 text-xs"}>{selected.ssl ? "✓ Activé" : "✗ Absent"}</span>],
                ["En-têtes analysés", <span className="text-gray-700 text-xs">{selected.headers}/10</span>],
                ["Vulnérabilités", <span className="text-red-500 font-semibold text-xs">{selected.vulns}</span>],
                ["Analyste", <span className="text-gray-700 text-xs">{isTechnicalId(selected.user) ? "—" : selected.user}</span>],
                ["Date", <span className="text-gray-400 text-xs">{selected.date}</span>],
                ...(selected.reportMeta?.durationMs > 0 ? [["Durée", <span className="text-gray-700 text-xs">{(selected.reportMeta.durationMs / 1000).toFixed(1)}s</span>]] : []),
              ].map(([label, val], i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span>{val}</span>
                </div>
              ))}
            </div>

            {/* Vulnerabilities mini-list */}
            {selected.vulnList && selected.vulnList.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldAlert size={14} className="text-red-500" />
                  Vulnérabilités ({selected.vulnList.length})
                </h3>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {selected.vulnList.map((v, idx) => {
                    const sev = normalizeRiskLabel(v.severity || v.niveauRisque);
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-2.5 text-xs ${riskColor[sev] || riskColor.Inconnu}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold">{v.title || v.type || "—"}</span>
                          <span className="ml-auto font-mono opacity-70">{v.cvss_score ? `CVSS ${v.cvss_score}` : ""}</span>
                        </div>
                        <p className="text-[11px] opacity-80 line-clamp-2">{v.description || v.technical_details || "—"}</p>
                        {v.endpoint && (
                          <p className="text-[10px] font-mono mt-1 opacity-70">{v.method || "GET"} {v.endpoint}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Report metadata */}
            {selected.reportMeta && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={14} className="text-blue-500" />
                  Rapport IA
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  {selected.reportMeta.ai_model && (
                    <p className="text-gray-600">Modèle: <span className="font-medium text-gray-900">{selected.reportMeta.ai_model}</span></p>
                  )}
                  {selected.reportMeta.durationMs > 0 && (
                    <p className="text-gray-600">Durée: <span className="font-medium text-gray-900">{(selected.reportMeta.durationMs / 1000).toFixed(1)}s</span></p>
                  )}
                  {selected.reportMeta.statistics && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {[
                        ["Requêtes", selected.reportMeta.statistics.total_requests],
                        ["Endpoints", selected.reportMeta.statistics.total_endpoints],
                        ["Payloads", selected.reportMeta.statistics.total_payloads],
                        ["Confiance moy.", selected.reportMeta.statistics.avg_confidence ? `${(selected.reportMeta.statistics.avg_confidence * 100).toFixed(0)}%` : "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-white rounded border px-2 py-1">
                          <p className="text-[10px] text-gray-400">{label}</p>
                          <p className="font-semibold text-gray-900">{value ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <a
              href={`/AdminReports?auditId=${selected.auditId}`}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs py-2.5 rounded-lg transition"
            >
              <ExternalLink size={13} />
              Voir le rapport complet IA
            </a>

            <button
              disabled={downloadingPdf}
              onClick={() => downloadPdfSameDesign(selected.auditId)}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-500 text-xs py-2.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-60"
            >
              <Download size={13} />
              {downloadingPdf ? "Préparation..." : "Télécharger le rapport PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}