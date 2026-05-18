import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPwdValid = mdp.length >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isEmailValid) { setError("Adresse email invalide"); return; }
    if (!isPwdValid) { setError("Veuillez entrer votre mot de passe"); return; }

    setLoading(true);
    try {
      const { user } = await login(email, mdp, rememberMe);

      if (user.role === "user") navigate("/dashboard");
      else if (user.role === "admin") navigate("/AdminDashboard");
      else navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-emerald-50/30 p-4">
      <div
        className={`flex flex-col md:flex-row w-full max-w-[920px] bg-white rounded-2xl shadow-2xl shadow-gray-200/60 overflow-hidden transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.98]"
        }`}
      >
        {/* Left — branding panel */}
        <div className="hidden md:flex md:w-[55%] relative overflow-hidden flex-col justify-center items-center p-12 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white">
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white/5" />

          <div className="relative z-10 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Bienvenue</h1>
            <p className="text-emerald-100 text-sm leading-relaxed max-w-[280px] mx-auto">
              Plateforme d'analyse de sécurité web.
              Protégez vos applications avec des audits intelligents.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium px-6 py-2.5 rounded-xl border border-white/20 transition-all duration-200 hover:scale-[1.02] text-sm"
            >
              Créer un compte <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right — login form */}
        <div className="w-full md:w-[45%] p-8 sm:p-10 md:p-12 flex flex-col justify-center">
          <div className="space-y-1 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Connexion</h2>
            <p className="text-sm text-gray-400">Entrez vos identifiants pour continuer</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm animate-[shakeX_0.4s_ease-in-out]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:bg-white ${
                    email && !isEmailValid
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : "border-gray-200 focus:ring-emerald-200 focus:border-emerald-400"
                  }`}
                />
                {email && isEmailValid && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 animate-[fadeIn_0.2s_ease]">✓</span>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={mdp}
                  onChange={(e) => setMdp(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-gray-300 bg-white transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center">
                    {rememberMe && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="animate-[fadeIn_0.15s_ease]">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">Se souvenir de moi</span>
              </label>
              <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-emerald-600 transition">
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:shadow-emerald-200/40 active:scale-[0.98] text-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connexion en cours…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-400">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
              Créer un compte
            </Link>
          </p>

          {/* Mobile-only register link */}
          <div className="md:hidden mt-4 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium hover:underline"
            >
              Découvrir la plateforme <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Global keyframe for shake animation */}
      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}