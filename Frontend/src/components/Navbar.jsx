import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const Navbar = () => {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar bg-white shadow-md px-6 py-3">
      <div className="navbar-container flex justify-between items-center max-w-7xl mx-auto">
        <Link to="/" className="navbar-logo flex items-center text-[#10b981] font-bold text-xl">
          <span className="logo-icon mr-2">🔒</span>
          SecureTest
        </Link>

        <div className="navbar-menu flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="nav-link px-3 py-1 rounded hover:bg-[#10b981] hover:text-white transition"
                >
                  Admin Dashboard
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="nav-link px-3 py-1 rounded hover:bg-[#10b981] hover:text-white transition"
                >
                  Mon Dashboard
                </Link>
              )}

              <div className="nav-user relative">
                <button
                  className="nav-user-btn px-3 py-1 rounded border border-[#10b981] text-[#10b981] hover:bg-[#10b981] hover:text-white transition"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {user?.prenom || user?.nom || 'Utilisateur'} ▼
                </button>

                {isDropdownOpen && (
                  <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white border border-[#10b981] rounded shadow-lg z-50">
                    <Link
                      to="/profile"
                      className="dropdown-item block px-4 py-2 hover:bg-[#10b981] hover:text-white transition"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Mon Profil
                    </Link>
                    <button
                      className="dropdown-item w-full text-left px-4 py-2 hover:bg-[#10b981] hover:text-white transition"
                      onClick={handleLogout}
                    >
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="nav-link px-3 py-1 rounded hover:bg-green-50 transition"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="nav-link px-3 py-1 rounded bg-[#10b981] text-white hover:bg-[#059669] transition"
              >
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;