import { useState } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');

  const navigateToDashboard = () => {
    setCurrentView('dashboard');
  };

  const navigateToLanding = () => {
    setCurrentView('landing');
  };

  return (
    <div className="min-h-screen">
      {currentView === 'landing' ? (
        <LandingPage onGetStarted={navigateToDashboard} />
      ) : (
        <Dashboard onBackToLanding={navigateToLanding} />
      )}
    </div>
  );
}

export default App;