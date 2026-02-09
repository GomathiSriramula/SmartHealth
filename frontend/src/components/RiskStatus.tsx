import React, { useState, useEffect, useCallback } from 'react';
import RiskIndicator from "./RiskIndicator";

interface LocationRisk {
  location: string;
  riskLevel: string;
  confidence: number;
  timestamp: string;
  waterQuality?: {
    pH: number;
    Turbidity: number;
    Dissolved_Oxygen: number;
  };
}

interface RiskStatusProps {
  token?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const RiskStatus: React.FC<RiskStatusProps> = ({
  token,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [locations, setLocations] = useState<LocationRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [overallRisk, setOverallRisk] = useState("LOW");

  const API_URL = "http://127.0.0.1:5000";

  const calculateOverallRisk = (risks: string[]) => {
    if (risks.includes("HIGH")) return "HIGH";
    if (risks.includes("MEDIUM")) return "MEDIUM";
    return "LOW";
  };

  const fetchRiskStatus = useCallback(async () => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/predictions?limit=50`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        const predictions = data.predictions || [];

        // Group by location and get latest prediction
        const locationMap = new Map<string, LocationRisk>();

        predictions.forEach((pred: { location?: string; risk?: string; confidence?: number; predictedAt: string; waterQuality?: { pH: number; Turbidity: number; Dissolved_Oxygen: number; }; }) => {
          const location = pred.location || "Unknown";
          const existing = locationMap.get(location);

          // Keep only the most recent prediction per location
          if (
            !existing ||
            new Date(pred.predictedAt) > new Date(existing.timestamp)
          ) {
            locationMap.set(location, {
              location,
              riskLevel: pred.risk || "LOW",
              confidence: pred.confidence || 0,
              timestamp: pred.predictedAt,
              waterQuality: pred.waterQuality,
            });
          }
        });

        const locationsList = Array.from(locationMap.values());
        setLocations(locationsList);

        // Calculate overall risk
        const risks = locationsList.map((l) => l.riskLevel);
        setOverallRisk(calculateOverallRisk(risks));

        setError("");
        setLastUpdated(new Date());
      } else if (response.status === 503 || response.status === 502) {
        setError("🔴 Backend service is unavailable");
      } else if (response.status === 500) {
        setError("🔴 Server error - unable to fetch risk data");
      } else {
        setError("⚠️ Failed to load risk data");
      }
    } catch (err) {
      setError("🔴 Cannot reach the server. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    fetchRiskStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchRiskStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchRiskStatus]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const getWaterQualityStatus = (wq?: { pH?: number; Turbidity?: number; Dissolved_Oxygen?: number; }) => {
    if (!wq) return "N/A";
    return `pH: ${wq.pH?.toFixed(1) || 'N/A'} | Turbidity: ${wq.Turbidity?.toFixed(1) || 'N/A'} | DO: ${wq.Dissolved_Oxygen?.toFixed(1) || 'N/A'}`;
  };

  if (loading && locations.length === 0) {
    return <div className="text-center py-4 text-gray-500">Loading risk data...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Overall Risk */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Risk Status Overview</h2>
          {lastUpdated && (
            <div className="text-sm text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Overall Risk Card */}
        <div className="rounded-lg border-2 p-6 mb-4 bg-gradient-to-r from-white to-gray-50 border-gray-300">
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-600 mb-2">
              OVERALL WATER QUALITY STATUS
            </p>
            <RiskIndicator
              riskLevel={overallRisk}
              size="large"
              showLabel={true}
            />
            <p className="text-xs text-gray-500 mt-3">
              Based on {locations.length} monitored location{locations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded">
            <p className="text-red-700 font-semibold">{error}</p>
            {error.includes("Cannot reach") && (
              <p className="text-red-600 text-sm mt-1">
                💡 Tip: Make sure backend2 is running (npm start in backend2 folder)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Locations Grid */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">
          📍 By Location
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.length > 0 ? (
            locations.map((loc) => (
              <div
                key={loc.location}
                className={`rounded-lg border-2 p-4 ${
                  loc.riskLevel === "HIGH"
                    ? "border-red-300 bg-red-50"
                    : loc.riskLevel === "MEDIUM"
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-green-300 bg-green-50"
                }`}
              >
                <div className="mb-3">
                  <h4 className="font-bold text-gray-800 text-base">
                    {loc.location}
                  </h4>
                  <RiskIndicator
                    riskLevel={loc.riskLevel}
                    confidence={loc.confidence}
                    size="small"
                    showLabel={true}
                  />
                </div>

                <div className="space-y-2 text-xs">
                  {loc.waterQuality && (
                    <div className="bg-white rounded p-2 border border-gray-200">
                      <p className="font-semibold text-gray-700 mb-1">
                        Water Quality
                      </p>
                      <p className="text-gray-600 font-mono">
                        {getWaterQualityStatus(loc.waterQuality)}
                      </p>
                    </div>
                  )}
                  <p className="text-gray-500">
                    🕒 {formatTime(loc.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 col-span-full text-center py-4">
              No location data available
            </p>
          )}
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchRiskStatus}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        🔄 Refresh Now
      </button>
    </div>
  );
};

export default RiskStatus;
