import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function Register() {
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    mdp: "",
    confirmPassword: "",
  });

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [errors, setErrors] = useState({
    nom: "",
    prenom: "",
    email: "",
    mdp: "",
    confirmPassword: "",
    global: "",
  });

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { register } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const emailRegex = useMemo(() => /^\S+@\S+\.\S+$/, []);

  const hasLower = (s) => /[a-z]/.test(s);
  const hasUpper = (s) => /[A-Z]/.test(s);
  const hasNumber = (s) => /\d/.test(s);
  const minLen = (s) => (s || "").length >= 8;

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "", global: "" }));
  };

  const validateAll = () => {
    const next = {
      nom: "",
      prenom: "",
      email: "",
      mdp: "",
      confirmPassword: "",
      global: "",
    };

    const nom = formData.nom.trim();
    const prenom = formData.prenom.trim();
    const email = formData.email.trim();
    const mdp = formData.mdp;
    const confirm = formData.confirmPassword;

    if (!nom) next.nom = "Nom requis.";
    else if (nom.length < 2)
      next.nom = "Nom invalide (min 2 caractères).";

    if (!prenom) next.prenom = "Prénom requis.";
    else if (prenom.length < 2)
      next.prenom = "Prénom invalide (min 2 caractères).";

    if (!email) next.email = "Email requis.";
    else if (!emailRegex.test(email))
      next.email = "Email invalide.";

    if (!mdp) {
      next.mdp = "Mot de passe requis.";
    } else if (!minLen(mdp)) {
      next.mdp = "Minimum 8 caractères.";
    } else if (!hasLower(mdp)) {
      next.mdp = "Ajoutez une minuscule.";
    } else if (!hasUpper(mdp)) {
      next.mdp = "Ajoutez une majuscule.";
    } else if (!hasNumber(mdp)) {
      next.mdp = "Ajoutez un chiffre.";
    }

    if (!confirm)
      next.confirmPassword = "Confirmation requise.";
    else if (mdp !== confirm)
      next.confirmPassword =
        "Les mots de passe ne correspondent pas.";

    const hasErrors = Object.entries(next).some(
      ([k, v]) => k !== "global" && Boolean(v)
    );

    return { nextErrors: next, hasErrors };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { nextErrors, hasErrors } = validateAll();

    if (hasErrors) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("nom", formData.nom.trim());
      fd.append("prenom", formData.prenom.trim());
      fd.append("email", formData.email.trim());
      fd.append("mdp", formData.mdp);

      await register(fd);

      navigate("/login");
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        global:
          err?.response?.data?.message ||
          err?.message ||
          "Inscription impossible.",
      }));
    } finally {
      setLoading(false);
    }
  };

  const pwdChecks = useMemo(() => {
    const p = formData.mdp || "";

    return {
      minLen: minLen(p),
      lower: hasLower(p),
      upper: hasUpper(p),
      number: hasNumber(p),
    };
  }, [formData.mdp]);

  const Rule = ({ ok, children }) => (
    <div
      className={`flex items-center gap-2 text-[11px] transition ${
        ok ? "text-emerald-600" : "text-gray-400"
      }`}
    >
      <CheckCircle2 size={12} />
      <span>{children}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-emerald-50/30 p-4">
      <div
        className={`flex flex-col md:flex-row w-full max-w-[1000px] bg-white rounded-2xl shadow-2xl shadow-gray-200/60 overflow-hidden transition-all duration-700 ${
          mounted
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-[0.98]"
        }`}
      >
        {/* LEFT PANEL */}
        <div className="hidden md:flex md:w-[55%] relative overflow-hidden flex-col justify-center items-center p-12 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white">
          {/* Decorations */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white/5" />

          <div className="relative z-10 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ShieldCheck size={32} className="text-white" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Rejoignez-nous
            </h1>

            <p className="text-emerald-100 text-sm leading-relaxed max-w-[300px] mx-auto">
              Créez votre compte et accédez à une plateforme
              intelligente d’analyse et d’audit de sécurité web.
            </p>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium px-6 py-2.5 rounded-xl border border-white/20 transition-all duration-200 hover:scale-[1.02] text-sm"
            >
              Se connecter <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-[45%] p-8 sm:p-10 md:p-12 flex flex-col justify-center">
          <div className="space-y-1 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Créer un compte
            </h2>

            <p className="text-sm text-gray-400">
              Commencez votre expérience sécurisée
            </p>
          </div>

          {/* ERROR */}
          {errors.global && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm animate-[shakeX_0.4s_ease-in-out]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errors.global}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nom + Prenom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nom */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  Nom
                </label>

                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    placeholder="Nom"
                    value={formData.nom}
                    onChange={(e) =>
                      setField("nom", e.target.value)
                    }
                    className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                      errors.nom
                        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                        : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                    }`}
                  />
                </div>

                {errors.nom && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.nom}
                  </p>
                )}
              </div>

              {/* Prenom */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  Prénom
                </label>

                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    placeholder="Prénom"
                    value={formData.prenom}
                    onChange={(e) =>
                      setField("prenom", e.target.value)
                    }
                    className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                      errors.prenom
                        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                        : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                    }`}
                  />
                </div>

                {errors.prenom && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.prenom}
                  </p>
                )}
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Email
              </label>

              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  value={formData.email}
                  onChange={(e) =>
                    setField("email", e.target.value)
                  }
                  className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                    errors.email
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                  }`}
                />

                {emailRegex.test(formData.email) &&
                  formData.email && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
                      ✓
                    </span>
                  )}
              </div>

              {errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.email}
                </p>
              )}
            </div>

            {/* PASSWORD */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Mot de passe
              </label>

              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.mdp}
                  onChange={(e) =>
                    setField("mdp", e.target.value)
                  }
                  className={`w-full pl-10 pr-11 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                    errors.mdp
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPwd ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {errors.mdp && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.mdp}
                </p>
              )}

              {/* PASSWORD RULES */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Rule ok={pwdChecks.minLen}>
                  8 caractères minimum
                </Rule>

                <Rule ok={pwdChecks.lower}>
                  1 lettre minuscule
                </Rule>

                <Rule ok={pwdChecks.upper}>
                  1 lettre majuscule
                </Rule>

                <Rule ok={pwdChecks.number}>
                  1 chiffre
                </Rule>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Confirmation
              </label>

              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type={showConfirmPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setField(
                      "confirmPassword",
                      e.target.value
                    )
                  }
                  className={`w-full pl-10 pr-11 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                    errors.confirmPassword
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                  }`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPwd((v) => !v)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showConfirmPwd ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:shadow-emerald-200/40 active:scale-[0.98] text-sm"
            >
              {loading ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Création...
                </>
              ) : (
                <>
                  Créer un compte
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* FOOTER */}
          <p className="mt-8 text-center text-xs text-gray-400">
            Vous avez déjà un compte ?{" "}
            <Link
              to="/login"
              className="text-emerald-600 font-semibold hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}