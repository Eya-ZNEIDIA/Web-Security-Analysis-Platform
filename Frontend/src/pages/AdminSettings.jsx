import { useEffect, useState } from "react";
import { Save, RefreshCw, Bell, Lock, Server } from "lucide-react";
import {
  getAdminSettings,
  updateAdminSettings,
} from "../services/settingsService";

const sections = [

  { id: "notifications", label: "Notifications", icon: Bell },

];

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        value ? "bg-green-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
          value ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function Field({ label, desc, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
      <div className="flex-1">
        <p className="text-sm text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState("general");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [general, setGeneral] = useState({
    platformName: "",
    maxConcurrent: 5,
    timeout: 30,
    maintenanceMode: false,
  });

  // ✅ correction: séparer rapport d'audit / alertes dashboard
  const [notifs, setNotifs] = useState({
    emailCritical: true,
    emailReport: true,
    weeklyDigest: false,

    // NEW (séparés)
    auditReportEnabled: true, // envoi/activation rapport d’audit (si tu veux ce toggle)
    inAppAlert: true, // alertes dans le dashboard
    auditEmailToAdmin: true, // email admin quand audit terminé (si tu veux ce toggle)
  });

  // ✅ MFA supprimé
  const [security, setSecurity] = useState({
    sessionTimeout: 60,
    rateLimit: 100,
    ipWhitelist: "",
  });

  const inputCls =
    "bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition w-48";

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await getAdminSettings();
      const settings = res?.data?.settings;

      if (settings?.general) setGeneral(settings.general);

      if (settings?.notifications) {
        // ✅ IMPORTANT: merge avec defaults pour éviter undefined
        setNotifs((prev) => ({
          ...prev,
          ...settings.notifications,
          auditReportEnabled:
            settings.notifications.auditReportEnabled ?? prev.auditReportEnabled,
          inAppAlert: settings.notifications.inAppAlert ?? prev.inAppAlert,
          auditEmailToAdmin:
            settings.notifications.auditEmailToAdmin ?? prev.auditEmailToAdmin,
        }));
      }

      if (settings?.security) {
        setSecurity({
          sessionTimeout: settings.security.sessionTimeout ?? 60,
          rateLimit: settings.security.rateLimit ?? 100,
          ipWhitelist: settings.security.ipWhitelist ?? "",
        });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Erreur chargement settings"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError("");

      await updateAdminSettings({
        general: {
          platformName: general.platformName,
          maxConcurrent: Number(general.maxConcurrent),
          timeout: Number(general.timeout),
          maintenanceMode: Boolean(general.maintenanceMode),
        },
        notifications: {
          emailCritical: Boolean(notifs.emailCritical),
          emailReport: Boolean(notifs.emailReport),
          weeklyDigest: Boolean(notifs.weeklyDigest),

          // ✅ nouveaux champs séparés
          auditReportEnabled: Boolean(notifs.auditReportEnabled),
          inAppAlert: Boolean(notifs.inAppAlert),
          auditEmailToAdmin: Boolean(notifs.auditEmailToAdmin),
        },
        security: {
          sessionTimeout: Number(security.sessionTimeout),
          rateLimit: Number(security.rateLimit),
          ipWhitelist: security.ipWhitelist,
        },
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Erreur sauvegarde settings"
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const renderContent = () => {
    switch (activeSection) {
   
      case "notifications":
        return (
          <>
            

            <Field
              label="Alertes in-app"
              desc="Notifications dans le tableau de bord"
            >
              <Toggle
                value={notifs.inAppAlert}
                onChange={(v) => setNotifs({ ...notifs, inAppAlert: v })}
              />
            </Field>

            <Field
              label="Email admin après audit"
              desc="Envoyer un mail à l'admin quand un audit se termine"
            >
              <Toggle
                value={notifs.auditEmailToAdmin}
                onChange={(v) =>
                  setNotifs({ ...notifs, auditEmailToAdmin: v })
                }
              />
            </Field>
          </>
        );


      default:
        return null;
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configuration de la plateforme SecureAudit
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSettings}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition bg-white disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Réinitialiser
          </button>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
              saved
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
            }`}
          >
            <Save size={13} />
            {saving ? "Sauvegarde..." : saved ? "Enregistré ✓" : "Enregistrer"}
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex gap-6">
        <div className="w-52 shrink-0 space-y-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                activeSection === id
                  ? "bg-green-50 text-green-700 border border-green-200 font-medium"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-gray-200 rounded-xl px-6 shadow-sm">
          <div className="divide-y divide-gray-100">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}