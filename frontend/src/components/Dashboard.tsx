import { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import Alert from "./Alert";
import StatsCard from "./StatsCard";
import Navigation from "./Navigation";
import { CSVUpload } from "./CSVUpload";
import Analytics from "./Analytics";
import OutbreakMap from "./OutbreakMap";

import AdminOperators from "./AdminOperators";
import HealthAdvisory from "./HealthAdvisory";

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
  location?: string;
  village_area?: string;
  severity?: string;
  remarks?: string;
}

interface DashboardProps {
  onBackToLanding: () => void;
  token: string;
  username: string;
  userRole: string;
  onLogout: () => void;
}

interface AlertData {
  _id: string;
  location: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  notificationSent: boolean;
}

// Decode the district (operator's assigned location) from the JWT issued at login.
// The backend embeds `locations` in the token payload at sign-in (see backend2/utils/auth.js).
function getDistrictFromToken(jwtToken: string): string {
  try {
    const payloadSegment = jwtToken.split(".")[1];
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(decoded);
    const locations = payload.locations;
    return Array.isArray(locations) && locations.length > 0 ? locations[0] : "";
  } catch (e) {
    console.error("Failed to decode district from token:", e);
    return "";
  }
}

// Format a Date as a value usable by a datetime-local input (YYYY-MM-DDTHH:mm)
function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const Dashboard: React.FC<DashboardProps> = ({
  onBackToLanding,
  token,
  username,
  userRole,
  onLogout,
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Report edit/delete state
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editReportForm, setEditReportForm] = useState({
    patient_age: "",
    sex: "",
    symptoms: "",
    severity: "",
    remarks: "",
  });
  const [reportActionInProgress, setReportActionInProgress] = useState<string | null>(null);
  const [reportActionMessage, setReportActionMessage] = useState("");
  const [deleteConfirmReport, setDeleteConfirmReport] = useState<Report | null>(null);

  // Set default tab based on role - public users start on health advisory, the management view starts on the admin workspace
  const [activeTab, setActiveTab] = useState(
    userRole === 'ADMIN' ? 'operators' : userRole === 'USER' ? 'advisory' : 'overview'
  );
  const [formData, setFormData] = useState({
    reporter_type: "",
    patient_age: "",
    sex: "",
    village_area: "",
    severity: "",
    remarks: "",
    symptoms: [] as string[],
  });

  // District is auto-filled (read-only) from the logged-in operator's account
  const [district, setDistrict] = useState("");
  // Reported Date & Time is auto-filled (read-only) with the current date/time
  const [reportedAtDisplay, setReportedAtDisplay] = useState(
    formatDateTimeLocal(new Date())
  );

  useEffect(() => {
    setDistrict(getDistrictFromToken(token));
  }, [token]);

  useEffect(() => {
    setActiveTab(userRole === 'ADMIN' ? 'operators' : userRole === 'USER' ? 'advisory' : 'overview');
  }, [userRole]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertStats, setAlertStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Alerts search/filter state
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("active");
  const [alertDistrictInput, setAlertDistrictInput] = useState<string>("");
  const [alertDistrictFilter, setAlertDistrictFilter] = useState<string>("");

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

      console.log('🔄 Fetching reports (role-scoped by backend):', userRole);

      // Fetch reports scoped by the backend's role-based district filter
      // (see GET /reports in reports.js: OPERATOR -> own district only,
      // ADMIN/USER -> unrestricted). This previously ALSO filtered by
      // reporter_id=username, which silently limited every stat on this
      // dashboard (Total Reports, Critical Cases, Today's Reports, Severity
      // Breakdown) to only the reports the logged-in user personally
      // submitted -- not all reports actually visible to their role.
      const url = `${API_URL}/reports?limit=10000`;
      const res = await fetch(url, {
        headers,
        cache: 'no-cache' // Force fresh data, no caching
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      // Defensive newest-first sort on top of the backend's own sort (see
      // GET /reports in reports.js). The Overview's "Recent Reports" card
      // takes the first 5 entries and assumes newest-first ordering, so
      // this guards against that assumption silently breaking again.
      const sortedData = [...data].sort(
        (a: Report, b: Report) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      console.log('📊 Reports fetched:', sortedData.length, 'reports');
      setReports(sortedData);
      console.log('📊 Reports state updated. Total count:', data.length);
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

  // --- Report edit/delete permissions (mirrors backend rules in reports.js) ---
  // ADMIN: edit + delete any report.
  // OPERATOR: edit ONLY reports in their own assigned district, never delete.
  // USER: neither edit nor delete.
  const canEditReport = (report: Report): boolean => {
    if (userRole === "ADMIN") return true;
    if (userRole === "OPERATOR") {
      const reportDistrict = (report.location || "").trim().toLowerCase();
      const myDistrict = (district || "").trim().toLowerCase();
      return Boolean(myDistrict) && reportDistrict === myDistrict;
    }
    return false;
  };

  const canDeleteReport = (): boolean => userRole === "ADMIN";

  const openEditReport = (report: Report) => {
    setReportActionMessage("");
    setEditingReport(report);
    setEditReportForm({
      patient_age: String(report.patient_age ?? ""),
      sex: report.sex || "",
      symptoms: (report.symptoms || []).join(", "),
      severity: report.severity || "",
      remarks: report.remarks || "",
    });
  };

  const closeEditReport = () => {
    setEditingReport(null);
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    const reportId = editingReport._id || String(editingReport.id);
    setReportActionInProgress(reportId);
    setReportActionMessage("");

    try {
      const res = await fetch(`${API_URL}/reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_age: editReportForm.patient_age,
          sex: editReportForm.sex,
          symptoms: editReportForm.symptoms,
          severity: editReportForm.severity,
          remarks: editReportForm.remarks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Error: ${res.status}`);
      }

      setReportActionMessage("✅ Report updated successfully");
      setEditingReport(null);
      await fetchReports(false);
    } catch (err: any) {
      console.error("❌ Error updating report:", err);
      setReportActionMessage(`❌ ${err.message || "Failed to update report"}`);
    } finally {
      setReportActionInProgress(null);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    const reportId = report._id || String(report.id);
    setReportActionInProgress(reportId);
    setReportActionMessage("");

    try {
      const res = await fetch(`${API_URL}/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Error: ${res.status}`);
      }

      setReportActionMessage("✅ Report deleted successfully");
      setDeleteConfirmReport(null);
      await fetchReports(false);
    } catch (err: any) {
      console.error("❌ Error deleting report:", err);
      setReportActionMessage(`❌ ${err.message || "Failed to delete report"}`);
    } finally {
      setReportActionInProgress(null);
    }
  };

  // Debounce the district search box before it drives a refetch
  useEffect(() => {
    const handle = setTimeout(() => {
      setAlertDistrictFilter(alertDistrictInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [alertDistrictInput]);

  // Fetch alerts from backend
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const params = new URLSearchParams();
      params.set("limit", "50");
      // "all" means don't constrain by status; otherwise pass status through
      if (alertStatusFilter !== "all") {
        params.set("status", alertStatusFilter);
      }
      if (alertDistrictFilter && userRole !== "OPERATOR") {
        params.set("location", alertDistrictFilter);
      }

      const res = await fetch(`${API_URL}/api/alerts?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }

      // Fetch stats — pass the same district filter as the list above so the
      // Active/Total/Resolved cards reflect what's actually being searched
      // for, instead of always showing system-wide totals. Status is
      // intentionally NOT passed through: the three cards ARE the
      // active/resolved breakdown, so filtering by status wouldn't mean
      // anything for them.
      const statsParams = new URLSearchParams();
      if (alertDistrictFilter && userRole !== "OPERATOR") {
        statsParams.set("location", alertDistrictFilter);
      }
      const statsUrl = statsParams.toString()
        ? `${API_URL}/api/alerts/stats/summary?${statsParams.toString()}`
        : `${API_URL}/api/alerts/stats/summary`;
      const statsRes = await fetch(statsUrl, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAlertStats({
          total: statsData.stats?.totalAlerts || 0,
          active: statsData.stats?.activeAlerts || 0,
          resolved: statsData.stats?.resolvedAlerts || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/alerts/${alertId}/resolve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "Manually resolved" }),
      });

      if (res.ok) {
        // Only the "active" view needs the alert stripped out locally —
        // for "resolved" or "all" views the refetch below will reflect
        // the new status correctly.
        if (alertStatusFilter === "active") {
          setAlerts(prev => prev.filter(a => a._id !== alertId));
        }
        fetchAlerts(); // Refresh stats and pick up any server-side changes
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error('Failed to resolve alert:', res.status, errBody);
        setMessage(errBody.message || "⚠️ Failed to resolve alert");
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
      setMessage("🔴 Cannot reach the server while resolving alert");
    } finally {
      setActionInProgress(null);
    }
  };

  // Resend notification
  const resendNotification = async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/alerts/${alertId}/notify`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const result = await res.json();
        setAlerts(prev => prev.map(a => a._id === alertId ? result.alert : a));
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error('Failed to send notification:', res.status, errBody);
        setMessage(errBody.message || "⚠️ Failed to send notification");
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      setMessage("🔴 Cannot reach the server while sending notification");
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleExpandAlert = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  // Load alerts when alerts tab is opened, and whenever filters change
  useEffect(() => {
    if (activeTab === "alerts") {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [activeTab, token, alertStatusFilter, alertDistrictFilter]);

  // Client-side safety net: even if the backend ignores/partially matches the
  // `location` query param, this guarantees the list reflects the district
  // search box (case-insensitive substring match).
  const filteredAlerts = alerts.filter((alert) => {
    if (!alertDistrictFilter) return true;
    return alert.location?.toLowerCase().includes(alertDistrictFilter.toLowerCase());
  });

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
        location: district, // 🔑 Auto-filled from the logged-in operator's account
        reported_at: new Date().toISOString(), // 🔑 Auto-filled with the current date/time
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
        village_area: "",
        severity: "",
        remarks: "",
        symptoms: [],
      });
      setReportedAtDisplay(formatDateTimeLocal(new Date()));

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

  // Map a report's actual clinical severity (set by the reporter, and the
  // same field the backend's real risk engine uses -- see analyzeReportRisk()
  // in reports.js) to a display bucket. "Severe" is folded into "Critical"
  // here because the backend escalates both to HIGH risk identically.
  const severityToBucket = (severity?: string): "Critical" | "Moderate" | "Mild" | null => {
    switch ((severity || "").trim()) {
      case "Critical":
      case "Severe":
        return "Critical";
      case "Moderate":
        return "Moderate";
      case "Mild":
        return "Mild";
      default:
        return null;
    }
  };

  // Legacy fallback (symptom count) only applies to reports created before
  // the `severity` field existed / was left blank. Any report with a real
  // severity value always uses that instead -- it's never overridden by
  // symptom count.
  const getSeverityBucket = (report: Report): "Critical" | "Moderate" | "Mild" => {
    const fromField = severityToBucket(report.severity);
    if (fromField) return fromField;
    const count = report.symptoms ? report.symptoms.length : 0;
    if (count >= 3) return "Critical";
    if (count >= 1) return "Moderate";
    return "Mild";
  };

  // Calculate stats
  const totalReports = reports.length;
  const criticalCases = reports.filter(
    (r: Report) => getSeverityBucket(r) === "Critical"
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

  // Extra insights for the Overview redesign
  const moderateCases = reports.filter(
    (r: Report) => getSeverityBucket(r) === "Moderate"
  ).length;
  const mildCases = reports.filter(
    (r: Report) => getSeverityBucket(r) === "Mild"
  ).length;

  const getSeverity = (report: Report): { label: string; dot: string; badge: string } => {
    const bucket = getSeverityBucket(report);
    if (bucket === "Critical") return { label: "Critical", dot: "bg-red-500", badge: "bg-red-100 text-red-700" };
    if (bucket === "Moderate") return { label: "Moderate", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700" };
    return { label: "Mild", dot: "bg-green-500", badge: "bg-green-100 text-green-700" };
  };

  const topSymptom = (() => {
    const counts: Record<string, number> = {};
    reports.forEach((r: Report) => {
      (r.symptoms || []).forEach((s) => {
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "—";
  })();

  const timeAgo = (dateStr: string): string => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "";
    }
  };

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
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === id
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
            {/* Overview - Management users only */}
            {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
            )}
            {/* Reports - Management users only */}
            {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
            )}
            {/* Submit Report - Management users only */}
            {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
            )}
            {/* Alerts - Management users only */}
            {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
            )}
            <TabButton
              id="map"
              label="Outbreak Map"
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  ></path>
                </svg>
              }
            />
            {/* Health Advisory - Public/community users only */}
            {userRole === 'USER' && (
              <TabButton
                id="advisory"
                label="Health Advisory"
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
                      d="M12 3c-3 4-6 7.5-6 11a6 6 0 0012 0c0-3.5-3-7-6-11z"
                    ></path>
                  </svg>
                }
              />
            )}
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
            {/* CSV Upload - Management users only */}
            {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
            )}
            {userRole === 'ADMIN' && (
              <TabButton
                id="operators"
                label="District Operators"
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
                      d="M17 20h5v-2a4 4 0 00-5-3.874M9 20H4v-2a4 4 0 015-3.874m8-5.126a4 4 0 10-8 0 4 4 0 008 0zM20 8a2 2 0 11-4 0 2 2 0 014 0zM8 8a2 2 0 11-4 0 2 2 0 014 0z"
                    ></path>
                  </svg>
                }
              />
            )}


          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Hero header */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-8 text-white shadow-lg">
                <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10"></div>
                <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full bg-white/10"></div>
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      Health Monitoring Overview
                    </h1>
                    <p className="text-blue-100">
                      Real-time surveillance for water-borne disease prevention
                    </p>
                  </div>
                  <button
                    onClick={() => fetchReports(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
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

              {/* Severity Breakdown + Quick Insights */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Severity Breakdown
                  </h2>
                  {totalReports === 0 ? (
                    <p className="text-sm text-gray-500">No reports yet to break down.</p>
                  ) : (
                    <>
                      <div className="w-full h-3 rounded-full overflow-hidden bg-gray-100 flex">
                        <div
                          className="bg-red-500 h-full"
                          style={{ width: `${(criticalCases / totalReports) * 100}%` }}
                          title={`Critical: ${criticalCases}`}
                        ></div>
                        <div
                          className="bg-yellow-400 h-full"
                          style={{ width: `${(moderateCases / totalReports) * 100}%` }}
                          title={`Moderate: ${moderateCases}`}
                        ></div>
                        <div
                          className="bg-green-500 h-full"
                          style={{ width: `${(mildCases / totalReports) * 100}%` }}
                          title={`Mild: ${mildCases}`}
                        ></div>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-4 text-sm">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                          Critical <span className="text-gray-400">({criticalCases})</span>
                        </span>
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                          Moderate <span className="text-gray-400">({moderateCases})</span>
                        </span>
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                          Mild <span className="text-gray-400">({mildCases})</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Quick Insight
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Most reported symptom</p>
                      <p className="text-base font-medium text-gray-900 mt-1">{topSymptom}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Critical share</p>
                      <p className="text-base font-medium text-gray-900 mt-1">
                        {totalReports > 0 ? `${Math.round((criticalCases / totalReports) * 100)}%` : '0%'} of all reports
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Recent Reports
                  </h2>
                  {reports.length > 0 && (
                    <button
                      onClick={() => setActiveTab("reports")}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all →
                    </button>
                  )}
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
                    <div className="space-y-3">
                      {reports.slice(0, 5).map((report: Report, index: number) => {
                        const severity = getSeverity(report);
                        const visibleSymptoms = (report.symptoms || []).slice(0, 3);
                        const extraSymptoms = (report.symptoms || []).length - visibleSymptoms.length;
                        return (
                          <div
                            key={report._id || report.id || `report-${index}`}
                            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <div className="flex items-center space-x-4 min-w-0">
                              <div
                                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${severity.dot}`}
                              >
                                {report.sex === 'M' ? '♂' : report.sex === 'F' ? '♀' : '•'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-gray-900">
                                    {report.sex}, {report.patient_age} years
                                  </p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severity.badge}`}>
                                    {severity.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  {visibleSymptoms.length > 0 ? (
                                    visibleSymptoms.map((symptom, i) => (
                                      <span
                                        key={i}
                                        className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-600"
                                      >
                                        {symptom}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">No symptoms reported</span>
                                  )}
                                  {extraSymptoms > 0 && (
                                    <span className="text-xs text-gray-400">+{extraSymptoms} more</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{report.reporter_type}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <p className="text-sm text-gray-500">
                                {timeAgo(report.created_at)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(report.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
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

              {reportActionMessage && (
                <Alert
                  type={reportActionMessage.includes("✅") ? "success" : "error"}
                  message={reportActionMessage.replace(/[✅❌]/g, "").trim()}
                  onClose={() => setReportActionMessage("")}
                />
              )}

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
                        <th className="text-left p-4 font-medium text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="text-center p-8">
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
                            colSpan={7}
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
                              <p className="text-sm text-gray-900 font-medium">
                                {report.location || report.village_area || "N/A"}
                              </p>
                              {(typeof report.lat === "number" || typeof report.lng === "number") && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {typeof report.lat === "number" ? report.lat.toFixed(4) : "N/A"}, {typeof report.lng === "number" ? report.lng.toFixed(4) : "N/A"}
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-gray-600">
                                {new Date(
                                  report.created_at
                                ).toLocaleDateString()}
                              </p>
                            </td>
                            <td className="p-4">
                              {(() => {
                                // Reuse the same severity source as the Overview tab
                                // (report.severity, with the legacy symptom-count
                                // fallback) so this table's Status column can never
                                // disagree with what Overview/Recent Reports shows
                                // for the exact same report.
                                const rowSeverity = getSeverity(report);
                                return (
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${rowSeverity.badge}`}
                                  >
                                    {rowSeverity.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {canEditReport(report) && (
                                  <button
                                    onClick={() => openEditReport(report)}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDeleteReport() && (
                                  <button
                                    onClick={() => setDeleteConfirmReport(report)}
                                    disabled={reportActionInProgress === (report._id || String(report.id))}
                                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                                  >
                                    {reportActionInProgress === (report._id || String(report.id)) ? "..." : "Delete"}
                                  </button>
                                )}
                                {!canEditReport(report) && !canDeleteReport() && (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Report Modal */}
              {editingReport && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Edit Report
                      </h2>
                      <button
                        onClick={closeEditReport}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleUpdateReport} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Patient Age
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editReportForm.patient_age}
                            onChange={(e) =>
                              setEditReportForm({ ...editReportForm, patient_age: e.target.value })
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sex
                          </label>
                          <select
                            value={editReportForm.sex}
                            onChange={(e) =>
                              setEditReportForm({ ...editReportForm, sex: e.target.value })
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          >
                            <option value="">Select</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="O">Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Symptoms (comma separated)
                        </label>
                        <input
                          type="text"
                          value={editReportForm.symptoms}
                          onChange={(e) =>
                            setEditReportForm({ ...editReportForm, symptoms: e.target.value })
                          }
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="fever, diarrhea, vomiting"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Severity
                        </label>
                        <select
                          value={editReportForm.severity}
                          onChange={(e) =>
                            setEditReportForm({ ...editReportForm, severity: e.target.value })
                          }
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Remarks
                        </label>
                        <textarea
                          value={editReportForm.remarks}
                          onChange={(e) =>
                            setEditReportForm({ ...editReportForm, remarks: e.target.value })
                          }
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      </div>

                      {userRole === "OPERATOR" && (
                        <p className="text-xs text-gray-500">
                          Note: as an operator, you can only edit reports in your assigned
                          district ({district || "—"}), and the report's district cannot be
                          changed.
                        </p>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={closeEditReport}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={
                            reportActionInProgress ===
                            (editingReport._id || String(editingReport.id))
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {reportActionInProgress === (editingReport._id || String(editingReport.id))
                            ? "Saving..."
                            : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {deleteConfirmReport && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      Delete Report?
                    </h2>
                    <p className="text-sm text-gray-600 mb-6">
                      This will permanently delete this report from the database, along
                      with any predictions it triggered. Related active alerts will be
                      marked resolved. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setDeleteConfirmReport(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteReport(deleteConfirmReport)}
                        disabled={
                          reportActionInProgress ===
                          (deleteConfirmReport._id || String(deleteConfirmReport.id))
                        }
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {reportActionInProgress ===
                          (deleteConfirmReport._id || String(deleteConfirmReport.id))
                          ? "Deleting..."
                          : "Delete Permanently"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Report Tab - Management users only */}
          {activeTab === "submit" && (userRole === 'ADMIN' || userRole === 'OPERATOR') && (
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
                        District
                      </label>
                      <input
                        type="text"
                        value={district}
                        readOnly
                        disabled
                        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        placeholder="Auto-filled from your operator account"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This is automatically set to your assigned district
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Village/Area
                      </label>
                      <input
                        type="text"
                        value={formData.village_area}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            village_area: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter village or area name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Severity
                      </label>
                      <select
                        value={formData.severity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            severity: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Severity</option>
                        <option value="Mild">Mild</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Severe">Severe</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reported Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={reportedAtDisplay}
                      readOnly
                      disabled
                      className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This is automatically set to the current date and time
                    </p>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Remarks
                    </label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          remarks: e.target.value,
                        })
                      }
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter any additional notes or observations (optional)"
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          reporter_type: "",
                          patient_age: "",
                          sex: "",
                          village_area: "",
                          severity: "",
                          remarks: "",
                          symptoms: [],
                        });
                        setReportedAtDisplay(formatDateTimeLocal(new Date()));
                      }}
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

          {/* Alerts Tab - Management users only */}
          {activeTab === "alerts" && (userRole === 'ADMIN' || userRole === 'OPERATOR') && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Active Alerts
                </h1>
                <p className="text-gray-600">
                  Real-time alerts for potential disease outbreaks
                </p>
              </div>

              {/* Search / Filter Bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
                {userRole !== "OPERATOR" && (
                  <div className="flex-1">
                    <label htmlFor="alert-district-search" className="block text-sm font-medium text-gray-700 mb-1">
                      Search by district
                    </label>
                    <input
                      id="alert-district-search"
                      type="text"
                      value={alertDistrictInput}
                      onChange={(e) => setAlertDistrictInput(e.target.value)}
                      placeholder="e.g. Hyderabad"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div className="sm:w-48">
                  <label htmlFor="alert-status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="alert-status-filter"
                    value={alertStatusFilter}
                    onChange={(e) => setAlertStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="all">All</option>
                  </select>
                </div>
                {((alertDistrictInput && userRole !== "OPERATOR") || alertStatusFilter !== "active") && (
                  <button
                    onClick={() => {
                      setAlertDistrictInput("");
                      setAlertStatusFilter("active");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="text-sm font-semibold text-red-700">Active</div>
                  <div className="text-3xl font-bold text-red-600">{alertStats.active}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-semibold text-blue-700">Total</div>
                  <div className="text-3xl font-bold text-blue-600">{alertStats.total}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm font-semibold text-green-700">Resolved</div>
                  <div className="text-3xl font-bold text-green-600">{alertStats.resolved}</div>
                </div>
              </div>

              {/* Alerts List */}
              <div className="grid gap-4">
                {alertsLoading ? (
                  <LoadingSpinner />
                ) : filteredAlerts.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                    <p className="text-green-700 font-semibold">
                      {alertDistrictFilter || alertStatusFilter !== "active"
                        ? "✅ No Alerts Match Your Filters"
                        : "✅ No Active Alerts"}
                    </p>
                    <p className="text-green-600">
                      {alertDistrictFilter
                        ? `No ${alertStatusFilter === "all" ? "" : alertStatusFilter + " "}alerts found for "${alertDistrictFilter}"`
                        : "No active disease outbreaks detected"}
                    </p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => {
                    const bgColor = alert.riskLevel === "HIGH" ? "bg-red-50 border-red-200"
                      : alert.riskLevel === "MEDIUM" ? "bg-yellow-50 border-yellow-200"
                        : "bg-green-50 border-green-200";
                    const textColor = alert.riskLevel === "HIGH" ? "text-red-800"
                      : alert.riskLevel === "MEDIUM" ? "text-yellow-800"
                        : "text-green-800";
                    const iconColor = alert.riskLevel === "HIGH" ? "text-red-600"
                      : alert.riskLevel === "MEDIUM" ? "text-yellow-600"
                        : "text-green-600";
                    const bgIconColor = alert.riskLevel === "HIGH" ? "bg-red-100"
                      : alert.riskLevel === "MEDIUM" ? "bg-yellow-100"
                        : "bg-green-100";

                    return (
                      <div key={alert._id} className={`border rounded-xl p-6 ${bgColor} border`}>
                        <div className="flex items-start space-x-4">
                          <div className={`p-2 ${bgIconColor} rounded-lg`}>
                            <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold ${textColor}`}>
                              {alert.riskLevel === "HIGH" ? "Critical: " : alert.riskLevel === "MEDIUM" ? "Warning: " : "Info: "}
                              {alert.location}
                            </h3>
                            <p className={textColor.replace("800", "700")}>{alert.reason}</p>
                            <div className="flex items-center space-x-4 text-sm mt-2">
                              <span className={textColor.replace("800", "600")}>Status: {alert.status.toUpperCase()}</span>
                              <span className={textColor.replace("800", "600")}>•</span>
                              <span className={textColor.replace("800", "600")}>{new Date(alert.createdAt).toLocaleDateString()}</span>
                              {alert.notificationSent && <span className="text-blue-600">📧 Notified</span>}
                            </div>

                            {/* Expanded Details */}
                            {expandedAlerts.has(alert._id) && (
                              <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                                <p className="text-sm mb-3"><strong>Alert ID:</strong> {alert._id.slice(0, 12)}...</p>
                                {/* Alert Actions - Management users only */}
                                {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
                                  <div className="flex gap-2 flex-wrap">
                                    {alert.status === "active" && (
                                      <button
                                        onClick={() => resolveAlert(alert._id)}
                                        disabled={actionInProgress === alert._id}
                                        className={`px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50`}
                                      >
                                        {actionInProgress === alert._id ? "Processing..." : "✅ Resolve"}
                                      </button>
                                    )}
                                    {!alert.notificationSent && (
                                      <button
                                        onClick={() => resendNotification(alert._id)}
                                        disabled={actionInProgress === alert._id}
                                        className={`px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50`}
                                      >
                                        {actionInProgress === alert._id ? "Sending..." : "📧 Send Alert"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => toggleExpandAlert(alert._id)}
                              className={`px-4 py-2 ${alert.riskLevel === "HIGH" ? "bg-red-600 hover:bg-red-700" : alert.riskLevel === "MEDIUM" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"} text-white rounded-lg transition-colors text-sm`}
                            >
                              {expandedAlerts.has(alert._id) ? "▼ Hide" : "▶ Details"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchAlerts}
                disabled={alertsLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                🔄 {alertsLoading ? "Loading..." : "Refresh Alerts"}
              </button>
            </div>
          )}

          {/* Health Advisory Tab - Public/community users only */}
          {activeTab === "advisory" && userRole === 'USER' && (
            <HealthAdvisory />
          )}

          {/* CSV Upload Tab - Management users only */}
          {/* CSV Upload Tab - Management users only */}
          {activeTab === "csv-upload" && (userRole === 'ADMIN' || userRole === 'OPERATOR') && (
            <CSVUpload
              token={token}
              onUploadSuccess={() => fetchReports(false)}
            />
          )}

          {/* Management tab - admin only */}
          {activeTab === "operators" && userRole === 'ADMIN' && (
            <AdminOperators token={token} />
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <Analytics token={token} userRole={userRole} />
          )}

          {/* Outbreak Map Tab */}
          {activeTab === "map" && (
            <OutbreakMap token={token} userRole={userRole} />
          )}

        </main>
      </div>
    </div>
  );
};

export default Dashboard;