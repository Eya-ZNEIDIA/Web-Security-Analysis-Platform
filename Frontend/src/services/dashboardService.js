const DASHBOARD_BASE_URL = "http://localhost:5000/api/dashboard";
const API_BASE_URL = "http://localhost:5000/api";

const apiFetch = async (baseUrl, endpoint, options = {}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // réponse peut être vide
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || `HTTP error: ${res.status}`;
    throw new Error(message);
  }

  return { data };
};

// ---------------- Dashboard ----------------
export const getStats = async () => {
  try {
    return await apiFetch(DASHBOARD_BASE_URL, "/stats");
  } catch (err) {
    console.error("Stats Error:", err);
    return { data: { totalScans: 0, vulnerabilities: 0, secureSites: 0, riskScore: 0 } };
  }
};

export const getRecentScans = async () => {
  try {
    return await apiFetch(DASHBOARD_BASE_URL, "/recent-scans");
  } catch (err) {
    console.error("Recent Scans Error:", err);
    return { data: [] };
  }
};

export const getScoreEvolution = async () => {
  try {
    return await apiFetch(DASHBOARD_BASE_URL, "/score-evolution");
  } catch (err) {
    console.error("Score Evolution Error:", err);
    return { data: [] };
  }
};

// ---------------- Alerts / Notifications ----------------
export const getAlerts = async (limit = 10) => {
  try {
    return await apiFetch(DASHBOARD_BASE_URL, `/alerts?limit=${limit}`);
  } catch (err) {
    console.error("Alerts Error:", err);
    return { data: { alerts: [], total: 0, hasMore: false } };
  }
};

export const getUnreadAlerts = async () => {
  try {
    return await apiFetch(API_BASE_URL, "/alerts/unread");
  } catch (err) {
    console.error("Unread Alerts Error:", err);
    return { data: [] };
  }
};

export const markAlertRead = async (alertId) => {
  if (!alertId) throw new Error("markAlertRead: alertId manquant");

  // ✅ PUT /api/alerts/:id/read
  const res = await apiFetch(API_BASE_URL, `/alerts/${alertId}/read`, {
    method: "PUT",
    body: JSON.stringify({}),
  });

  return res; // { data: alertUpdated }
};

export const markAllAlertsRead = async () => {
  // ✅ PUT /api/alerts/mark-all-read
  const res = await apiFetch(API_BASE_URL, "/alerts/mark-all-read", {
    method: "PUT",
    body: JSON.stringify({}),
  });
  return res;
};