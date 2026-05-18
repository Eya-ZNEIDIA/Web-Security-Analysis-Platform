import axios from "axios";

// ✅ utiliser .env si dispo, fallback localhost
const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000") + "/api";

function getAuthHeaders() {
  const token = localStorage.getItem("token");

  // ✅ si pas de token, ne pas envoyer Authorization du tout
  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getAdminSettings() {
  return axios.get(`${API_BASE}/admin/settings`, {
    headers: getAuthHeaders(),
  });
}

export function updateAdminSettings(payload) {
  return axios.put(`${API_BASE}/admin/settings`, payload, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
  });
}