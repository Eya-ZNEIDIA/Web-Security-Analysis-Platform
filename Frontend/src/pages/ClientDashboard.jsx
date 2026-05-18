import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import * as dashboardService from "../services/dashboardService";
import Labs from "./Labs";
import Statistics from "./Statistics";
import Settings from "./Settings";
import { isLikelyUrl, extractDomain, faviconUrl as getFaviconUrl } from "../utils/urlHelpers";
import ChatPage from "./ChatPage";
import {
  ShieldCheck,
  ShieldAlert,
  ScanSearch,
  TrendingUp,
  Bell,
  Globe,
  Calendar,
  ChevronRight,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

const ScanSkeleton = () => (
  <div className="flex items-center gap-3 py-3 animate-pulse">
    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-2.5 w-1/3" />
    </div>
    <Skeleton className="w-14 h-6 rounded-full" />
  </div>
);

const AlertSkeleton = () => (
  <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
    <Skeleton className="w-2 h-2 rounded-full mt-1 shrink-0" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>
  </div>
);

// ─── severity helpers ────────────────────────────────────────────────────────
const sevConfig = {
  Critique: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500", ring: "ring-red-100" },
  "Élevé": { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500", ring: "ring-orange-100" },
  Moyen: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", dot: "bg-yellow-500", ring: "ring-yellow-100" },
  Faible: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500", ring: "ring-green-100" },
  Info: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", dot: "bg-gray-400", ring: "ring-gray-100" },
};

const scoreColor = (s) => (s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#ef4444");
const scoreBadgeCls = (s) =>
  s >= 75
    ? "bg-green-100 text-green-700 border-green-200"
    : s >= 50
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200";

const statusLabel = (st) => {
  if (st === "Sécurisé") return { label: "Sécurisé", cls: "text-green-600" };
  if (st === "En cours") return { label: "En cours", cls: "text-amber-600" };
  if (st === "Risque modéré") return { label: "Modéré", cls: "text-yellow-600" };
  return { label: "Critique", cls: "text-red-600" };
};

const formatDate = (d) => {
  if (!d || d === "N/A") return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

// ─── memoized sub-components ──────────────────────────────────────────────────────
const ScanCard = memo(({ scan, onScanClick }) => {
  const st = statusLabel(scan.status);
  const domain = extractDomain(scan.url);
  const favUrl = getFaviconUrl(scan.url);
  return (
    <div
      onClick={onScanClick}
      className="group flex items-center gap-3.5 py-3 px-2 cursor-pointer hover:bg-gray-50/60 rounded-xl transition-all duration-200"
    >
      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 group-hover:border-green-300 group-hover:shadow-sm transition-all overflow-hidden">
        <img
          src={favUrl}
          alt=""
          className="w-5 h-5 object-contain"
          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
        />
        <div className="w-5 h-5 items-center justify-center hidden">
          <Globe size={16} className="text-gray-400" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{scan.url}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[11px] font-medium ${st.cls}`}>{st.label}</span>
          <span className="text-gray-300">·</span>
          <span className="text-[11px] text-gray-400">{formatDate(scan.date)}</span>
        </div>
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreBadgeCls(scan.score)}`}>
        {scan.score}/100
      </span>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-green-500 transition shrink-0" />
    </div>
  );
});

const AlertItem = memo(({ alert, onClick, fading }) => {
  const sev = sevConfig[alert.level] || sevConfig.Info;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2.5 p-3 rounded-xl border hover:shadow-sm ${sev.border} ${sev.bg} transition-all duration-300 ${fading ? "opacity-0 scale-95 -translate-x-2" : "opacity-100 scale-100 translate-x-0"}`}
      title="Cliquer pour marquer comme lue"
    >
      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${sev.dot} ring-4 ${sev.ring}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-xs font-semibold truncate ${sev.text}`}>{alert.type || alert.title}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 shrink-0">NEW</span>
        </div>
        {alert.endpoint && (
          <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">{alert.endpoint}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sev.bg} ${sev.border} ${sev.text}`}>
            {alert.level}
          </span>
          <span className="text-[10px] text-gray-400">{formatDate(alert.createdAt)}</span>
        </div>
      </div>
    </button>
  );
});

// ─── main component ──────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [stats, setStats] = useState({});
  const [scans, setScans] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsMeta, setAlertsMeta] = useState({ total: 0, hasMore: false });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [dismissingIds, setDismissingIds] = useState(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const navigate = useNavigate();
  const { user, logout, token, loading: authLoading } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const alertsEnabled = user?.notifications?.inAppAlerts ?? true;

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate("/login"); return; }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statsRes, scansRes, alertsRes, chartRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRecentScans(),
          dashboardService.getAlerts(10),
          dashboardService.getScoreEvolution(),
        ]);

        setStats(statsRes?.data ?? statsRes ?? {});
        const rawScans = scansRes?.data ?? scansRes ?? [];
        setScans(Array.isArray(rawScans) ? rawScans.filter(s => isLikelyUrl(s?.url)) : []);

        const alertData = alertsRes?.data ?? alertsRes ?? {};
        const rawAlerts = alertData.alerts ?? alertData ?? [];
        setAlerts(Array.isArray(rawAlerts) ? rawAlerts : []);
        setAlertsMeta({ total: alertData.total ?? 0, hasMore: alertData.hasMore ?? false });

        setChartData(chartRes?.data ?? chartRes ?? []);
      } catch (err) {
        console.error("Erreur dashboard:", err);
        setError("Impossible de charger le dashboard. Vérifiez que le serveur est lancé.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, authLoading, navigate]);

  const handleLoadMoreAlerts = useCallback(async () => {
    try {
      const res = await dashboardService.getAlerts(50);
      const alertData = res?.data ?? res ?? {};
      const rawAlerts = alertData.alerts ?? alertData ?? [];
      setAlerts(Array.isArray(rawAlerts) ? rawAlerts : []);
      setAlertsMeta({ total: alertData.total ?? 0, hasMore: false });
      setShowAllAlerts(true);
    } catch (e) {
      console.error("Error loading more alerts:", e);
    }
  }, []);

  const unreadCount = useMemo(() => {
    if (!alertsEnabled) return 0;
    return alerts.length;
  }, [alerts, alertsEnabled]);

  const handleAlertClick = useCallback(async (alert) => {
    if (!alertsEnabled || !alert?._id) return;
    // Start fade-out animation
    setDismissingIds(prev => new Set(prev).add(alert._id));
    try {
      await dashboardService.markAlertRead(alert._id);
    } catch {
      // Rollback: stop fade
      setDismissingIds(prev => { const n = new Set(prev); n.delete(alert._id); return n; });
      return;
    }
    // After animation delay, remove from list
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a?._id !== alert._id));
      setAlertsMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setDismissingIds(prev => { const n = new Set(prev); n.delete(alert._id); return n; });
    }, 350);
  }, [alertsEnabled]);

  const handleMarkAllRead = useCallback(async () => {
    if (!alertsEnabled || alerts.length === 0) return;
    setMarkingAll(true);
    // Fade all at once
    const allIds = new Set(alerts.map(a => a._id).filter(Boolean));
    setDismissingIds(allIds);
    try {
      await dashboardService.markAllAlertsRead();
    } catch {
      setDismissingIds(new Set());
      setMarkingAll(false);
      return;
    }
    setTimeout(() => {
      setAlerts([]);
      setAlertsMeta({ total: 0, hasMore: false });
      setDismissingIds(new Set());
      setMarkingAll(false);
    }, 350);
  }, [alertsEnabled, alerts]);

  const myStats = useMemo(
    () => [
      { label: "Mes Scans", value: stats.totalScans ?? stats.scans ?? 0, icon: ScanSearch, color: "green" },
      { label: "Vulnérabilités", value: stats.vulnerabilities ?? 0, icon: ShieldAlert, color: "red" },
      { label: "Sites sécurisés", value: stats.secureSites ?? stats.secured ?? 0, icon: ShieldCheck, color: "emerald" },
      { label: "Score moyen", value: stats.riskScore ?? stats.score ?? 0, icon: TrendingUp, color: "blue" },
    ],
    [stats]
  );

  const isNewUser = useMemo(() => {
    const totalScans = stats.totalScans ?? stats.scans ?? 0;
    return (
      Number(totalScans) === 0 &&
      (scans?.length ?? 0) === 0 &&
      (alerts?.length ?? 0) === 0 &&
      (chartData?.length ?? 0) === 0
    );
  }, [stats, scans, alerts, chartData]);

  const colorMap = {
    green: "text-green-700 bg-green-50 border-green-200",
    red: "text-red-600 bg-red-50 border-red-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex">
        <Sidebar activePage="dashboard" setActivePage={setActivePage} onLogout={handleLogout} alertsCount={0} alertsEnabled={true} />
        <main className="flex-1 ml-60 p-6 bg-gray-50 min-h-screen space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
          </div>
          <div className="bg-white border rounded-xl p-4">
            <Skeleton className="h-4 w-40 mb-4" />
            <Skeleton className="h-[200px] w-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              {[1, 2, 3].map(i => <AlertSkeleton key={i} />)}
            </div>
            <div className="lg:col-span-2 bg-white border rounded-xl p-4 space-y-1">
              <Skeleton className="h-4 w-32 mb-3" />
              {[1, 2, 3, 4].map(i => <ScanSkeleton key={i} />)}
            </div>
          </div>
        </main>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4 text-sm max-w-md text-center">
          {error}
        </div>
      </div>
    );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
          <p className="text-gray-500 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);  

  const renderContent = () => {
    switch (activePage) {
      
      case "dashboard":
        return (
          <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Bonjour {user?.prenom || user?.name || "Utilisateur"} 👋
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Voici votre tableau de bord</p>
              </div>
              <button
                onClick={() => setActivePage("scan")}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition shadow-sm shadow-green-600/20"
              >
                <ScanSearch size={14} />
                Lancer un scan
              </button>
            </div>

            {/* Onboarding */}
            {isNewUser && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-green-50 p-5 shadow-sm">
                <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-green-200/40 blur-3xl" />

                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-700 backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                      Onboarding — nouveau compte
                    </div>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-gray-900">Bienvenue sur SecureAudit</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Lance ton <span className="font-semibold text-gray-900">premier scan</span> pour générer ton score, tes alertes et tes rapports.
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { n: "1) Scan", d: "Analyse HTTP/HTTPS + détection vulnérabilités." },
                        { n: "2) Alertes", d: "Clique pour marquer \"lu\" et réduire le badge." },
                        { n: "3) Notifications", d: "Active/désactive email & in-app dans Paramètres." },
                      ].map(s => (
                        <div key={s.n} className="rounded-xl border border-emerald-100 bg-white/70 p-3 backdrop-blur">
                          <p className="text-xs font-semibold text-gray-900">{s.n}</p>
                          <p className="mt-1 text-[12px] text-gray-600">{s.d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[240px]">
                    <button type="button" onClick={() => setActivePage("scan")} className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                      <ScanSearch size={16} />
                      Lancer mon premier scan
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                    <button type="button" onClick={() => setActivePage("settings")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-white">
                      Paramètres
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {myStats.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 font-medium">{label}</span>
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${colorMap[color] || colorMap.green}`}>
                      <Icon size={14} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Évolution du score</p>
              <p className="text-xs text-gray-400 mb-4">30 derniers jours</p>
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <TrendingUp size={28} className="mb-2 opacity-40" />
                  <p className="text-xs">Aucune donnée disponible</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Alerts + Scans */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Alerts */}
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
                    <p className="text-sm font-semibold text-gray-900">Alertes récentes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alertsEnabled && alerts.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={markingAll}
                        className="text-[10px] text-gray-400 hover:text-green-600 font-medium transition disabled:opacity-40"
                      >
                        Tout marquer lu
                      </button>
                    )}
                    <span className="text-[11px] text-gray-400 font-medium">
                      {alertsEnabled ? `${unreadCount} non lue(s)` : "Désactivées"}
                    </span>
                  </div>
                </div>

                {!alertsEnabled ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    Notifications in-app désactivées (Paramètres → Notifications).
                  </p>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-gray-400">
                    <Bell size={24} className="opacity-30 mb-2" />
                    <p className="text-xs">Aucune alerte non lue</p>
                  </div>
                ) : (
                  <>
                    <div className={`space-y-2 ${!showAllAlerts && alerts.length > 5 ? "max-h-[320px] overflow-y-auto pr-1 scrollbar-thin" : ""}`}>
                      {visibleAlerts.map((a, i) => (
                        <AlertItem
                          key={a?._id ?? i}
                          alert={a}
                          fading={dismissingIds.has(a?._id)}
                          onClick={() => handleAlertClick(a)}
                        />
                      ))}
                    </div>

                    {alertsMeta.hasMore && !showAllAlerts && (
                      <button
                        type="button"
                        onClick={handleLoadMoreAlerts}
                        className="mt-3 w-full text-center text-xs text-green-600 font-semibold hover:text-green-700 hover:underline transition py-1.5"
                      >
                        Voir toutes les alertes ({alertsMeta.total})
                      </button>
                    )}
                    {!alertsMeta.hasMore && alerts.length > 5 && !showAllAlerts && (
                      <button
                        type="button"
                        onClick={() => setShowAllAlerts(true)}
                        className="mt-3 w-full text-center text-xs text-green-600 font-semibold hover:text-green-700 hover:underline transition py-1.5"
                      >
                        Voir plus
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Scans */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">Derniers scans</p>
                  {scans.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePage("scan")}
                      className="text-xs text-green-600 font-medium hover:underline flex items-center gap-1"
                    >
                      Nouveau scan <ExternalLink size={11} />
                    </button>
                  )}
                </div>

                {scans.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400">
                    <Globe size={28} className="opacity-30 mb-2" />
                    <p className="text-xs">Aucun scan effectué</p>
                    <button
                      type="button"
                      onClick={() => setActivePage("scan")}
                      className="mt-3 text-xs text-green-600 font-semibold hover:underline"
                    >
                      Lancer votre premier scan →
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {scans.map((s, i) => (
                      <ScanCard
                        key={s._id ?? i}
                        scan={s}
                        onScanClick={() => setActivePage("scan")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "scan":
        return <Labs />;
      case "chat":
        return <ChatPage />;

      case "stats":
        return <Statistics />;

      case "settings":
        return <Settings />;

      default:
        return <div className="text-gray-500 text-sm">Page non trouvée</div>;
    }
  };

  return (
    <div className="flex">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
        alertsCount={unreadCount}
        alertsEnabled={alertsEnabled}
      />
      <main className="flex-1 ml-60 p-6 bg-gray-50 min-h-screen">{renderContent()}</main>
    </div>
  );
}