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
  notificationError?: string;
  resolvedAt?: string;
  resolvedReason?: string;
  consecutiveHighRisks?: number;
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
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">("active");
  const [filterLocation, setFilterLocation] = useState("");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const API_URL = "http://127.0.0.1:5000";

  const getHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const resolveAlert = useCallback(async (alertId: string, reason: string = "Manually resolved") => {
    setActionInProgress(alertId);
    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        const result = await response.json();
        setAlerts(prev => prev.map(a => a._id === alertId ? result.alert : a));
        if (selectedAlert?._id === alertId) {
          setSelectedAlert(result.alert);
        }
      } else {
        console.error("Failed to resolve alert");
      }
    } catch (err) {
      console.error("Error resolving alert:", err);
    } finally {
      setActionInProgress(null);
    }
  }, [API_URL, getHeaders, selectedAlert]);

  const resendNotification = useCallback(async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}/notify`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        setAlerts(prev => prev.map(a => a._id === alertId ? result.alert : a));
        if (selectedAlert?._id === alertId) {
          setSelectedAlert(result.alert);
        }
      } else {
        console.error("Failed to resend notification");
      }
    } catch (err) {
      console.error("Error resending notification:", err);
    } finally {
      setActionInProgress(null);
    }
  }, [API_URL, getHeaders, selectedAlert]);

  const toggleExpandAlert = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const openAlertDetails = (alert: AlertData) => {
    setSelectedAlert(alert);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedAlert(null);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const headers = getHeaders();
      const statusParam = filterStatus === "all" ? "all" : filterStatus;
      let url = `${API_URL}/api/alerts?status=${statusParam}&limit=100`;

      if (filterLocation) {
        url += `&location=${encodeURIComponent(filterLocation)}`;
      }

      const alertResponse = await fetch(url, { headers });

      if (alertResponse.ok) {
        const alertData = await alertResponse.json();
        setAlerts(alertData.alerts || []);
        setError("");
      } else if (alertResponse.status === 503 || alertResponse.status === 502) {
        setError("🔴 Backend service is unavailable");
        setAlerts([]);
      } else if (alertResponse.status === 500) {
        setError("🔴 Server error occurred");
        setAlerts([]);
      } else {
        setError("⚠️ Failed to load alerts");
        setAlerts([]);
      }

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
      setError("🔴 Cannot reach the server. Is the backend running?");
      setAlerts([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus, filterLocation, getHeaders]);

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

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUniqueLocations = () => {
    const locations = new Set(alerts.map(a => a.location));
    return Array.from(locations).sort();
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
          <h2 className="text-2xl font-bold text-gray-800">🚨 Outbreak Alerts</h2>
          <div className="text-sm text-gray-500">
            {lastUpdated && <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-sm font-semibold text-red-700">Active Alerts</div>
            <div className="text-2xl font-bold text-red-600">{stats.activeAlerts}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-700">Total</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalAlerts}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm font-semibold text-green-700">Resolved</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolvedAlerts}</div>
          </div>
        </div>

        {/* Status Message */}
        {hasHighRiskAlerts && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
            <p className="text-red-700 font-semibold">⚠️ HIGH RISK ALERT</p>
            <p className="text-red-600 text-sm">
              Outbreak detected at one or more locations. Immediate action recommended.
            </p>
          </div>
        )}

        {activeAlerts.length === 0 && !error && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
            <p className="text-green-700 font-semibold">✅ All Clear</p>
            <p className="text-green-600 text-sm">
              No active alerts. Water quality is normal.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4 rounded">
            <p className="text-yellow-700 font-semibold">⚠️ Connection Issue</p>
            <p className="text-yellow-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-3">Filters</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "resolved")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="resolved">Resolved Only</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-2">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Locations</option>
                {getUniqueLocations().map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <div
              key={alert._id}
              className={`rounded-lg border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
                alert.riskLevel === "HIGH"
                  ? "border-red-300 bg-red-50"
                  : alert.riskLevel === "MEDIUM"
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-green-300 bg-green-50"
              }`}
            >
              {/* Basic Info */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-800">{alert.location}</h3>
                    <RiskIndicator riskLevel={alert.riskLevel} size="small" showLabel={true} />
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{alert.reason}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                    <span>🕒 {formatTime(alert.createdAt)}</span>
                    {alert.notificationSent && <span className="text-blue-600">📧 Notification sent</span>}
                    {alert.notificationError && <span className="text-red-600">❌ Notification failed</span>}
                    {alert.status === "resolved" && alert.resolvedAt && (
                      <span className="text-green-600">✅ Resolved {formatTime(alert.resolvedAt)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      alert.status === "active" ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                    }`}
                  >
                    {alert.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => toggleExpandAlert(alert._id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expandedAlerts.has(alert._id) ? "▼ Hide" : "▶ Show"} Details
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedAlerts.has(alert._id) && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-600 font-semibold">Created</p>
                        <p className="text-gray-800">{formatFullDate(alert.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">Alert ID</p>
                        <p className="text-gray-800 font-mono text-xs">{alert._id.slice(0, 8)}...</p>
                      </div>
                    </div>

                    {alert.consecutiveHighRisks && (
                      <div>
                        <p className="text-gray-600 font-semibold">Consecutive High Risk Readings</p>
                        <p className="text-gray-800">{alert.consecutiveHighRisks}</p>
                      </div>
                    )}

                    {alert.status === "resolved" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-600 font-semibold">Resolved</p>
                          <p className="text-gray-800">{alert.resolvedAt ? formatFullDate(alert.resolvedAt) : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 font-semibold">Reason</p>
                          <p className="text-gray-800">{alert.resolvedReason || "N/A"}</p>
                        </div>
                      </div>
                    )}

                    {alert.notificationError && (
                      <div className="bg-red-100 border border-red-300 rounded p-2 text-red-700">
                        <p className="font-semibold text-xs">Notification Error</p>
                        <p className="text-xs">{alert.notificationError}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <button
                        onClick={() => openAlertDetails(alert)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                        disabled={actionInProgress === alert._id}
                      >
                        📋 Full Details
                      </button>

                      {alert.status === "active" && (
                        <button
                          onClick={() => resolveAlert(alert._id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                          disabled={actionInProgress === alert._id}
                        >
                          {actionInProgress === alert._id ? "Processing..." : "✅ Resolve Alert"}
                        </button>
                      )}

                      {!alert.notificationSent && (
                        <button
                          onClick={() => resendNotification(alert._id)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                          disabled={actionInProgress === alert._id}
                        >
                          {actionInProgress === alert._id ? "Sending..." : "📧 Send Alert"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">No alerts found matching your filters.</p>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => {
          setLoading(true);
          fetchAlerts();
        }}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        disabled={loading}
      >
        🔄 {loading ? "Loading..." : "Refresh Now"}
      </button>

      {/* Detail Modal */}
      {showDetailModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Alert Details</h3>
              <button
                onClick={closeDetailModal}
                className="text-gray-500 hover:text-gray-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Location</p>
                  <p className="text-gray-800 text-lg font-bold">{selectedAlert.location}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Risk Level</p>
                  <div className="mt-1">
                    <RiskIndicator riskLevel={selectedAlert.riskLevel} size="medium" showLabel={true} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-gray-600 font-semibold text-sm">Reason</p>
                <p className="text-gray-800">{selectedAlert.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Status</p>
                  <p className={`font-semibold ${selectedAlert.status === "active" ? "text-red-600" : "text-green-600"}`}>
                    {selectedAlert.status.toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Created</p>
                  <p className="text-gray-800 text-sm">{formatFullDate(selectedAlert.createdAt)}</p>
                </div>
              </div>

              {selectedAlert.consecutiveHighRisks && (
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Consecutive High Risk Readings</p>
                  <p className="text-gray-800 text-lg font-bold">{selectedAlert.consecutiveHighRisks}</p>
                </div>
              )}

              <div>
                <p className="text-gray-600 font-semibold text-sm">Notification Status</p>
                <div className="mt-1 space-y-1">
                  {selectedAlert.notificationSent && (
                    <p className="text-green-600 text-sm">✅ Notification sent successfully</p>
                  )}
                  {selectedAlert.notificationError && (
                    <p className="text-red-600 text-sm">❌ {selectedAlert.notificationError}</p>
                  )}
                  {!selectedAlert.notificationSent && !selectedAlert.notificationError && (
                    <p className="text-gray-600 text-sm">⏳ Pending notification</p>
                  )}
                </div>
              </div>

              {selectedAlert.status === "resolved" && (
                <div>
                  <p className="text-gray-600 font-semibold text-sm">Resolution Details</p>
                  <div className="mt-2 bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-small text-gray-700">
                      <strong>Resolved:</strong> {selectedAlert.resolvedAt ? formatFullDate(selectedAlert.resolvedAt) : "N/A"}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <strong>Reason:</strong> {selectedAlert.resolvedReason || "Not provided"}
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <p className="text-gray-600 font-semibold text-xs mb-2">ALERT ID</p>
                <p className="text-gray-800 font-mono text-xs break-all">{selectedAlert._id}</p>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                {selectedAlert.status === "active" && (
                  <button
                    onClick={() => {
                      resolveAlert(selectedAlert._id);
                      closeDetailModal();
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition-colors disabled:opacity-50"
                    disabled={actionInProgress === selectedAlert._id}
                  >
                    ✅ Resolve This Alert
                  </button>
                )}

                {!selectedAlert.notificationSent && (
                  <button
                    onClick={() => {
                      resendNotification(selectedAlert._id);
                      closeDetailModal();
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors disabled:opacity-50"
                    disabled={actionInProgress === selectedAlert._id}
                  >
                    📧 Send Notification
                  </button>
                )}

                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;
