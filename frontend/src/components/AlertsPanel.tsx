import React, { useState, useEffect, useCallback } from 'react';
import RiskIndicator from "./RiskIndicator";
import LoadingSpinner from "./LoadingSpinner";

interface AlertData {
  _id: string;
  location: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  notificationSent: boolean;
}

interface AlertsPanelProps {
  token?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  token,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    resolvedAlerts: 0,
  });

  const API_URL = "http://127.0.0.1:5000";

  const fetchAlerts = useCallback(async () => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch active alerts
      const alertResponse = await fetch(`${API_URL}/api/alerts?status=active&limit=50`, {
        headers,
      });

      if (alertResponse.ok) {
        const alertData = await alertResponse.json();
        setAlerts(alertData.alerts || []);
        setError("");
      }

      // Fetch alert stats
      const statsResponse = await fetch(`${API_URL}/api/alerts/stats/summary`, {
        headers,
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          totalAlerts: statsData.stats?.totalAlerts || 0,
          activeAlerts: statsData.stats?.activeAlerts || 0,
          resolvedAlerts: statsData.stats?.resolvedAlerts || 0,
        });
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to fetch alerts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    fetchAlerts();

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchAlerts]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && alerts.length === 0) {
    return <LoadingSpinner />;
  }

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const hasHighRiskAlerts = activeAlerts.some((a) => a.riskLevel === "HIGH");

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            🚨 Outbreak Alerts
          </h2>
          <div className="text-sm text-gray-500">
            {lastUpdated && (
              <span>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-sm font-semibold text-red-700">Active Alerts</div>
            <div className="text-2xl font-bold text-red-600">
              {stats.activeAlerts}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-700">Total</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalAlerts}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm font-semibold text-green-700">Resolved</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.resolvedAlerts}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {hasHighRiskAlerts && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700 font-semibold">⚠️ HIGH RISK ALERT</p>
            <p className="text-red-600 text-sm">
              Outbreak detected at one or more locations. Immediate action recommended.
            </p>
          </div>
        )}

        {activeAlerts.length === 0 && !error && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
            <p className="text-green-700 font-semibold">✅ All Clear</p>
            <p className="text-green-600 text-sm">
              No active alerts. Water quality is normal.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
            <p className="text-yellow-700 font-semibold">⚠️ Connection Issue</p>
            <p className="text-yellow-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {activeAlerts.length > 0 ? (
          activeAlerts.map((alert) => (
            <div
              key={alert._id}
              className={`rounded-lg border-2 p-4 transition-all ${
                alert.riskLevel === "HIGH"
                  ? "border-red-300 bg-red-50"
                  : alert.riskLevel === "MEDIUM"
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-green-300 bg-green-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-800">
                      {alert.location}
                    </h3>
                    <RiskIndicator
                      riskLevel={alert.riskLevel}
                      size="small"
                      showLabel={true}
                    />
                  </div>
                  <p className="text-gray-700 text-sm mb-2">
                    {alert.reason}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>🕒 {formatTime(alert.createdAt)}</span>
                    {alert.notificationSent && (
                      <span className="text-blue-600">📧 Notification sent</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      alert.status === "active"
                        ? "bg-red-200 text-red-800"
                        : "bg-green-200 text-green-800"
                    }`}
                  >
                    {alert.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">
            No active alerts at this time.
          </p>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchAlerts}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        🔄 Refresh Now
      </button>
    </div>
  );
};

export default AlertsPanel;
