import { useCallback, useEffect, useState } from "react";
import Alert from "./Alert";
import LoadingSpinner from "./LoadingSpinner";
import { API_URL } from "./api";

interface AuditLogEntry {
  _id: string;
  action: string;
  username: string;
  role: string;
  village?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  ipAddress?: string | null;
}

interface AuditLogViewerProps {
  token: string;
}

const ACTIONS = [
  "CREATE_PREDICTION",
  "RESOLVE_ALERT",
  "ACKNOWLEDGE_ALERT",
  "NOTIFY_ALERT",
  "UPLOAD_CSV",
  "EDIT_REPORT",
  "DELETE_REPORT",
  "CLEANUP_ORPHANED_PREDICTIONS",
  "CLEANUP_UNTRACKED_PREDICTIONS",
  "DELETE_USER",
  "CREATE_ADMIN",
  "DELETE_ADMIN",
  "BULK_CREATE_OPERATORS",
  "FORGOT_PASSWORD_REQUESTED",
  "RESET_PASSWORD",
  "CHANGE_PASSWORD",
];

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ limit: "100", ...extra });
      if (actionFilter) params.set("action", actionFilter);
      if (usernameFilter.trim()) params.set("username", usernameFilter.trim());
      return params;
    },
    [actionFilter, usernameFilter]
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/audit-logs?${buildParams().toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load audit log");
      }
      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [token, buildParams]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    setError("");
    try {
      const params = buildParams({ format });
      const response = await fetch(`${API_URL}/audit-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const extension = format === "excel" ? "xlsx" : format;
      link.download = `SmartHealth_AuditLog_${Date.now()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Management dashboard
        </div>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          A record of sensitive actions across the system — report edits/deletes, alert
          resolutions, CSV uploads, and account management — for accountability and
          incident review.
        </p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError("")} />}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Username</label>
              <input
                type="text"
                value={usernameFilter}
                onChange={(e) => setUsernameFilter(e.target.value)}
                placeholder="Filter by username..."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={loadLogs}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Apply / Refresh
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(["csv", "excel", "pdf"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                disabled={exporting !== null}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {exporting === format ? "Exporting..." : `Export ${format.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          Showing {logs.length} of {total} entries
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <LoadingSpinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
            No audit log entries match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Timestamp</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Village/District</th>
                  <th className="py-2 pr-4">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-900">
                      {log.username} <span className="text-gray-400">({log.role})</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{log.village || "—"}</td>
                    <td className="py-3 pr-4 text-gray-500">{log.ipAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;
