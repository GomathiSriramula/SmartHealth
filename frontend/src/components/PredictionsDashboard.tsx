import { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import Alert from "./Alert";

interface Prediction {
  _id: string;
  predictionType: string;
  location?: string;
  riskLevel: "low" | "medium" | "high";
  predictedDate: string;
  details: string;
  recommendations?: string[];
  modelVersion?: string;
  confidence?: number;
  lat?: number;
  lng?: number;
  created_at?: string;
  updated_at?: string;
}

interface PredictionsDashboardProps {
  token?: string;
}

export const PredictionsDashboard: React.FC<PredictionsDashboardProps> = ({ token }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [filter, setFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastPredictionTime, setLastPredictionTime] = useState<string>("");

  const API_URL = "http://127.0.0.1:5000";

  useEffect(() => {
    fetchPredictions();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPredictions, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const fetchPredictions = async () => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/predictions`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        const predictionsArray = data.predictions || [];
        setPredictions(predictionsArray);
        setError("");
        
        // Set last prediction time if available
        if (predictionsArray.length > 0) {
          const mostRecent = predictionsArray[0];
          const timestamp = mostRecent.predictedDate || mostRecent.created_at || new Date().toISOString();
          setLastPredictionTime(formatRelativeTime(timestamp));
        }
        
        setLastUpdated(new Date());
      } else if (response.status === 503 || response.status === 502) {
        setError("🔴 Backend service is unavailable. Please try again in a moment.");
        setPredictions([]);
      } else if (response.status === 500) {
        setError("🔴 Server error. Please contact support if this persists.");
        setPredictions([]);
      } else {
        setError("⚠️ Failed to load predictions. Check your connection.");
        setPredictions([]);
      }
    } catch (err) {
      setError("🔴 Cannot reach the server. Is the backend running?");
      setPredictions([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    const riskLower = risk.toLowerCase();
    switch (riskLower) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getRiskIcon = (risk: string) => {
    const riskLower = risk.toLowerCase();
    switch (riskLower) {
      case "high":
        return "🚨";
      case "medium":
        return "⚠️";
      case "low":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  const filteredPredictions = predictions.filter((pred) => {
    if (filter === "All") return true;
    return pred.riskLevel === filter.toLowerCase();
  });

  const stats = {
    total: predictions.length,
    high: predictions.filter((p) => p.riskLevel === "high").length,
    medium: predictions.filter((p) => p.riskLevel === "medium").length,
    low: predictions.filter((p) => p.riskLevel === "low").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">🔮 ML Predictions Dashboard</h2>
        <p className="text-purple-100">
          Real-time disease outbreak risk predictions from sensor data analysis
        </p>
        {lastUpdated && (
          <p className="text-sm text-purple-200 mt-3">
            📊 Last checked: {lastUpdated.toLocaleTimeString()}
            {lastPredictionTime && ` • Most recent prediction: ${lastPredictionTime}`}
          </p>
        )}
      </div>

      {/* Error/Status Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700 font-semibold">{error}</p>
          <p className="text-red-600 text-sm mt-1">
            Try refreshing the page or check if the backend service is running (npm start in backend2 folder).
          </p>
        </div>
      )}

      {loading && predictions.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Loading predictions...</p>
          </div>
        </div>
      )}

      {!loading && !error && predictions.length === 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-blue-700 font-semibold">ℹ️ No predictions yet</p>
          <p className="text-blue-600 text-sm mt-1">
            Predictions will appear here once the ML model processes sensor data.
          </p>
        </div>
      )}

      {!error && predictions.length > 0 && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Predictions</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Risk</p>
                  <p className="text-3xl font-bold text-red-600">{stats.high}</p>
                </div>
                <div className="text-4xl">🚨</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Medium Risk</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.medium}</p>
                </div>
                <div className="text-4xl">⚠️</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Low Risk</p>
                  <p className="text-3xl font-bold text-green-600">{stats.low}</p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex space-x-2">
              {["All", "High", "Medium", "Low"].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption as typeof filter)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === filterOption
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {filterOption}
                </button>
              ))}
            </div>
          </div>

          {/* Predictions List */}
          <div className="space-y-4">
            {filteredPredictions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Predictions in This Filter
                </h3>
                <p className="text-gray-500">
                  Try selecting a different risk level filter
                </p>
              </div>
            ) : (
              filteredPredictions.map((prediction) => (
                <div
                  key={prediction._id}
                  className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 ${
                    prediction.riskLevel === "high"
                      ? "border-red-500"
                      : prediction.riskLevel === "medium"
                      ? "border-yellow-500"
                      : "border-green-500"
                  }`}
                >
                  {/* Prediction Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-4xl">{getRiskIcon(prediction.riskLevel)}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-bold text-gray-800">
                            {prediction.riskLevel.charAt(0).toUpperCase() + prediction.riskLevel.slice(1)} Risk Alert
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(
                              prediction.riskLevel
                            )}`}
                          >
                            {prediction.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(prediction.predictedDate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedPrediction(
                          selectedPrediction?._id === prediction._id ? null : prediction
                        )
                      }
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selectedPrediction?._id === prediction._id
                        ? "Hide Details ▲"
                        : "View Details ▼"}
                    </button>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-600">Prediction Type</p>
                      <p className="text-sm font-bold text-gray-800">
                        {prediction.predictionType || "Disease Outbreak"}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs text-blue-600">Location</p>
                      <p className="text-sm font-bold text-blue-700 truncate">
                        {prediction.location || "N/A"}
                      </p>
                    </div>
                    {prediction.confidence && (
                      <div className="bg-purple-50 rounded p-3">
                        <p className="text-xs text-purple-600">Confidence</p>
                        <p className="text-lg font-bold text-purple-700">
                          {prediction.confidence.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {prediction.modelVersion && (
                      <div className="bg-green-50 rounded p-3">
                        <p className="text-xs text-green-600">Model Version</p>
                        <p className="text-sm font-bold text-green-700">
                          {prediction.modelVersion}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded p-4 mb-4">
                    <p className="text-gray-700 leading-relaxed">{prediction.details}</p>
                  </div>

                  {/* Recommendations */}
                  {prediction.recommendations && prediction.recommendations.length > 0 && (
                    <div className="bg-blue-50 rounded p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                        <span className="mr-2">💡</span>
                        Recommendations
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                        {prediction.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {selectedPrediction?._id === prediction._id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">📍</span>
                        Location Details
                      </h4>
                      {prediction.lat && prediction.lng ? (
                        <div className="space-y-4">
                          <div className="bg-gray-50 rounded p-4">
                            <p className="text-sm text-gray-700 mb-3">
                              <strong>Coordinates:</strong> {prediction.lat.toFixed(6)}, {prediction.lng.toFixed(6)}
                            </p>
                            
                            {/* Google Maps Embed */}
                            <div className="rounded-lg overflow-hidden border-2 border-gray-300 mb-3" style={{ height: '300px' }}>
                              <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://www.google.com/maps?q=${prediction.lat},${prediction.lng}&output=embed&z=15`}
                                allowFullScreen
                                title="Location Map"
                              ></iframe>
                            </div>

                            {/* Open in Google Maps Button */}
                            <a
                              href={`https://www.google.com/maps?q=${prediction.lat},${prediction.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm"
                            >
                              <span className="mr-2">🗺️</span>
                              Open in Google Maps
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded p-4">
                          <p className="text-sm text-gray-700 mb-3">
                            <strong>Location:</strong> {prediction.location || "No specific location data available"}
                          </p>
                          {prediction.location && (
                            <a
                              href={`https://www.google.com/maps/search/${encodeURIComponent(prediction.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm"
                            >
                              <span className="mr-2">🗺️</span>
                              Search on Google Maps
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-500">
        <span>🔄 Auto-refreshing every 30 seconds</span>
      </div>
    </div>
  );
};
