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
  userRole: string;
}

interface AnalyticsData {
  summary: {
    totalPredictions: number;
    recentPredictions: number;
    totalCaseReports: number;
    recentCaseReports: number;
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
  symptomsDistribution: Array<{
    symptom: string;
    count: number;
  }>;
  demographics: {
    ageGroups: Record<string, number>;
    genderDistribution: Record<string, number>;
  };
  reporterTypes: Record<string, number>;
  timeSeriesData: Array<{
    date: string;
    high: number;
    medium: number;
    low: number;
    total: number;
    caseReports: number;
  }>;
  topLocations: Array<{
    location: string;
    count: number;
  }>;
  geoClusters: Array<{
    lat: number;
    lng: number;
    location: string;
    symptoms: string[];
  }>;
  recentHighRisk: Array<{
    id: string;
    type: string;
    location: string;
    confidence: number;
    date: string;
    details: string;
  }>;
  recentCaseReportsList: Array<{
    id: string;
    reporter_type: string;
    reporter_id: string;
    patient_age: number;
    sex: string;
    location: string;
    lat: number;
    lng: number;
    symptoms: string[];
    reported_at: string;
    created_at: string;
  }>;
  confidenceDistribution: Record<string, number>;
  modelVersions: Record<string, number>;
  districtRiskSummary?: Array<{
    location: string;
    riskLevel: 'Critical' | 'Moderate';
  }>;
}

const COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#ec4899',
};

const Analytics: React.FC<AnalyticsProps> = ({ token, userRole }) => {
  const isRestrictedUser = userRole === 'USER';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedView, setSelectedView] = useState<'all' | 'symptoms' | 'demographics' | 'locations'>('all');

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
      fetchAnalytics(false);
    }, 30000);

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

  const showSymptoms = selectedView === 'all' || selectedView === 'symptoms';
  const showDemographics = selectedView === 'all' || selectedView === 'demographics';
  const showLocations = selectedView === 'all' || selectedView === 'locations';

  // District-level risk list used for the restricted (USER) view of the
  // "Recent" sections below. Prefer the server-computed districtRiskSummary
  // (it's the authoritative, sanitized signal); fall back to deriving it
  // client-side from recentHighRisk/topLocations if an older backend hasn't
  // been updated yet.
  const districtRiskList = data.districtRiskSummary && data.districtRiskSummary.length > 0
    ? data.districtRiskSummary
    : (() => {
      const highRiskDistricts = new Set(
        (data.recentHighRisk || []).map((alert) => alert.location)
      );
      return (data.topLocations || []).map((loc) => ({
        location: loc.location,
        riskLevel: (highRiskDistricts.has(loc.location) ? 'Critical' : 'Moderate') as 'Critical' | 'Moderate',
      }));
    })();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Real-time insights from admin submissions and risk analysis
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${autoRefresh
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
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Time range selector */}
        <div className="mt-4 flex items-center space-x-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Time Range:</span>
          {['7', '14', '30', '60', '90'].map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
            >
              {range} days
            </button>
          ))}
        </div>

        {/* View selector */}
        <div className="mt-4 flex items-center space-x-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">View:</span>
          {[
            { id: 'all', label: '📊 All Charts' },
            { id: 'symptoms', label: '🦠 Symptoms Analysis' },
            { id: 'demographics', label: '👥 Demographics' },
            { id: 'locations', label: '🗺️ Geographic View' }
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id as 'all' | 'symptoms' | 'demographics' | 'locations')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${selectedView === view.id
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
            >
              {view.label}
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Case Reports</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {(data.summary.totalCaseReports || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          {!isRestrictedUser && (
            <p className="text-xs text-gray-500 mt-2">Submitted by admins</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recent Reports</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {(data.summary.recentCaseReports || 0).toLocaleString()}
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Risk Assessments</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {(data.summary.totalPredictions || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Avg confidence: {(data.summary.averageConfidence || 0).toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Cases</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {data.riskDistribution.high || 0}
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

      {/* Time Series Chart - Always show */}
      {selectedView === 'all' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 Activity Over Time</h2>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="caseReports"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
                name="Case Reports"
              />
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
      )}

      {/* Charts Grid */}
      {showSymptoms && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Distribution Pie Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Risk Level Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

          {/* Top Symptoms Bar Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🦠 Most Common Symptoms</h2>
            {data.symptomsDistribution && data.symptomsDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.symptomsDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symptom" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.accent} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No symptom data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demographics Grid */}
      {showDemographics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Age Groups Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👶 Age Distribution</h2>
            {data.demographics && data.demographics.ageGroups ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(data.demographics.ageGroups).map(([age, count]) => ({ age, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No age data available</p>
              </div>
            )}
          </div>

          {/* Gender Distribution Pie Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👫 Gender Distribution</h2>
            {data.demographics && data.demographics.genderDistribution ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(data.demographics.genderDistribution).map(([name, value]) => ({
                      name: name === 'M' ? 'Male' : name === 'F' ? 'Female' : 'Other',
                      value
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={(entry: any) =>
                      entry.value > 0 ? `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)` : null
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                    <Cell fill="#8b5cf6" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No gender data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Grid */}
      {showLocations && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Locations */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📍 Top Affected Locations</h2>
            {data.topLocations.length > 0 ? (
              <div className="space-y-3">
                {data.topLocations.map((location, index) => (
                  <div key={index} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors">
                    <div className="flex items-center space-x-3">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
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

          {/* Reporter Types */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👨‍⚕️ Report Sources</h2>
            {data.reporterTypes && Object.keys(data.reporterTypes).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={Object.entries(data.reporterTypes).map(([type, count]) => ({ type, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.secondary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-500">
                <p>No reporter data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* District Risk Status — shown only for restricted (USER) accounts */}
      {isRestrictedUser && districtRiskList.length > 0 && selectedView === 'all' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 District Risk Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {districtRiskList.map((district, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border ${district.riskLevel === 'Critical'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                  }`}
              >
                <span className="font-medium text-gray-900">{district.location}</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${district.riskLevel === 'Critical'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                    }`}
                >
                  {district.riskLevel === 'Critical' ? '🔴 Critical' : '🟡 Moderate'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;