import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from "recharts";
import { getStatistics,getStatisticsTotals } from "../services/authService";

// Tooltip personnalisé
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm">
        <p className="text-gray-500 mb-0.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || "#16a34a" }} className="font-medium">
            {p.name || p.dataKey}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Carte récapitulative
function StatCard({ label, value, sub, color = "green" }) {
  const c = {
    green: "text-green-700 bg-green-50 border-green-200",
    red: "text-red-600 bg-red-50 border-red-200",
    yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[11px] opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    scoreHistory: [],
    vulnsByType: [],
    riskDistrib: [],
    radarData: [],
    scansPerMonth: [],
    topSites: [],
    totalScans: 0,
    totalVulns: 0,
    avgScore: 0,
    successRate: 0
  });

  useEffect(() => {
  const fetchStats = async () => {
    try {
      const [totals, full] = await Promise.all([
        getStatisticsTotals(), // ⚡ endpoint /stats/totals
        getStatistics()        // ⚡ endpoint /stats/full
      ]);

      setStats({
        ...full,
        totalScans: totals.totalScans || 0,
        totalVulns: totals.totalVulns || 0,
        avgScore: totals.avgScore || 0,
        securedSites: totals.securedSites || 0,
      });

    } catch (err) {
      console.error("Erreur chargement statistiques:", err);
      setStats({
        scoreHistory: [],
        vulnsByType: [],
        riskDistrib: [],
        radarData: [],
        scansPerMonth: [],
        topSites: [],
        totalScans: 0,
        totalVulns: 0,
        avgScore: 0,
        successRate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  fetchStats();
}, []);
  if (loading) {
    return <p className="p-6 text-gray-500">Chargement des statistiques...</p>;
  }

  const {
    scoreHistory,
    vulnsByType,
    riskDistrib,
    radarData,
    scansPerMonth,
    topSites,
    totalScans,
    totalVulns,
    avgScore,
    successRate
  } = stats;

  // Assurer que chaque entrée de riskDistrib a une couleur
  const riskDataWithColors = (riskDistrib || []).map((d, i) => ({
    ...d,
    color: d.color || ["#16a34a", "#eab308", "#f97316", "#ef4444"][i % 4],
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Statistiques</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue analytique de vos analyses de sécurité</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total scans" value={totalScans} sub="Depuis octobre 2025" color="green" />
        <StatCard label="Vulnérabilités détectées" value={totalVulns} sub="Toutes sévérités" color="red" />
        <StatCard label="Score moyen" value={`${avgScore}/100`} sub="+4 pts ce mois" color="green" />
        <StatCard label="Taux de réussite" value={`${successRate}%`} sub="Sites sans critique" color="yellow" />
      </div>

      {/* Score evolution + scans per month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">Évolution du score de sécurité</p>
          <p className="text-xs text-gray-400 mb-4">Score moyen mensuel sur 6 mois</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreHistory}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2.5} dot={{ fill: "#16a34a", r: 3 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">Scans effectués par mois</p>
          <p className="text-xs text-gray-400 mb-4">Volume d'activité mensuel</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scansPerMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="scans" fill="#16a34a" opacity={0.8} radius={[4, 4, 0, 0]} name="Scans" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vulns by type + Risk distribution + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vulns by type */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">Vulnérabilités par type</p>
          <p className="text-xs text-gray-400 mb-4">Catégories les plus fréquentes</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vulnsByType}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#16a34a" opacity={0.75} radius={[0, 4, 4, 0]} name="Occurrences" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">Distribution des risques</p>
          <p className="text-xs text-gray-400 mb-4">Sur l'ensemble des scans</p>
          <div className="flex flex-col items-center">
            <PieChart width={150} height={150}>
              <Pie data={riskDataWithColors} cx={70} cy={70} innerRadius={45} outerRadius={68} dataKey="value" stroke="none">
                {riskDataWithColors.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
              {riskDataWithColors.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-gray-500">{d.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Radar chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">Profil de sécurité</p>
          <p className="text-xs text-gray-400 mb-2">Score par catégorie</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Radar name="Score" dataKey="score" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top sites table */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-4">Sites les plus analysés</p>
        <div className="space-y-3">
          {(topSites || []).map((s, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50">
              <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
              <span className="flex-1 text-sm text-gray-900 font-medium">{s.site}</span>
              <span className="text-xs text-gray-400">{s.scans}</span>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${s.avgScore}%`,
                  background: s.avgScore >= 75 ? "#16a34a" : s.avgScore >= 50 ? "#eab308" : "#ef4444"
                }} />
              </div>
              <span className="text-xs font-medium w-8 text-right" style={{
                color: s.avgScore >= 75 ? "#16a34a" : s.avgScore >= 50 ? "#eab308" : "#ef4444"
              }}>{s.avgScore}</span>
              <span className={`text-xs w-8 text-right font-medium ${
                s.trend.startsWith("+") ? "text-green-600" : s.trend.startsWith("-") ? "text-red-500" : "text-gray-400"
              }`}>{s.trend !== "0" ? s.trend : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}