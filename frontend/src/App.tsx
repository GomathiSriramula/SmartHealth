import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";

function App() {
  const [currentView, setCurrentView] = useState<
    "landing" | "dashboard" | "login" | "register"
  >("landing");
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("smarthealth_token");
    const savedUsername = localStorage.getItem("smarthealth_username");
    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUsername(savedUsername);
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

  const handleLoginSuccess = (newToken: string, user: string) => {
    setToken(newToken);
    setUsername(user);
    localStorage.setItem("smarthealth_token", newToken);
    localStorage.setItem("smarthealth_username", user);
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("smarthealth_token");
    localStorage.removeItem("smarthealth_username");
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
        />
      )}
      {currentView === "register" && (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onShowLogin={() => setCurrentView("login")}
        />
      )}
      {currentView === "dashboard" && token && (
        <Dashboard
          onBackToLanding={navigateToLanding}
          token={token}
          username={username || "User"}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
