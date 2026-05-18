import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVulnerabilities, getLabs, getPlatformStats } from '../services/authService';

function Home() {
  const [labs, setLabs] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        try {
          const labsData = await getLabs();
          setLabs(Array.isArray(labsData) ? labsData : []);
        } catch {}
        try {
          const vulnData = await getVulnerabilities();
          setVulnerabilities(Array.isArray(vulnData) ? vulnData : []);
        } catch {}
        try {
          const statsData = await getPlatformStats();
          setStats(statsData);
        } catch {}
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-up');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-section').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 text-slate-800 overflow-hidden">
      {/* Floating Green Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bob"></div>
        <div className="absolute top-1/2 left-10 w-64 h-64 bg-green-300 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-bob-slow"></div>
        <div className="absolute -bottom-40 right-20 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-bob-fast"></div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-28 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center reveal-section">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-3xl text-lg mb-8 shadow-2xl reveal-section" style={{animationDelay: '200ms'}}>
              Plateforme de Sécurité
            </div>
            <h1 className="text-6xl md:text-8xl font-black mb-8 bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800 bg-clip-text text-transparent leading-tight">
              Sécurité<br/>
              <span className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">Intelligente</span>
            </h1>
            <p className="text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed reveal-section" style={{animationDelay: '400ms'}}>
              Protégez vos systèmes avec notre IA éco-responsable. 
              Détection, analyse et correction en un clic.
            </p>
            <div className="flex flex-col lg:flex-row gap-6 justify-center items-center reveal-section" style={{animationDelay: '600ms'}}>
              <Link 
                to="/login"
                className="group relative px-12 py-6 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-xl rounded-3xl shadow-2xl hover:shadow-emerald-500/50 transform hover:-translate-y-2 transition-all duration-500 overflow-hidden"
              >
                <span> Commencer</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-green-500 -skew-x-12 -translate-x-[120%] group-hover:translate-x-[120%] transition-transform duration-1000"></div>
              </Link>
              <Link 
                to="/register"
                className="px-12 py-6 border-4 border-emerald-500 text-emerald-600 font-bold text-xl rounded-3xl hover:bg-emerald-500 hover:text-white transition-all duration-300 shadow-xl"
              >
                Nouveau compte
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Wave */}
      <section className="relative py-32 overflow-hidden reveal-section">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-500/5"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">
              Fonctionnalités
            </h2>
            <div className="w-24 h-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                title: '🛡️ Protection AI', 
                desc: 'Détection proactive 24/7', 
                stats: '99.9%', 
                delay: '0ms'
              },
              { 
                title: '📈 Analyse Temps Réel', 
                desc: 'Visualisation instantanée', 
                stats: '0.1s', 
                delay: '100ms'
              },
              { 
                title: '🔧 Auto-Remédiation', 
                desc: 'Correction intelligente', 
                stats: '95%', 
                delay: '200ms'
              },
              { 
                title: '👥 Équipe Unifiée', 
                desc: 'Collaboration fluide', 
                stats: 'Multi-tenant', 
                delay: '300ms'
              },
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="group relative p-10 rounded-3xl bg-white/80 backdrop-blur-xl border border-emerald-200/50 shadow-2xl hover:shadow-emerald-400/30 hover:-translate-y-4 transition-all duration-700 cursor-pointer reveal-section"
                style={{animationDelay: feature.delay}}
              >
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-400 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto shadow-2xl group-hover:scale-110 transition-all duration-500">
                  {feature.title.split(' ')[0]}
                </div>
                <h3 className="text-2xl font-black mb-4 text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {feature.title.split(' ').slice(1).join(' ')}
                </h3>
                <p className="text-slate-600 mb-6 leading-relaxed">{feature.desc}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-emerald-600">{feature.stats}</span>
                  <span className="text-emerald-500 font-bold">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Labs Showcase */}
      {labs.length > 0 && (
        <section className="py-32 bg-gradient-to-t from-emerald-500/10 to-transparent reveal-section">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">
                Labs Pratiques
              </h2>
              <p className="text-2xl text-slate-600">Entraînez-vous sur des environnements réels</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {labs.map((lab, idx) => {
                const level = (lab.niveau || lab.difficulty || 'Intermédiaire').toLowerCase();
                const levelClass = level.includes('facile') 
                  ? 'from-emerald-400 to-green-400' 
                  : level.includes('difficile') 
                  ? 'from-orange-400 to-red-400' 
                  : 'from-blue-400 to-indigo-400';
                return (
                  <Link 
                    key={lab._id}
                    to={`/lab/${lab._id}`}
                    className="group relative rounded-3xl bg-white shadow-2xl hover:shadow-emerald-500/40 border-4 border-white/50 overflow-hidden hover:-translate-y-4 transition-all duration-700 reveal-section"
                  >
                    <div className="p-10 h-full flex flex-col">
                      <div className="flex items-start justify-between mb-6">
                        <h3 className="text-3xl font-black text-slate-800 group-hover:text-emerald-700 mb-2">
                          {lab.titre || lab.name}
                        </h3>
                        <div className={`px-4 py-2 rounded-2xl font-bold text-sm ${level.includes('facile') ? 'bg-emerald-100 text-emerald-700' : level.includes('difficile') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {lab.niveau || lab.difficulty}
                        </div>
                      </div>
                      <p className="text-slate-600 flex-1 mb-8 line-clamp-4 leading-relaxed">
                        {lab.description}
                      </p>
                      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                        <span className="text-lg font-bold text-emerald-600 group-hover:underline">
                          Lancer le Lab
                        </span>
                        <div className={`w-12 h-12 bg-gradient-to-r ${levelClass} rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-500`}>
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Audience Cards */}
      <section className="py-32 reveal-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">
              Pour Tous
            </h2>
            <p className="text-2xl text-slate-600">Adapté à chaque profil</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { 
                title: '👨‍💻 Développeurs', 
                desc: 'Sécurité en DevOps', 
                icon: '💻',
                color: 'emerald'
              },
              { 
                title: '🛠️ Sysadmins', 
                desc: 'Infrastructure', 
                icon: '🖥️',
                color: 'green'
              },
              { 
                title: '🔒 Sécurité', 
                desc: 'SOC & Threat Hunting', 
                icon: '🛡️',
                color: 'teal'
              }
            ].map((profile, idx) => (
              <div 
                key={idx}
                className="group relative p-12 rounded-3xl bg-gradient-to-b from-white to-emerald-50 border border-emerald-200 shadow-2xl hover:shadow-emerald-400/50 hover:-translate-y-4 transition-all duration-700 text-center reveal-section"
              >
                <div className={`w-32 h-32 bg-gradient-to-br from-${profile.color}-400 to-${profile.color}-500 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-8 shadow-2xl group-hover:scale-110 transition-all duration-500`}>
                  {profile.icon}
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-6 group-hover:text-emerald-700">
                  {profile.title}
                </h3>
                <p className="text-xl text-slate-600 font-semibold">{profile.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-gradient-to-t from-emerald-700 via-green-700 to-emerald-800 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          
          <h3 className="text-3xl font-black mb-6">Plateforme  de Sécurité</h3>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Excellence en cybersécurité avec une approche éco-responsable
          </p>
          <div className="border-t border-white/20 pt-8 text-emerald-100">
            <p>&copy; 2026 - Plateforme académique</p>
            <p className="text-sm mt-2 opacity-75">Sécurité durable pour demain</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;