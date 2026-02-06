import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from "./LoadingSpinner";

interface TrendData {
  timestamp: string;
  value: number;
  label?: string;
}

interface Point {
  x: number;
  y: number;
  value: number;
}

interface TrendChartProps {
  title: string;
  data: TrendData[];
  metric: string;
  unit: string;
  loading?: boolean;
  error?: string;
}

const SimpleLineChart: React.FC<TrendChartProps> = ({
  title,
  data,
  metric,
  unit,
  loading = false,
  error = "",
}) => {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-yellow-700">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-gray-500">
        No data available
      </div>
    );
  }

  // Calculate min and max for scaling
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Generate SVG path for line chart
  const chartHeight = 150;
  const chartWidth = Math.max(300, data.length * 30);
  const padding = 30;

  const points: Point[] = data.map((d, idx) => {
    const x = padding + (idx / Math.max(data.length - 1, 1)) * (chartWidth - padding * 2);
    const y = chartHeight - ((d.value - minVal) / range) * (chartHeight - padding) - padding;
    return { x, y, value: d.value };
  });

  // Get color based on trend
  const getColor = () => {
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    if (metric.toLowerCase().includes("case") || metric.toLowerCase().includes("count")) {
      // For case counts, red is bad
      return avgValue > range / 2 ? "#ef4444" : "#10b981";
    }
    // For water quality metrics, depends on the metric
    return "#3b82f6";
  };

  const color = getColor();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>

      <div className="overflow-x-auto">
        <svg
          width={Math.min(chartWidth + 40, 600)}
          height={chartHeight + 40}
          className="mx-auto"
        >
          {/* Grid lines */}
          <g stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <line
                key={idx}
                x1={padding}
                y1={chartHeight - ratio * (chartHeight - padding) - padding}
                x2={chartWidth}
                y2={chartHeight - ratio * (chartHeight - padding) - padding}
              />
            ))}
          </g>

          {/* Y-axis */}
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight}
            stroke="#d1d5db"
            strokeWidth="2"
          />

          {/* X-axis */}
          <line
            x1={padding}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#d1d5db"
            strokeWidth="2"
          />

          {/* Line chart */}
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={color}
              opacity="0.8"
            />
          ))}

          {/* Y-axis labels */}
          <text x={padding - 10} y={padding + 5} fontSize="12" fill="#666" textAnchor="end">
            {maxVal.toFixed(0)}
          </text>
          <text x={padding - 10} y={chartHeight + 5} fontSize="12" fill="#666" textAnchor="end">
            {minVal.toFixed(0)}
          </text>

          {/* X-axis labels (first and last) */}
          {points.length > 0 && (
            <>
              <text
                x={points[0].x}
                y={chartHeight + 20}
                fontSize="12"
                fill="#666"
                textAnchor="middle"
              >
                {data[0].label || "Start"}
              </text>
              <text
                x={points[points.length - 1].x}
                y={chartHeight + 20}
                fontSize="12"
                fill="#666"
                textAnchor="middle"
              >
                {data[data.length - 1].label || "Now"}
              </text>
            </>
          )}

          {/* Unit label */}
          <text x={chartWidth - 10} y={15} fontSize="12" fill="#666" textAnchor="end">
            {unit}
          </text>
        </svg>
      </div>

      {/* Statistics */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded p-2 text-center">
          <p className="text-xs text-gray-600">Latest</p>
          <p className="font-bold text-gray-800">
            {values[values.length - 1].toFixed(1)}
          </p>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <p className="text-xs text-gray-600">Average</p>
          <p className="font-bold text-gray-800">
            {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}
          </p>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <p className="text-xs text-gray-600">Peak</p>
          <p className="font-bold text-gray-800">{maxVal.toFixed(1)}</p>
        </div>
      </div>
    </div>
  );
};

interface TrendsProps {
  token?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const TrendsDashboard: React.FC<TrendsProps> = ({
  token,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [caseData, setCaseData] = useState<TrendData[]>([]);
  const [waterData, setWaterData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = "http://127.0.0.1:5000";

  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch predictions for water quality trends
      const predResponse = await fetch(`${API_URL}/api/predictions?limit=20`, {
        headers,
      });

      if (predResponse.ok) {
        const predData = await predResponse.json();
        const predictions = predData.predictions || [];

        // Process water quality trend (average confidence as proxy for water quality)
        const waterTrend = predictions.map((pred: { predictedAt: string; waterQuality?: { pH?: number; }; }, idx: number) => ({
          timestamp: pred.predictedAt,
          value: pred.waterQuality?.pH || 7.0,
          label: idx === predictions.length - 1 ? "Now" : undefined,
        }));

        setWaterData(waterTrend.reverse());

        // Process case count trend (group by day)
        const casesByDay = new Map<string, number>();
        predictions.forEach((pred: { predictedAt: string; }) => {
          const date = new Date(pred.predictedAt).toLocaleDateString();
          casesByDay.set(date, (casesByDay.get(date) || 0) + 1);
        });

        const caseTrend = Array.from(casesByDay.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([date, count]) => ({
            timestamp: date,
            value: count,
            label: date,
          }));

        setCaseData(caseTrend);
        setError("");
      } else {
        setError("Failed to fetch trend data");
      }
    } catch (err) {
      setError("Error connecting to server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    fetchTrends();

    if (autoRefresh) {
      const interval = setInterval(fetchTrends, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTrends]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">📊 Trends</h2>
        <button
          onClick={fetchTrends}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleLineChart
          title="Recent Predictions Trend"
          data={caseData}
          metric="Prediction Count"
          unit="predictions"
          loading={loading}
          error={error}
        />

        <SimpleLineChart
          title="Water pH Trend"
          data={waterData}
          metric="pH Level"
          unit="pH"
          loading={loading}
          error={error}
        />
      </div>

      <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-blue-700 text-sm">
          <strong>ℹ️ Trend Info:</strong> These charts show recent patterns in predictions and water quality metrics. Charts update every 30 seconds.
        </p>
      </div>
    </div>
  );
};

export default TrendsDashboard;
