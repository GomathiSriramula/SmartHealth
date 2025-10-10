import { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import Alert from "./Alert";
import StatsCard from "./StatsCard";
import Navigation from "./Navigation";
import { CSVUpload } from "./CSVUpload";
import { PredictionsDashboard } from "./PredictionsDashboard";

interface Report {
  _id?: string;
  id?: number;
  patient_age: number;
  sex: string;
  lat: number;
  lng: number;
  symptoms: string[];
  reporter_type: string;
  reporter_id: string;
  reported_at: string;
  created_at: string;
}

interface DashboardProps {
  onBackToLanding: () => void;
  token: string;
  username: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  onBackToLanding,
  token,
  username,
  onLogout,
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [formData, setFormData] = useState({
    reporter_type: "",
    patient_age: "",
    sex: "",
    lat: "",
    lng: "",
    symptoms: [] as string[],
    reported_at: "",
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = "http://127.0.0.1:5000";

  // Fetch reports from backend
  const fetchReports = async (showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const headers: HeadersInit = {};
      // Only add Authorization header if token exists
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Only fetch reports for the current user, with limit of 10,000
      const url = `${API_URL}/reports?reporter_id=${encodeURIComponent(username)}&limit=10000`;
      const res = await fetch(url, { 
        headers,
        cache: 'no-cache' // Force fresh data, no caching
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      console.log('📊 Reports fetched for user', username, ':', data.length, 'reports'); // Debug log
      setReports(data);
    } catch (err) {
      console.error('❌ Error fetching reports:', err);
      setReports([]);
      setMessage("❌ Failed to load reports.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchReports();
  }, [username]);

  // Debug: Log when reports state changes
  useEffect(() => {
    console.log('📊 Reports state updated. Total count:', reports.length);
  }, [reports]);

  // Submit new report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(""); // Clear any previous messages
    
    try {
      const payload = {
        ...formData,
        reporter_id: username, // 🔑 Always use logged-in username as reporter_id
        patient_age: Number(formData.patient_age),
        lat: Number(formData.lat),
        lng: Number(formData.lng),
      };

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "x-api-key": "secret-key", // Always include API key as fallback
      };
      
      // Add authorization header if token exists
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log('📤 Submitting report for user:', username, payload); // Debug log

      const res = await fetch(`${API_URL}/reports`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('❌ Server error:', res.status, errorData);
        throw new Error(`Error: ${res.status}`);
      }

      const savedReport = await res.json();
      console.log('✅ Report submitted successfully:', savedReport);

      // Show success message
      setMessage("✅ Report submitted successfully! Refreshing data...");
      
      // Reset form
      setFormData({
        reporter_type: "",
        patient_age: "",
        sex: "",
        lat: "",
        lng: "",
        symptoms: [],
        reported_at: "",
      });
      
      // Wait a brief moment for backend to process, then fetch updated reports
      // Don't show loading spinner to avoid UI flicker
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchReports(false);
      
      console.log('🔄 Dashboard data refreshed. New total:', reports.length + 1);
      
      // Update success message
      setMessage("✅ Report submitted successfully! Dashboard updated.");
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => setMessage(""), 5000);
      
    } catch (err) {
      console.error('❌ Submission error:', err);
      setMessage("❌ Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSymptomChange = (symptom: string) => {
    const newSymptoms = formData.symptoms.includes(symptom)
      ? formData.symptoms.filter((s) => s !== symptom)
      : [...formData.symptoms, symptom];
    setFormData({ ...formData, symptoms: newSymptoms });
  };

  const symptomsList = [
    "Diarrhea",
    "Vomiting",
    "Nausea",
    "Abdominal Pain",
    "Fever",
    "Dehydration",
    "Headache",
    "Fatigue",
    "Muscle Cramps",
    "Blood in Stool",
    "Loss of Appetite",
  ];

  // Calculate stats
  const totalReports = reports.length;
  const criticalCases = reports.filter(
    (r: Report) => (r.symptoms ? r.symptoms.length : 0) >= 3
  ).length;
  const todayReports = reports.filter((r: Report) => {
    try {
      return (
        new Date(r.created_at).toDateString() === new Date().toDateString()
      );
    } catch {
      return false;
    }
  }).length;

  const TabButton = ({
    id,
    label,
    icon,
  }: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === id
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Navigation
        onBackToLanding={onBackToLanding}
        username={username}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white h-screen shadow-sm">
          <div className="p-6 space-y-2">
            <TabButton
              id="overview"
              label="Overview"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="reports"
              label="Reports"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="submit"
              label="Submit Report"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="alerts"
              label="Alerts"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="analytics"
              label="Analytics"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="csv-upload"
              label="CSV Upload"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  ></path>
                </svg>
              }
            />
            <TabButton
              id="predictions"
              label="ML Predictions"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  ></path>
                </svg>
              }
            />
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Health Monitoring Overview
                  </h1>
                  <p className="text-gray-600">
                    Real-time surveillance for water-borne disease prevention
                  </p>
                </div>
                <button
                  onClick={() => fetchReports(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    ></path>
                  </svg>
                  <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Reports"
                  value={totalReports}
                  change={12}
                  color="blue"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      ></path>
                    </svg>
                  }
                />

                <StatsCard
                  title="Critical Cases"
                  value={criticalCases}
                  change={-5}
                  color="red"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  }
                />

                <StatsCard
                  title="Today's Reports"
                  value={todayReports}
                  change={8}
                  color="green"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1h3z"
                      ></path>
                    </svg>
                  }
                />

                <StatsCard
                  title="Response Time"
                  value="<2min"
                  change={15}
                  color="purple"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  }
                />
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Recent Reports
                  </h2>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <LoadingSpinner size="lg" />
                      <p className="text-gray-500 mt-4">Loading reports...</p>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                      </svg>
                      <p>No reports available</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reports.slice(0, 5).map((report: Report, index: number) => (
                        <div
                          key={report._id || report.id || `report-${index}`}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                (report.symptoms || []).length >= 3
                                  ? "bg-red-400"
                                  : "bg-yellow-400"
                              }`}
                            ></div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {report.sex}, {report.patient_age} years
                              </p>
                              <p className="text-sm text-gray-600">
                                {report.symptoms.join(", ")} •{" "}
                                {report.reporter_type}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {new Date(report.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(report.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Health Reports
                  </h1>
                  <p className="text-gray-600">
                    All submitted health surveillance reports
                  </p>
                </div>
                <button
                  onClick={() => fetchReports(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left p-4 font-medium text-gray-900">
                          Patient
                        </th>
                        <th className="text-left p-4 font-medium text-gray-900">
                          Symptoms
                        </th>
                        <th className="text-left p-4 font-medium text-gray-900">
                          Reporter
                        </th>
                        <th className="text-left p-4 font-medium text-gray-900">
                          Location
                        </th>
                        <th className="text-left p-4 font-medium text-gray-900">
                          Date
                        </th>
                        <th className="text-left p-4 font-medium text-gray-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="text-center p-8">
                            <div className="flex flex-col items-center">
                              <LoadingSpinner size="lg" />
                              <p className="text-gray-500 mt-4">
                                Loading reports...
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : reports.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center p-8 text-gray-500"
                          >
                            No reports found
                          </td>
                        </tr>
                      ) : (
                        reports.map((report: Report, index: number) => (
                          <tr
                            key={report._id || report.id || `report-${index}`}
                            className="border-b border-gray-50 hover:bg-gray-50"
                          >
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {report.sex}, {report.patient_age}y
                                </p>
                                <p className="text-sm text-gray-500">
                                  ID: {report._id || report.id}
                                </p>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {(report.symptoms || [])
                                  .slice(0, 3)
                                  .map((symptom: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                    >
                                      {symptom}
                                    </span>
                                  ))}
                                {(report.symptoms || []).length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    +{(report.symptoms || []).length - 3} more
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {report.reporter_type}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {report.reporter_id}
                                </p>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-gray-600">
                                {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-gray-600">
                                {new Date(
                                  report.created_at
                                ).toLocaleDateString()}
                              </p>
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  report.symptoms.length >= 3
                                    ? "bg-red-100 text-red-800"
                                    : report.symptoms.length >= 2
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {report.symptoms.length >= 3
                                  ? "Critical"
                                  : report.symptoms.length >= 2
                                  ? "Moderate"
                                  : "Mild"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Submit Report Tab */}
          {activeTab === "submit" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Submit Health Report
                </h1>
                <p className="text-gray-600">
                  Report suspected water-borne disease cases
                </p>
              </div>

              {message && (
                <Alert
                  type={message.includes("✅") ? "success" : "error"}
                  message={message.replace(/[✅❌]/g, "").trim()}
                  onClose={() => setMessage("")}
                />
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reporter Type
                      </label>
                      <select
                        value={formData.reporter_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reporter_type: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Reporter Type</option>
                        <option value="ASHA Worker">ASHA Worker</option>
                        <option value="Community Volunteer">
                          Community Volunteer
                        </option>
                        <option value="Health Official">Health Official</option>
                        <option value="Clinic Staff">Clinic Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reporter ID (Your Username)
                      </label>
                      <input
                        type="text"
                        value={username}
                        readOnly
                        disabled
                        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        placeholder="Auto-filled with your username"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This is automatically set to your username
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Patient Age
                      </label>
                      <input
                        type="number"
                        value={formData.patient_age}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            patient_age: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter age"
                        required
                        min="0"
                        max="120"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sex
                      </label>
                      <select
                        value={formData.sex}
                        onChange={(e) =>
                          setFormData({ ...formData, sex: e.target.value })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Sex</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lat}
                        onChange={(e) =>
                          setFormData({ ...formData, lat: e.target.value })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter latitude"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lng}
                        onChange={(e) =>
                          setFormData({ ...formData, lng: e.target.value })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter longitude"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reported Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.reported_at}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reported_at: e.target.value,
                        })
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Symptoms (Select all that apply)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {symptomsList.map((symptom) => (
                        <label
                          key={symptom}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.symptoms.includes(symptom)}
                            onChange={() => handleSymptomChange(symptom)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {symptom}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          reporter_type: "",
                          patient_age: "",
                          sex: "",
                          lat: "",
                          lng: "",
                          symptoms: [],
                          reported_at: "",
                        })
                      }
                      disabled={submitting}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {submitting && (
                        <LoadingSpinner size="sm" />
                      )}
                      <span>{submitting ? "Submitting..." : "Submit Report"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === "alerts" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Active Alerts
                </h1>
                <p className="text-gray-600">
                  Real-time alerts for potential disease outbreaks
                </p>
              </div>

              <div className="grid gap-4">
                {/* Critical Alert */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <svg
                        className="w-6 h-6 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        ></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-800">
                        Critical: Cholera Outbreak Risk
                      </h3>
                      <p className="text-red-700 mb-2">
                        Multiple cases with severe symptoms detected in Ward 15
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-red-600">
                        <span>Affected: 12 cases</span>
                        <span>•</span>
                        <span>Risk Level: High</span>
                        <span>•</span>
                        <span>2 hours ago</span>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      Action Required
                    </button>
                  </div>
                </div>

                {/* Warning Alert */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <svg
                        className="w-6 h-6 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-yellow-800">
                        Warning: Water Quality Drop
                      </h3>
                      <p className="text-yellow-700 mb-2">
                        Contamination levels elevated in Sector B water supply
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-yellow-600">
                        <span>pH: 6.2</span>
                        <span>•</span>
                        <span>Turbidity: High</span>
                        <span>•</span>
                        <span>4 hours ago</span>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                      Investigate
                    </button>
                  </div>
                </div>

                {/* Info Alert */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-800">
                        Info: Preventive Campaign Scheduled
                      </h3>
                      <p className="text-blue-700 mb-2">
                        Health awareness drive planned for high-risk areas
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-blue-600">
                        <span>Date: Tomorrow</span>
                        <span>•</span>
                        <span>Coverage: 5 villages</span>
                        <span>•</span>
                        <span>1 day ago</span>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Analytics & Insights
                </h1>
                <p className="text-gray-600">
                  Data-driven insights for disease prevention and resource
                  allocation
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Trend Analysis */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Case Trends
                  </h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center text-gray-500">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        ></path>
                      </svg>
                      <p>Chart visualization would appear here</p>
                      <p className="text-sm">
                        (Requires chart library integration)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Geographic Distribution */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Geographic Hotspots
                  </h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center text-gray-500">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        ></path>
                      </svg>
                      <p>Map visualization would appear here</p>
                      <p className="text-sm">
                        (Requires mapping library integration)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    Most Common Symptoms
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Diarrhea</span>
                      <span className="font-medium">78%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fever</span>
                      <span className="font-medium">65%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vomiting</span>
                      <span className="font-medium">52%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    Age Distribution
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">0-18 years</span>
                      <span className="font-medium">45%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">19-60 years</span>
                      <span className="font-medium">40%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">60+ years</span>
                      <span className="font-medium">15%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    Response Efficiency
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Response Time</span>
                      <span className="font-medium text-green-600">1.8min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cases Resolved</span>
                      <span className="font-medium text-blue-600">89%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prevention Rate</span>
                      <span className="font-medium text-purple-600">94%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload Tab */}
          {activeTab === "csv-upload" && (
            <CSVUpload 
              token={token} 
              onUploadSuccess={() => fetchReports(false)}
            />
          )}

          {/* ML Predictions Tab */}
          {activeTab === "predictions" && (
            <PredictionsDashboard token={token} />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
