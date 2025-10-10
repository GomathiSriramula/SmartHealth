import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface AnalyticsProps {
  token: string;
}

interface AnalyticsData {
  summary: {
    totalPredictions: number;
    recentPredictions: number;
    averageConfidence: number;
    timeRange: string;
    lastUpdated: string;
  };
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  predictionTypes: Record<string, number>;
  timeSeriesData: Array<{
    date: string;
    high: number;
    medium: number;
    low: number;
    total: number;
  }>;
  topLocations: Array<{
    location: string;
    count: number;
  }>;
  recentHighRisk: Array<{
    id: string;
    type: string;
    location: string;
    confidence: number;
    date: string;
    details: string;
  }>;
  confidenceDistribution: Record<string, number>;
  modelVersions: Record<string, number>;
}

const COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#ec4899',
};

const Analytics: React.FC<AnalyticsProps> = ({ token }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const API_URL = 'http://localhost:5000';

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/analytics?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const analyticsData = await response.json();
      setData(analyticsData);
      setLastRefresh(new Date());
      console.log('📊 Analytics data loaded:', analyticsData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [token, timeRange, API_URL]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing analytics...');
      fetchAnalytics(false); // Don't show loading spinner on auto-refresh
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAnalytics]);

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchAnalytics(true);
  };

  const handleTimeRangeChange = (newRange: string) => {
    setTimeRange(newRange);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        No analytics data available
      </div>
    );
  }

  const riskChartData = [
    { name: 'High Risk', value: data.riskDistribution.high, color: COLORS.high },
    { name: 'Medium Risk', value: data.riskDistribution.medium, color: COLORS.medium },
    { name: 'Low Risk', value: data.riskDistribution.low, color: COLORS.low },
  ];

  const predictionTypesData = Object.entries(data.predictionTypes).map(([type, count]) => ({
    type: type.length > 25 ? type.substring(0, 25) + '...' : type,
    count,
  }));

  const confidenceData = Object.entries(data.confidenceDistribution).map(([range, count]) => ({
    range,
    count,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Real-time insights and ML prediction analytics
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
            </button>

            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Analytics</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Time range selector */}
        <div className="mt-4 flex items-center space-x-2">
          <span className="text-sm text-gray-600">Time Range:</span>
          {['7', '14', '30', '60', '90'].map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {range} days
            </button>
          ))}
        </div>

        {/* Last updated */}
        <p className="text-xs text-gray-500 mt-2">
          Last updated: {lastRefresh.toLocaleTimeString()} • 
          {autoRefresh && ' Auto-refreshing every 30 seconds'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Predictions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.summary.totalPredictions.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recent Predictions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.summary.recentPredictions.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{data.summary.timeRange}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Confidence</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.summary.averageConfidence.toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Model accuracy</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Cases</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {data.riskDistribution.high}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Requires attention</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Risk Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Level Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => 
                  `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {riskChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Prediction Types Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prediction Types</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={predictionTypesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Predictions Over Time</h2>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="high" 
              stackId="1"
              stroke={COLORS.high} 
              fill={COLORS.high} 
              name="High Risk"
            />
            <Area 
              type="monotone" 
              dataKey="medium" 
              stackId="1"
              stroke={COLORS.medium} 
              fill={COLORS.medium}
              name="Medium Risk"
            />
            <Area 
              type="monotone" 
              dataKey="low" 
              stackId="1"
              stroke={COLORS.low} 
              fill={COLORS.low}
              name="Low Risk"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Locations */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Affected Locations</h2>
          {data.topLocations.length > 0 ? (
            <div className="space-y-3">
              {data.topLocations.map((location, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{location.location}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{location.count} cases</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No location data available</p>
          )}
        </div>

        {/* Confidence Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Confidence Score Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={confidenceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.secondary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent High Risk Alerts */}
      {data.recentHighRisk.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🚨 Recent High-Risk Alerts</h2>
          <div className="space-y-4">
            {data.recentHighRisk.map((alert) => (
              <div key={alert.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900">{alert.type}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                        {alert.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{alert.details.substring(0, 150)}...</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>📍 {alert.location}</span>
                      <span>📅 {new Date(alert.date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
