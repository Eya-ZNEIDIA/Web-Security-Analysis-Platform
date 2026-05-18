import axios from "axios";

/**
 * Base URL
 * - VITE_API_URL doit être comme: http://localhost:5000
 */
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * API Roots
 */
const API_BASE = `${BASE_URL}/api`;
const USERS_API_URL = `${API_BASE}/users`;

/**
 * Wrapper fetch JSON (avec Bearer token)
 */
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, headers });

  // Réponse (peut être vide)
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || `HTTP Error: ${response.status}`;
    throw new Error(message);
  }

  return data;
};

// ---------------- Auth (axios) ----------------
// (axios ok ici, surtout si tu envoies FormData)
export const register = (data) => axios.post(`${USERS_API_URL}/register`, data);
export const login = ({ email, mdp, rememberMe }) => axios.post(`${USERS_API_URL}/login`, { email, mdp, rememberMe });

// ---------------- Users ----------------

/**
 * ⚠️ Cette route n'existe que si tu l'as créée côté backend
 */
export const getCurrentUser = async () => apiCall("/users/me", { method: "GET" });

/**
 * ADMIN USERS LIST
 * Backend: GET /api/users/admin/users
 */
export const getAllUsers = async () => apiCall("/users/admin/users", { method: "GET" });
export const getAllUsersAdmin = async () => apiCall("/users/admin/users", { method: "GET" });

/**
 * CREATE USER (ADMIN)
 * Backend: POST /api/users/ajouter
 */
export const createUser = async (userData) =>
  apiCall("/users/ajouter", {
    method: "POST",
    body: JSON.stringify(userData),
  });

/**
 * UPDATE USER
 * Backend: PUT /api/users/:id
 */
export const updateUser = async (userId, userData) =>
  apiCall(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });

/**
 * DELETE USER (ADMIN)
 * Backend: DELETE /api/users/:id
 */
export const deleteUser = async (userId) => apiCall(`/users/${userId}`, { method: "DELETE" });

export const getUserById = async (userId) => apiCall(`/users/${userId}`, { method: "GET" });

// ---------------- Vulnerabilites ----------------
export const getVulnerabilities = async () => apiCall("/vulnerabilites/me", { method: "GET" });

// ---------------- Labs ----------------
// ✅ AJOUT: pour ne plus casser les imports (Home.jsx importe getLabs)
// ⚠️ Cette route doit exister côté backend: GET /api/users/labs
export const getLabs = async () => apiCall("/users/labs", { method: "GET" });

// ---------------- Audits ----------------
export const analyzeSite = async (url, mode) => {
  const token = localStorage.getItem("token");
  const response = await axios.post(
    `${BASE_URL}/api/audit/launch`,
    { targetUrl: url, intensity: mode },
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  return response.data;
};

// ---------------- Stats ----------------
export const getStatistics = async () => apiCall("/stats/full", { method: "GET" });
export const getStatisticsTotals = async () => apiCall("/stats/totals", { method: "GET" });
export const getPlatformStats = async () => apiCall("/stats/totals", { method: "GET" });

// ---------------- Profile ----------------
export const getUserProfile = async (userId, token) => {
  const response = await axios.get(`${BASE_URL}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateUserProfile = async (userId, payload, token) => {
  if (!userId) throw new Error("updateUserProfile: userId manquant");

  const response = await axios.put(`${USERS_API_URL}/${userId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export function getUserId() {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null;
  try {
    const parsed = JSON.parse(storedUser);
    return parsed._id || parsed.id || null;
  } catch {
    return null;
  }
}

// ---------------- Admin audits ----------------
export const getAllAuditsAdmin = async () => apiCall("/users/admin/audits", { method: "GET" });

export const getAdminAuditReport = async (auditId) => {
  if (!auditId) throw new Error("auditId manquant");
  return apiCall(`/users/admin/audits/${auditId}/report`, { method: "GET" });
};

// ---------------- Normalization helpers ----------------
export const normalizeVulnerability = (v) => {
  const raw = v || {};
  const severityMap = {
    critical: "Critique",
    critique: "Critique",
    high: "Élevé",
    élevé: "Élevé",
    eleve: "Élevé",
    medium: "Moyen",
    moyen: "Moyen",
    low: "Faible",
    faible: "Faible",
    info: "Info",
    information: "Info",
  };
  const sevRaw = String(raw.severity || raw.niveauRisque || "").trim().toLowerCase();
  return {
    id: raw.id || raw._id || "vuln-0",
    severity: severityMap[sevRaw] || "Info",
    title: raw.title || raw.type || raw.titre || raw.name || "Vulnérabilité",
    description: raw.description || raw.technical_details || "",
    endpoint: raw.endpoint || "",
    method: raw.method || "GET",
    parameter: raw.parameter || "",
    payload: raw.payload || "",
    encoding: raw.encoding || "raw",
    evidence: raw.evidence || "",
    impact: raw.impact || raw.business_impact || "",
    reproduction_steps: Array.isArray(raw.reproduction_steps) ? raw.reproduction_steps : [],
    recommendation: raw.recommendation || raw.fix_recommendation || raw.recommandation || "",
    owasp: raw.owasp || raw.owasp_category || "",
    cwe: raw.cwe || "",
    cvss_score: Number(raw.cvss_score) || 0,
    cvss_vector: raw.cvss_vector || "",
    technique: raw.technique || "",
    technical_details: raw.technical_details || "",
    business_impact: raw.business_impact || "",
    code_example: raw.code_example || raw.secure_code_example || raw.secure_fix_example || "",
    headers_to_add: raw.headers_to_add || {},
    ai_confidence: typeof raw.ai_confidence === "number" ? raw.ai_confidence : null,
    detection_source: raw.detection_source || "rule",
    is_true_positive: raw.is_true_positive !== false,
    response_status: raw.response_status || null,
    http_response_snippet: raw.http_response_snippet || "",
  };
};

export const normalizeAuditReport = (report) => {
  if (!report) return null;
  return {
    ...report,
    vulns: Array.isArray(report.vulns)
      ? report.vulns.map(normalizeVulnerability)
      : [],
  };
};
// ---------------- Audits (create + complete to trigger email) ----------------

export const createAudit = async (adresse) =>
  apiCall("/audits", {
    method: "POST",
    body: JSON.stringify({ adresse }),
  });

export const completeAudit = async (auditId, scoreGlobal) => {
  if (!auditId) throw new Error("completeAudit: auditId manquant");

  return apiCall(`/audits/${auditId}/complete`, {
    method: "PUT",
    body: JSON.stringify({ scoreGlobal }),
  });
};
const authService = {
  register,
  login,
  getCurrentUser,
  getAllUsers,
  getAllUsersAdmin,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  getVulnerabilities,
  getLabs, 
  analyzeSite,
  getStatistics,
  getStatisticsTotals,
  getPlatformStats,
  getUserProfile,
  updateUserProfile,
  getUserId,
  getAllAuditsAdmin,
  getAdminAuditReport,
  createAudit,
  completeAudit,
};

export default authService;