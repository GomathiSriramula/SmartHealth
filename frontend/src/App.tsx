import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

function App() {
  const [currentView, setCurrentView] = useState<
    "landing" | "dashboard" | "login" | "register" | "forgot-password" | "reset-password"
  >("landing");
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("smarthealth_token");
    const savedUsername = localStorage.getItem("smarthealth_username");
    const savedRole = localStorage.getItem("smarthealth_role");
    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUsername(savedUsername);
      setUserRole(savedRole || "USER");
    }
  }, []);

  // Detect a password-reset link (e.g. /reset-password?token=...&email=...)
  // emailed by /auth/forgot-password. The app has no router — this is a
  // one-time check of the initial URL on load.
  useEffect(() => {
    if (window.location.pathname === "/reset-password") {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token") || "";
      const urlEmail = params.get("email") || "";
      setResetToken(urlToken);
      setResetEmail(urlEmail);
      setCurrentView("reset-password");
      // Clean the token out of the URL/history so it isn't re-processed on
      // refresh or left visible in the address bar longer than necessary.
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const navigateToDashboard = () => {
    if (!token) {
      setCurrentView("login");
    } else {
      setCurrentView("dashboard");
    }
  };

  const navigateToLanding = () => {
    setCurrentView("landing");
  };

  const handleLoginSuccess = (newToken: string, user: string, role: string) => {
    setToken(newToken);
    setUsername(user);
    setUserRole(role);
    localStorage.setItem("smarthealth_token", newToken);
    localStorage.setItem("smarthealth_username", user);
    localStorage.setItem("smarthealth_role", role);
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    setUserRole(null);
    localStorage.removeItem("smarthealth_token");
    localStorage.removeItem("smarthealth_username");
    localStorage.removeItem("smarthealth_role");
    setCurrentView("landing");
  };

  const handleRegisterSuccess = () => {
    setCurrentView("login");
  };

  return (
    <div className="min-h-screen">
      {currentView === "landing" && (
        <LandingPage onGetStarted={navigateToDashboard} />
      )}
      {currentView === "login" && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onShowRegister={() => setCurrentView("register")}
          onShowForgotPassword={() => setCurrentView("forgot-password")}
        />
      )}
      {currentView === "register" && (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onShowLogin={() => setCurrentView("login")}
        />
      )}
      {currentView === "forgot-password" && (
        <ForgotPassword onShowLogin={() => setCurrentView("login")} />
      )}
      {currentView === "reset-password" && (
        <ResetPassword
          token={resetToken}
          email={resetEmail}
          onResetSuccess={() => setCurrentView("login")}
          onShowLogin={() => setCurrentView("login")}
        />
      )}
      {currentView === "dashboard" && token && (
        <Dashboard
          onBackToLanding={navigateToLanding}
          token={token}
          username={username || "User"}
          userRole={userRole || "USER"}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
