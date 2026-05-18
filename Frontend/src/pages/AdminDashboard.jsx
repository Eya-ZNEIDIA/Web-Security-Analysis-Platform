import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import SidebarAdmin from "../components/SidebarAdmin";
import AdminUsers from "./AdminUsers";
import AdminAudits from "./AdminAudits";
import AdminSettings from "./AdminSettings";
import { ShieldCheck, ShieldAlert, Users, Activity, TrendingUp, Bell, Globe, ChevronRight } from "lucide-react";
import { isLikelyUrl, extractDomain, faviconUrl, displayUrl } from "../utils/urlHelpers";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import axios from "axios";

// ─── skeleton ────────────────────────────────────────────────────────────────
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);
const CardSkeleton = () => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-7 w-16" />
  </div>
);

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [dashLoading, setDashLoading] = useState(true);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }, [navigate]);

  // ---------- Helpers (risk + score) ----------
  const normalizeRiskLabel = (risk) => {
    const r = (risk ?? "").toString().trim().toLowerCase();
    if (r === "critical" || r === "critique") return "Critique";
    if (r === "high" || r === "élevé" || r === "eleve" || r === "éleve") return "Élevé";
    if (r === "medium" || r === "moyen") return "Moyen";
    if (r === "low" || r === "faible") return "Faible";
    return "Inconnu";
  };

  const normalizeScore = (s) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    if (n >= 0 && n <= 10) return Math.max(0, Math.min(100, Math.round(n * 10)));
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  const scoreColor = (score) => {
    const s = normalizeScore(score);
    return s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#ef4444";
  };

  const toYYYYMMDD = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toISOString().slice(0, 10);
  };

  const RISK_COLORS = useMemo(
    () => ({
      Critique: "#ef4444",
      "Élevé": "#f97316",
      Moyen: "#eab308",
      Faible: "#16a34a",
      Inconnu: "#9ca3af",
    }),
    []
  );

  const riskBadge = (risk) => {
    const normalized = normalizeRiskLabel(risk);
    const colors = {
      Critique: "bg-red-100 text-red-700 border-red-200",
      "Élevé": "bg-orange-100 text-orange-700 border-orange-200",
      Moyen: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Faible: "bg-green-100 text-green-700 border-green-200",
      Inconnu: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return colors[normalized] || colors.Inconnu;
  };

  // ---------- States dynamiques ----------
  const [stats, setStats] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [recentAudits, setRecentAudits] = useState([]);

  // ✅ Notifications admin (in-app)
  const [notifications, setNotifications] = useState([]);
  const [dismissingIds, setDismissingIds] = useState(new Set());
  const [markingAllNotifs, setMarkingAllNotifs] = useState(false);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const notifItemCls = (level) =>
    ({
      critical: "bg-red-50 border-red-200 text-red-700",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
      info: "bg-green-50 border-green-200 text-green-700",
    }[level] || "bg-gray-50 border-gray-200 text-gray-700");

  // ---------- Fetch dashboard ----------
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setDashLoading(true);
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/api/users/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data || {};

        const weekly = Array.isArray(data.auditsWeekly) ? data.auditsWeekly : [];
        const computedVulnsTotal = weekly.reduce((sum, d) => sum + (Number(d?.vulns) || 0), 0);

        const computedMonthly = (() => {
          if (Array.isArray(data.auditsMonthly) && data.auditsMonthly.length > 0) return data.auditsMonthly;
          const totalWeekAudits = weekly.reduce((sum, d) => sum + (Number(d?.audits) || 0), 0);
          const label = new Date().toLocaleDateString("fr-FR", { month: "short" });
          return [{ month: label, value: totalWeekAudits }];
        })();

        const computedRiskDistribution = (() => {
          const recent = Array.isArray(data.recentAudits) ? data.recentAudits : [];
          if (recent.length === 0) return [];
          const counts = recent.reduce((acc, a) => {
            const r = normalizeRiskLabel(a?.risk);
            acc[r] = (acc[r] || 0) + 1;
            return acc;
          }, {});
          return Object.entries(counts).map(([name, value]) => ({ name, value }));
        })();

        setStats([
          { label: "Audits Total", value: data.audits ?? 0, change: "", icon: ShieldCheck, color: "green" },
          {
            label: "Vulnérabilités",
            value: data.alerts && Number(data.alerts) > 0 ? data.alerts : computedVulnsTotal,
            change: "",
            icon: ShieldAlert,
            color: "red",
          },
          { label: "Utilisateurs", value: data.users ?? 0, change: "", icon: Users, color: "green" },
          { label: "En cours", value: data.auditsInProgress ?? 0, change: "actifs", icon: Activity, color: "amber" },
        ]);

        setLineData(weekly);
        setBarData(computedMonthly);

        const rawRisk =
          Array.isArray(data.riskDistribution) && data.riskDistribution.length > 0
            ? data.riskDistribution
            : computedRiskDistribution;

        const pie = rawRisk
          .map((r) => {
            const rawName = r?.name ?? r?._id;
            const name = normalizeRiskLabel(rawName);
            const value = Number(r?.value ?? r?.count ?? 0) || 0;
            return { name, value, color: RISK_COLORS[name] || "#9ca3af" };
          })
          .reduce((acc, cur) => {
            const found = acc.find((x) => x.name === cur.name);
            if (found) found.value += cur.value;
            else acc.push({ ...cur });
            return acc;
          }, [])
          .filter((x) => x.value > 0);

        const totalPie = pie.reduce((s, x) => s + x.value, 0) || 1;

        // ✅ IMPORTANT: garder la couleur après conversion en %
        const piePct = pie.map((x) => ({
          ...x,
          value: Math.round((x.value / totalPie) * 100),
        }));

        setPieData(piePct);

        const recent = Array.isArray(data.recentAudits) ? data.recentAudits : [];
        // Filter valid URLs, dedup by hostname
        const seen = new Map();
        for (const a of recent) {
          const rawUrl = a?.site || a?.urlCible || a?.targetUrl || "";
          if (!isLikelyUrl(rawUrl)) continue;
          const host = rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
          if (seen.has(host)) continue;
          seen.set(host, a);
        }
        const deduped = Array.from(seen.values()).slice(0, 8);

        setRecentAudits(
          deduped.map((a) => {
            const site = a?.site || a?.urlCible || a?.targetUrl || "";
            const rawScore = a?.score ?? a?.scoreGlobal ?? a?.rapport?.scoreGlobal ?? 0;
            const risk = normalizeRiskLabel(a?.risk);
            const status = a?.status || a?.statut || "—";
            const date = a?.date ? toYYYYMMDD(a.date) : "—";
            return { ...a, site, score: normalizeScore(rawScore), risk, status, date };
          })
        );
      } catch (err) {
        console.error("Erreur fetch dashboard:", err);
      } finally {
        setDashLoading(false);
      }
    };

    fetchDashboard();
  }, [RISK_COLORS]);

  // ✅ Fetch notifications admin
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/admin/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(Array.isArray(res.data.notifications) ? res.data.notifications : []);
    } catch (err) {
      console.error("Erreur fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markNotifRead = async (id) => {
    // Optimistic fade-out
    setDismissingIds(prev => new Set(prev).add(id));
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/admin/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Erreur mark read:", err);
      setDismissingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n._id !== id));
      setDismissingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 350);
  };

  const markAllNotifsRead = async () => {
    if (notifications.length === 0) return;
    setMarkingAllNotifs(true);
    const allIds = new Set(notifications.map(n => n._id).filter(Boolean));
    setDismissingIds(allIds);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "http://localhost:5000/api/admin/notifications/mark-all-read",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Erreur mark all read:", err);
      setDismissingIds(new Set());
      setMarkingAllNotifs(false);
      return;
    }
    setTimeout(() => {
      setNotifications([]);
      setDismissingIds(new Set());
      setMarkingAllNotifs(false);
    }, 350);
  };

  // ---------- UI helpers ----------
  const colorMap = {
    green: "text-green-700 bg-green-50 border-green-200",
    red: "text-red-600 bg-red-50 border-red-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm">
          <p className="text-gray-500 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map(({ label, value, change, icon: Icon, color }) => (
                <div
                  key={label}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">{label}</span>
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${colorMap[color]}`}>
                      <Icon size={14} />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-gray-900">{value}</p>
                  <p className={`text-xs mt-1 ${color === "red" ? "text-red-500" : "text-gray-400"}`}>
                    <TrendingUp size={10} className="inline mr-1" />
                    {change ? `${change} ce mois` : "—"}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Activité hebdomadaire</p>
                <p className="text-xs text-gray-400 mb-4">Audits et vulnérabilités détectées</p>

                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={lineData}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="audits" stroke="#16a34a" strokeWidth={2} dot={false} name="Audits" />
                    <Line
                      type="monotone"
                      dataKey="vulns"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Vulnérabilités"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Niveaux de risque</p>
                <p className="text-xs text-gray-400 mb-4">Distribution des vulnérabilités</p>

                <PieChart width={150} height={150}>
                  <Pie data={pieData} cx={70} cy={70} innerRadius={45} outerRadius={68} dataKey="value" stroke="none">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || "#9ca3af"} />
                    ))}
                  </Pie>
                </PieChart>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color || "#9ca3af" }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar chart + Alerts + Recent audits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Audits par mois</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} barSize={14}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#16a34a" opacity={0.8} radius={[3, 3, 0, 0]} name="Audits" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Alertes */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Bell size={14} className="text-gray-500" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">Alertes récentes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button type="button" onClick={markAllNotifsRead} disabled={markingAllNotifs}
                        className="text-[10px] text-gray-400 hover:text-green-600 font-medium transition disabled:opacity-40">
                        Tout marquer lu
                      </button>
                    )}
                    <span className="text-xs text-gray-400">{unreadCount} non lues</span>
                  </div>
                </div>

                <div className={`space-y-2 ${!showAllNotifs && notifications.length > 6 ? "max-h-[320px] overflow-y-auto pr-1" : ""}`}>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-gray-400">
                      <Bell size={24} className="opacity-30 mb-2" />
                      <p className="text-xs">Aucune notification non lue</p>
                    </div>
                  ) : (
                    (showAllNotifs ? notifications : notifications.slice(0, 6)).map((n) => (
                      <button
                        key={n._id}
                        type="button"
                        onClick={() => markNotifRead(n._id)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border text-xs hover:shadow-sm ${notifItemCls(n.level)} transition-all duration-300 ${
                          dismissingIds.has(n._id) ? "opacity-0 scale-95 -translate-x-2" : "opacity-100 scale-100 translate-x-0"
                        }`}
                        title="Cliquer pour marquer comme lu"
                      >
                        <span
                          className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${
                            n.level === "critical"
                              ? "bg-red-500 ring-4 ring-red-100"
                              : n.level === "warning"
                                ? "bg-yellow-500 ring-4 ring-yellow-100"
                                : "bg-green-500 ring-4 ring-green-100"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{n.title}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 shrink-0">NEW</span>
                          </div>
                          <div className="mt-0.5 text-gray-600 truncate">{n.message}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={fetchNotifications} className="text-xs text-green-600 font-medium hover:underline">
                    Rafraîchir
                  </button>
                  {notifications.length > 6 && !showAllNotifs && (
                    <button type="button" onClick={() => setShowAllNotifs(true)} className="text-xs text-green-600 font-medium hover:underline">
                      Voir plus ({notifications.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Recent audits */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-900">Derniers audits</p>
                  <Link className="text-xs text-green-600 font-medium hover:underline" to="/AdminAudits">
                    Voir tout →
                  </Link>
                </div>

                {recentAudits.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-gray-400">
                    <Globe size={24} className="opacity-30 mb-2" />
                    <p className="text-xs">Aucun audit récent</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentAudits.map((a, i) => {
                      const scoreCls = a.score >= 75 ? "bg-green-100 text-green-700 border-green-200" : a.score >= 50 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200";
                      const stCls = a.status === "En cours" ? "text-amber-600" : a.score >= 75 ? "text-green-600" : a.score >= 50 ? "text-yellow-600" : "text-red-600";
                      const stLabel = a.status === "En cours" ? "En cours" : a.score >= 75 ? "Sécurisé" : a.score >= 50 ? "Modéré" : "Critique";
                      return (
                        <div key={i} className="group flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50/60 rounded-xl transition-all duration-200">
                          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 group-hover:border-green-300 group-hover:shadow-sm transition-all overflow-hidden">
                            <img src={faviconUrl(a.site)} alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                            <div className="w-4 h-4 items-center justify-center hidden"><Globe size={14} className="text-gray-400" /></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{displayUrl(a.site)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-medium ${stCls}`}>{stLabel}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-[10px] text-gray-400">{a.date}</span>
                            </div>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreCls}`}>
                            {a.score}/100
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "users":
        return <AdminUsers />;

      case "audits":
        return <AdminAudits />;

      case "settings":
        return <AdminSettings />;

      default:
        return <div>Page non trouvée</div>;
    }
  };

  return (
    <div className="flex">
      <SidebarAdmin activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
      <main className="flex-1 p-6 ml-60 space-y-6">{renderContent()}</main>
    </div>
  );
}