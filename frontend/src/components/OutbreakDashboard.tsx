import React, { useState } from "react";
import RiskStatus from "./RiskStatus";
import AlertsPanel from "./AlertsPanel";
import TrendsDashboard from "./TrendsDashboard";

interface OutbreakDashboardProps {
  token?: string;
  username?: string;
}

const OutbreakDashboard: React.FC<OutbreakDashboardProps> = ({
  token,
  username,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "alerts" | "trends">(
    "overview"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                🌊 Water Quality Monitoring
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time outbreak risk detection and alert management
              </p>
            </div>
            {username && (
              <div className="text-right">
                <p className="text-gray-600">Logged in as</p>
                <p className="text-xl font-semibold text-gray-900">
                  {username}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white rounded-lg shadow-md p-1 w-fit">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === "overview"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === "alerts"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            🚨 Alerts
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === "trends"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            📈 Trends
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === "overview" && (
            <div className="space-y-6">
              <RiskStatus token={token} autoRefresh={true} refreshInterval={30000} />
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="space-y-6">
              <AlertsPanel token={token} autoRefresh={true} refreshInterval={30000} />
            </div>
          )}

          {activeTab === "trends" && (
            <div className="space-y-6">
              <TrendsDashboard token={token} autoRefresh={true} refreshInterval={30000} />
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">
            ℹ️ How This Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📊 Overview</h4>
              <p className="text-sm text-gray-600">
                View current risk status across all monitored locations. Shows
                water quality metrics and risk levels.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">🚨 Alerts</h4>
              <p className="text-sm text-gray-600">
                Active outbreak alerts triggered by consecutive HIGH risk
                predictions. Receive notifications to registered officials.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📈 Trends</h4>
              <p className="text-sm text-gray-600">
                Visualize patterns in prediction counts and water quality
                metrics over time.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <span className="text-gray-600">
                <strong>GREEN (LOW):</strong> Water quality is normal
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-600">⚠️</span>
              <span className="text-gray-600">
                <strong>YELLOW (MEDIUM):</strong> Monitor closely for changes
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600">🚨</span>
              <span className="text-gray-600">
                <strong>RED (HIGH):</strong> Alert triggered, immediate action needed
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Refresh Info */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Data auto-refreshes every 30 seconds. Last update shown on each panel.</p>
        </div>
      </div>
    </div>
  );
};

export default OutbreakDashboard;
