import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Statistics from './pages/Statistics';
import Labs from './pages/Labs';
import Settings from './pages/Settings';
import { GlobalProvider } from "./context/GlobalContext";
import UsersPage from "./pages/UsersPage";
import ChatPage from "./pages/ChatPage";
import './App.css';
import AdminAudits from './pages/AdminAudits';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
function App() {
  return (
    <GlobalProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ClientDashboard />} />
            <Route path="/AdminDashboard" element={<AdminDashboard />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/labs" element={<Labs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/AdminAudits" element={<AdminAudits />} />
            <Route path="/AdminReports" element={<AdminReports />} />
            <Route path="/AdminUsers" element={<AdminUsers/>} />
        
            <Route path="/AdminSettings" element={<AdminSettings />} />

            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} /> 
          </Routes>
        </AuthProvider>
      </Router>
    </GlobalProvider>
  );
}

export default App;