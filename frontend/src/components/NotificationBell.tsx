import { useEffect, useRef, useState, useCallback } from "react";
import { API_URL } from "./api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  location: string | null;
  severity: string | null;
  createdAt: string;
  read: boolean;
}

interface NotificationBellProps {
  token: string;
}

const TYPE_ICON: Record<string, string> = {
  ALERT_CREATED: "🚨",
  ALERT_RESOLVED: "✅",
  ALERT_NOTIFIED: "🔔",
  CSV_UPLOAD_SUCCESS: "📤",
  HIGH_RISK_REPORT: "⚠️",
  OPERATOR_CREATED: "👤",
};

const NotificationBell: React.FC<NotificationBellProps> = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, { headers: authHeaders });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silent — the bell just won't update this cycle, polling will retry.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/notifications?limit=30`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Match Dashboard's alert refresh cadence
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: authHeaders,
      });
    } catch {
      // Best-effort — a failed mark-read just leaves it unread server-side;
      // it'll be retried next time the user clicks it.
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: "POST",
        headers: authHeaders,
      });
    } catch {
      // Best-effort — next poll/open will resync the true unread count.
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          ></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[28rem] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
            )}
            {!loading && error && (
              <div className="p-4 text-center text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No notifications yet</div>
            )}
            {!loading &&
              !error &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex gap-3 ${
                    n.read ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <span className="text-lg leading-none">{TYPE_ICON[n.type] || "🔔"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>}
                    </span>
                    <span className="block text-xs text-gray-600 mt-0.5">{n.message}</span>
                    <span className="block text-[11px] text-gray-400 mt-1">{formatTime(n.createdAt)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
