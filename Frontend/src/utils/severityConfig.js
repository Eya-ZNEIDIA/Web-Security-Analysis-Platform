/**
 * severityConfig.js
 * Utilities for vulnerability severity display
 */

export const getSeverityConfig = (severity) => {
  const s = String(severity || "").trim().toLowerCase();

  const configs = {
    critique: {
      color: "#dc2626",
      bgColor: "#fee2e2",
      borderColor: "#fecaca",
      lightBg: "#fef2f2",
      label: "Critique",
    },
    critical: {
      color: "#dc2626",
      bgColor: "#fee2e2",
      borderColor: "#fecaca",
      lightBg: "#fef2f2",
      label: "Critique",
    },
    élevé: {
      color: "#ea580c",
      bgColor: "#ffedd5",
      borderColor: "#fed7aa",
      lightBg: "#fff7ed",
      label: "Élevé",
    },
    high: {
      color: "#ea580c",
      bgColor: "#ffedd5",
      borderColor: "#fed7aa",
      lightBg: "#fff7ed",
      label: "Élevé",
    },
    eleve: {
      color: "#ea580c",
      bgColor: "#ffedd5",
      borderColor: "#fed7aa",
      lightBg: "#fff7ed",
      label: "Élevé",
    },
    moyen: {
      color: "#ca8a04",
      bgColor: "#fef9e7",
      borderColor: "#fef3c7",
      lightBg: "#fffbeb",
      label: "Moyen",
    },
    medium: {
      color: "#ca8a04",
      bgColor: "#fef9e7",
      borderColor: "#fef3c7",
      lightBg: "#fffbeb",
      label: "Moyen",
    },
    faible: {
      color: "#16a34a",
      bgColor: "#f0fdf4",
      borderColor: "#bbf7d0",
      lightBg: "#f0fdf4",
      label: "Faible",
    },
    low: {
      color: "#16a34a",
      bgColor: "#f0fdf4",
      borderColor: "#bbf7d0",
      lightBg: "#f0fdf4",
      label: "Faible",
    },
    info: {
      color: "#6b7280",
      bgColor: "#f3f4f6",
      borderColor: "#e5e7eb",
      lightBg: "#f9fafb",
      label: "Info",
    },
    information: {
      color: "#6b7280",
      bgColor: "#f3f4f6",
      borderColor: "#e5e7eb",
      lightBg: "#f9fafb",
      label: "Info",
    },
  };

  return configs[s] || configs.info;
};

export const getVulnIcon = (title) => {
  const t = String(title || "").toLowerCase();
  if (t.includes("xss") || t.includes("injection") || t.includes("script")) return "💉";
  if (t.includes("sql") || t.includes("database")) return "🗃️";
  if (t.includes("csrf") || t.includes("token")) return "🎭";
  if (t.includes("ssl") || t.includes("tls") || t.includes("https")) return "🔒";
  if (t.includes("header") || t.includes("csp") || t.includes("cors")) return "📋";
  if (t.includes("path") || t.includes("traversal") || t.includes("lfi")) return "🗂️";
  if (t.includes("rce") || t.includes("remote")) return "💻";
  if (t.includes("ssrf")) return "🌐";
  if (t.includes("idor") || t.includes("access")) return "🚪";
  if (t.includes("rate") || t.includes("limit")) return "⏱️";
  if (t.includes("file") || t.includes("upload")) return "📁";
  if (t.includes("password") || t.includes("auth") || t.includes("login")) return "🔑";
  return "🐞";
};

export const severityOrder = {
  Critique: 5,
  "Élevé": 4,
  Moyen: 3,
  Faible: 2,
  Info: 1,
  Inconnu: 0,
};
