import { useCallback, useEffect, useState } from "react";
import Alert from "./Alert";
import LoadingSpinner from "./LoadingSpinner";
import { API_URL } from "./api";

interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at?: string | null;
}

interface AdminUsersProps {
  token: string;
}

const AdminUsers: React.FC<AdminUsersProps> = ({ token }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`${API_URL}/auth/users?${params.toString()}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load users");
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(handle);
  }, [loadUsers]);

  const handleDelete = async (user: UserAccount) => {
    const confirmDelete = window.confirm(
      `Delete the account "${user.username}" (${user.email})? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setDeletingId(user.id);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/users/${user.id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Delete failed");
      }

      setUsers((current) => current.filter((u) => u.id !== user.id));
      setTotal((t) => Math.max(0, t - 1));
      setMessage(`Deleted "${user.username}" successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Management dashboard
        </div>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Community Users</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Self-registered public accounts (Health Advisory / Outbreak Map access only).
          These accounts have no district or reporting privileges — use this list to
          review or remove accounts, e.g. spam registrations or abuse.
        </p>
      </div>

      {message && (
        <Alert
          type={message.toLowerCase().includes("delet") ? "success" : "error"}
          message={message}
          onClose={() => setMessage("")}
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {total} user{total === 1 ? "" : "s"}
            </h2>
            <p className="text-sm text-gray-500">Registered public accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={loadUsers}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <LoadingSpinner size="lg" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
            No community user accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Registered</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{user.username}</td>
                    <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                    <td className="py-3 pr-4 text-gray-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === user.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
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

export default AdminUsers;
