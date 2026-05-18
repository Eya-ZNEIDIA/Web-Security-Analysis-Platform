// src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Bell, Lock, Save, Eye, EyeOff, Camera } from "lucide-react";
import { updateUserProfile } from "../services/userService";

const sections = [
  { id: "profile", label: "Profil", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "securite", label: "Sécurité", icon: Lock },
];

function Toggle({ value, onChange }) {
  return (
    <button
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

const inputCls =
  "bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition w-56";

export default function Settings() {
  const { user, token, isAuthenticated, updateUser } = useAuth();

  const [active, setActive] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // IMAGE
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  const [profile, setProfile] = useState({
    firstName: "", lastName: "", email: "", company: "", phone: "", bio: "",
  });

  const [notifs, setNotifs] = useState({
    emailScanComplete: false, emailCritical: false, emailWeekly: false,
    inAppAlerts: false, inAppScanDone: false,
  });

  const [security, setSecurity] = useState({
    currentPwd: "", newPwd: "", mfa: false, sessionAlert: true,
  });

  const [prefs, setPrefs] = useState({
    defaultScanMode: "standard", autoDownloadReport: false,
    language: "fr", dateFormat: "DD/MM/YYYY",
  });

  // 🔹 Initialisation des données utilisateur
  useEffect(() => {
    if (!isAuthenticated) {
      setError("Session expirée, veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    if (user) {
      console.log("User from context:", user); // pour debug

      setProfile({
        firstName: user.firstName || user.prenom || "",
        lastName: user.lastName || user.nom || "",
        email: user.email || "",
        company: user.profile?.company || "",
        phone: user.profile?.phone || "",
        bio: user.profile?.bio || "",
      });

      setNotifs({
        emailScanComplete: user.notifications?.emailScanComplete ?? true,
        emailCritical:     user.notifications?.emailCritical ?? true,
        emailWeekly:       user.notifications?.emailWeekly ?? false,
        inAppAlerts:       user.notifications?.inAppAlerts ?? true,
        inAppScanDone:     user.notifications?.inAppScanDone ?? true,
      });

      setSecurity({
        currentPwd: "",
        newPwd: "",
        mfa:          user.security?.mfa ?? false,
        sessionAlert: user.security?.sessionAlert ?? true,
      });

      setPrefs({
        defaultScanMode:    user.prefs?.defaultScanMode ?? "standard",
        autoDownloadReport: user.prefs?.autoDownloadReport ?? false,
        language:           user.prefs?.language ?? "fr",
        dateFormat:         user.prefs?.dateFormat ?? "DD/MM/YYYY",
      });

      setPreview(user.image ? `http://localhost:5000/uploads/${user.image}` : null);
    }

    setLoading(false);
  }, [user, isAuthenticated]);

  // 🔹 Gestion de l'image
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!image) return null;
    const formData = new FormData();
    formData.append("image", image);

    const res = await fetch("http://localhost:5000/api/users/upload-image", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) throw new Error("Erreur lors du téléchargement de l'image");
    const data = await res.json();
    return data.image;
  };

  // 🔹 Sauvegarde des modifications
  const handleSave = async () => {
    if (!user || !token) return;

    setError("");
    try {
      const uploadedImage = await uploadImage();

      const payload = {
        profile: { ...profile },
        notifications: { ...notifs },
        security: {
          mfa: security.mfa,
          sessionAlert: security.sessionAlert,
          ...(security.currentPwd && security.newPwd && {
            currentPwd: security.currentPwd,
            newPwd: security.newPwd,
          }),
        },
        prefs: { ...prefs },
      };

      await updateUserProfile(user._id || user.id, payload, token);

      updateUser({
        firstName: profile.firstName,
        lastName: profile.lastName,
        profile: {
          company: profile.company,
          phone: profile.phone,
          bio: profile.bio,
        },
        notifications: notifs,
        security: {
          mfa: security.mfa,
          sessionAlert: security.sessionAlert,
        },
        prefs,
        ...(uploadedImage && { image: uploadedImage }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setSecurity((prev) => ({ ...prev, currentPwd: "", newPwd: "" }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la sauvegarde");
    }
  };

  // 🔹 Contenu de chaque onglet
  const renderContent = () => {
    switch (active) {
      case "profile":
        return (
          <>
            {/* IMAGE PROFIL */}
            <div className="flex items-center gap-4 py-5 border-b border-gray-100">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-xl font-semibold text-green-700 overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      {profile.firstName?.[0] || "U"}
                      {profile.lastName?.[0] || ""}
                    </>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center border-2 border-white cursor-pointer hover:bg-green-700">
                  <Camera size={11} className="text-white" />
                  <input type="file" className="hidden" onChange={handleImageChange} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Photo de profil</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG ou PNG, max 2MB</p>
              </div>
            </div>

            <Field label="Prénom">
              <input
                className={inputCls}
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              />
            </Field>

            <Field label="Nom">
              <input
                className={inputCls}
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              />
            </Field>

            <Field label="Adresse email" desc="Utilisée pour les notifications et la connexion">
              <input className={`${inputCls} opacity-60 cursor-not-allowed`} type="email" value={profile.email} disabled />
            </Field>

            <Field label="Entreprise">
              <input
                className={inputCls}
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
              />
            </Field>

            <Field label="Téléphone">
              <input
                className={inputCls}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </Field>

            <div className="py-4">
              <label className="text-sm text-gray-900 block mb-1.5">Biographie</label>
              <textarea
                rows={3}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Décrivez votre rôle..."
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition resize-none"
              />
            </div>
          </>
        );

      case "notifications":
        return (
          <>
            <div className="py-3 border-b border-gray-100 mb-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Par email</p>
            </div>
            <Field label="Scan terminé" desc="Recevoir un email à la fin de chaque analyse">
              <Toggle value={notifs.emailScanComplete} onChange={(v) => setNotifs({ ...notifs, emailScanComplete: v })} />
            </Field>
            <div className="py-3 border-b border-gray-100 mb-1 mt-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dans l'application</p>
            </div>
            <Field label="Alertes de sécurité" desc="Notifications dans la barre latérale">
              <Toggle value={notifs.inAppAlerts} onChange={(v) => setNotifs({ ...notifs, inAppAlerts: v })} />
            </Field>
          </>
        );

      case "securite":
        return (
          <>
            <div className="py-4 border-b border-gray-100 space-y-3">
              <p className="text-sm text-gray-900 font-medium">Changer le mot de passe</p>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Mot de passe actuel</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={security.currentPwd}
                    onChange={(e) => setSecurity({ ...security, currentPwd: e.target.value })}
                    placeholder="••••••••"
                    className={`${inputCls} pr-9`}
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={security.newPwd}
                    onChange={(e) => setSecurity({ ...security, newPwd: e.target.value })}
                    placeholder="••••••••"
                    className={`${inputCls} pr-9`}
                  />
                  <button onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez votre compte et vos préférences</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition ${
            saved ? "bg-green-50 text-green-700 border border-green-200" : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
          }`}
        >
          <Save size={13} /> {saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                active === id
                  ? "bg-green-50 text-green-700 border border-green-200 font-medium"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Icon size={15} className="shrink-0" /> {label}
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