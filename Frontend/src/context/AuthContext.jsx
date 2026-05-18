import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if JWT is expired
  const isTokenExpired = (jwt) => {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  // Charger session depuis localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } else {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
    }
    setLoading(false);
  }, []);

  // Auto-logout when token expires
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const msLeft = payload.exp * 1000 - Date.now();
      if (msLeft <= 0) { logout(); return; }
      const timer = setTimeout(() => logout(), msLeft);
      return () => clearTimeout(timer);
    } catch { /* ignore */ }
  }, [token]);

  const login = async (email, mdp, rememberMe = false) => {
    const response = await authService.login({ email, mdp, rememberMe });
    const { token: jwtToken, user: userData } = response.data;

    localStorage.setItem("token", jwtToken);
    localStorage.setItem("user", JSON.stringify(userData));

    setToken(jwtToken);
    setUser(userData);

    return { token: jwtToken, user: userData };
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
  };

  // ✅ utile pour mettre à jour le user côté UI après modification profil
  const updateUser = (newData) => {
    setUser((prev) => {
      const updated = { ...(prev || {}), ...(newData || {}) };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * REGISTER
   * - accepte un objet JSON {nom, prenom, email, mdp}
   * - ou un FormData (si tu envoies image)
   */
  const register = async (data) => {
    try {
      const response = await authService.register(data);
      return response.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Inscription impossible";
      throw new Error(msg);
    }
  };

  const isAuthenticated = useMemo(() => !!token, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        register,
        updateUser,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};