const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ─── Helpers ────────────────────────────────────────────────────────────────
export const getToken  = () => localStorage.getItem("token");
export const getUserId = () => localStorage.getItem("userId");

const getAuthHeaders = () => {
  const token = getToken();
  if (!token) throw new Error("Utilisateur non connecté");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const apiCall = async (endpoint, options = {}) => {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP Error: ${res.status}`);
  return data;
};

// ─── Profil ──────────────────────────────────────────────────────────────────

// ✅ Signature unifiée : (userId, token) — cohérente avec Settings.jsx et Sidebar.jsx
export async function getUserProfile(userId, token) {
  if (!userId || !token) throw new Error("Utilisateur non connecté");
  const res = await fetch(`${API_URL}/users/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur chargement profil");
  return data;
}

// ✅ updateUserProfile : prend userId explicitement depuis le paramètre
export async function updateUserProfile(userId, payload, token) {
  if (!userId || !token) throw new Error("Utilisateur non connecté");
  const res = await fetch(`${API_URL}/users/${userId}/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur mise à jour profil");
  return data;
}