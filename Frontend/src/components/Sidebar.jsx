import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  ScanSearch,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  MessageSquare,
  Bell,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "scan", label: "Nouveau Scan", icon: ScanSearch },
  { id: "chat", label: "AI Security Chat", icon: MessageSquare },
  { id: "stats", label: "Statistiques", icon: BarChart2 },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar({
  activePage,
  setActivePage,
  onLogout,
  alertsCount = 0,
  alertsEnabled = true,
}) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const firstName = user?.prenom || user?.firstName || "U";
  const lastName = user?.nom || user?.lastName || "";
  const email = user?.email || "";

  const initials = useMemo(() => {
    const a = (firstName || "").trim()[0] || "";
    const b = (lastName || "").trim()[0] || "";
    return (a + b).toUpperCase() || "U";
  }, [firstName, lastName]);

  const Badge = ({ value }) => {
    if (!alertsEnabled) return null;
    if (!value || value <= 0) return null;
    const shown = value > 99 ? "99+" : String(value);

    return (
      <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">
        {shown}
      </span>
    );
  };

  return (
    <aside
      className={`fixed h-screen flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo + Collapse */}
      <div className="flex items-center justify-between px-4 py-5 border-b">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-md flex items-center justify-center">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">SecureAudit</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-gray-500 hover:text-gray-900"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <Menu size={18} /> : <X size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id;

          const showBadgeHere = id === "dashboard";
          const badgeValue = showBadgeHere ? alertsCount : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePage(id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                isActive
                  ? "bg-green-50 text-green-700 border border-green-200 font-medium"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}

              {/* badge normal */}
              {!collapsed && showBadgeHere && <Badge value={badgeValue} />}

              {/* badge collapsed */}
              {collapsed && showBadgeHere && alertsEnabled && badgeValue > 0 ? (
                <span className="absolute left-10 top-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                  {badgeValue > 99 ? "99+" : badgeValue}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Mini summary */}
      {!collapsed && alertsEnabled && (
        <div className="mx-3 mb-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-800">
              {alertsCount} alerte{alertsCount > 1 ? "s" : ""}
            </span>
            <span className={`ml-auto w-2 h-2 rounded-full ${alertsCount > 0 ? "bg-red-500" : "bg-green-500"}`} />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {alertsCount > 0 ? "Clique sur une alerte pour la marquer comme lue." : "Rien à signaler pour le moment."}
          </p>
        </div>
      )}

      {/* User + logout */}
      <div className="px-3 py-4 border-t flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700">
          {initials}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {`${firstName} ${lastName}`.trim() || "Utilisateur"}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{email || "user@corp.fr"}</p>
            </div>

            <button type="button" onClick={onLogout} className="text-gray-300 hover:text-red-500 transition">
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}