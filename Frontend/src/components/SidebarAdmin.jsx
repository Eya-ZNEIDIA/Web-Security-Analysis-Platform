import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { LogOut, ShieldCheck, ShieldAlert, Users, Activity, Bell } from "lucide-react";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000") + "/api";

export default function SidebarAdmin({ activePage, setActivePage, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ NEW: enable/disable in-app alerts from admin settings
  const [inAppAlertEnabled, setInAppAlertEnabled] = useState(true);

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const displayName = useMemo(() => {
    if (!me) return "Admin";
    const full = `${me.prenom || ""} ${me.nom || ""}`.trim();
    return full || me.email || "Admin";
  }, [me]);

  const displayEmail = me?.email || "—";

  const initials = useMemo(() => {
    const a = (me?.prenom || "").trim()[0] || "";
    const b = (me?.nom || "").trim()[0] || "";
    const init = (a + b).toUpperCase();
    return init || (displayEmail.trim()[0]?.toUpperCase() || "AD");
  }, [me, displayEmail]);

  const menuItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: <ShieldCheck size={16} /> },
      { key: "users", label: "Utilisateurs", icon: <Users size={16} /> },
      { key: "audits", label: "Audits", icon: <ShieldAlert size={16} /> },
      { key: "settings", label: "Paramètres", icon: <Activity size={16} /> },
    ],
    []
  );

  // ✅ NEW: fetch admin settings (inAppAlert ON/OFF)
  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await axios.get(`${API_BASE}/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        const enabled = res.data?.settings?.notifications?.inAppAlert;
        setInAppAlertEnabled(typeof enabled === "boolean" ? enabled : true);
      } catch {
        // si erreur, on laisse ON par défaut
        if (!cancelled) setInAppAlertEnabled(true);
      }
    };

    fetchSettings();
    const t = setInterval(fetchSettings, 30000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await axios.get(`${API_BASE}/admin/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (typeof res.data?.unreadCount === "number") {
          setUnreadCount(res.data.unreadCount);
          return;
        }

        const items = Array.isArray(res.data?.notifications)
          ? res.data.notifications
          : [];

        setUnreadCount(items.filter((n) => !n?.read).length);
      } catch {
        // silence
      }
    };

    // ✅ si alert in-app OFF => badge hidden + stop polling notifications
    if (!inAppAlertEnabled) {
      setUnreadCount(0);
      return () => {
        cancelled = true;
      };
    }

    fetchNotifications();
    const t = setInterval(fetchNotifications, 15000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [inAppAlertEnabled]);

  return (
    <aside
      className={`bg-white border-r border-gray-200 h-screen fixed transition-all duration-300 ${
        collapsed ? "w-20" : "w-60"
      }`}
    >
      <div className="flex justify-end p-2">
        <button
          type="button"
          className="text-gray-400 hover:text-gray-800"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="mt-4">
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setActivePage(item.key)}
            className={`flex items-center w-full p-3 gap-3 text-sm font-medium hover:bg-gray-100 transition ${
              activePage === item.key
                ? "bg-green-50 text-green-700 border-l-4 border-green-500"
                : "text-gray-700"
            }`}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div
        className={`absolute bottom-0 w-full px-3 py-4 border-t border-gray-200 flex items-center gap-3 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {initials}
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-[11px] text-gray-400 truncate">{displayEmail}</p>

            {/* ✅ badge seulement si inAppAlertEnabled */}
            {inAppAlertEnabled && unreadCount > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 w-fit">
                <Bell size={12} />
                {unreadCount} alerte{unreadCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {/* ✅ collapsed badge seulement si inAppAlertEnabled */}
        {collapsed && inAppAlertEnabled && unreadCount > 0 ? (
          <div className="absolute bottom-14 right-3 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
            {unreadCount}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onLogout}
          className="text-gray-300 hover:text-red-500 transition"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}