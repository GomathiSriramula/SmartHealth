import { useCallback, useEffect, useState } from "react";
import Alert from "./Alert";
import LoadingSpinner from "./LoadingSpinner";
import { API_URL } from "./api";

interface OperatorAccount {
  id: string;
  name: string;
  email: string;
  state: string;
  district: string;
  created_at?: string | null;
}

interface OperatorFormState {
  name: string;
  email: string;
  password: string;
  district: string;
}

interface AdminAccount {
  id: string;
  username: string;
  email: string;
  created_at?: string | null;
}

interface AdminAccountFormState {
  username: string;
  email: string;
  password: string;
}

interface AdminOperatorsProps {
  token: string;
  currentUsername?: string;
}

const initialForm: OperatorFormState = {
  name: "",
  email: "",
  password: "",
  district: "",
};

const initialAdminForm: AdminAccountFormState = {
  username: "",
  email: "",
  password: "",
};

const AdminOperators: React.FC<AdminOperatorsProps> = ({ token, currentUsername }) => {
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OperatorFormState>(initialForm);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  // CSV bulk-upload state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string>("");

  // Admin accounts management state
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminForm, setAdminForm] = useState<AdminAccountFormState>(initialAdminForm);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDeletingId, setAdminDeletingId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loadOperators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${API_URL}/auth/operators?${params.toString()}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load operators");
      }

      const data = await response.json();
      setOperators(data.operators || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load operators");
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadOperators();
    }, 300);
    return () => clearTimeout(handle);
  }, [loadOperators]);

  const handleExport = async (format: "csv" | "excel") => {
    setExporting(format);
    try {
      const response = await fetch(`${API_URL}/auth/operators/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Export failed");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `SmartHealth_Operators_${Date.now()}.${format === "excel" ? "xlsx" : "csv"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/operators/csv-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "SmartHealth_Operators_Template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setBulkResult(error instanceof Error ? error.message : "Failed to download template");
    }
  };

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/admins`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load admins");
      }
      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Failed to load admins");
    } finally {
      setAdminsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setBulkResult("Choose a CSV file first.");
      return;
    }
    setBulkUploading(true);
    setBulkResult("");

    try {
      const formData = new FormData();
      formData.append("file", bulkFile);

      const response = await fetch(`${API_URL}/auth/operators/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Bulk upload failed");
      }

      setBulkResult(
        `Processed ${data.summary.totalRows} row(s): ${data.summary.created} created, ${data.summary.failed} failed.` +
          (data.errors && data.errors.length > 0
            ? ` First error: line ${data.errors[0].line} — ${data.errors[0].error}`
            : "")
      );
      setBulkFile(null);
      await loadOperators();
    } catch (error) {
      setBulkResult(error instanceof Error ? error.message : "Bulk upload failed");
    } finally {
      setBulkUploading(false);
    }
  };

  const resetAdminForm = () => setAdminForm(initialAdminForm);

  const handleAdminSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdminSaving(true);
    setAdminMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/admins`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: adminForm.username.trim(),
          email: adminForm.email.trim(),
          password: adminForm.password.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Admin creation failed");
      }

      setAdmins((current) => [data.admin, ...current]);
      setAdminMessage(`Admin "${data.admin.username}" created successfully.`);
      resetAdminForm();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Unable to create admin");
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAdminDelete = async (admin: AdminAccount) => {
    const confirmDelete = window.confirm(`Delete admin account "${admin.username}"?`);
    if (!confirmDelete) return;

    setAdminDeletingId(admin.id);
    setAdminMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/admins/${admin.id}`, {
        method: "DELETE",
        headers,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Admin delete failed");
      }

      setAdmins((current) => current.filter((a) => a.id !== admin.id));
      setAdminMessage(`Deleted admin "${admin.username}" successfully.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Unable to delete admin");
    } finally {
      setAdminDeletingId(null);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const startEdit = (operator: OperatorAccount) => {
    setEditingId(operator.id);
    setForm({
      name: operator.name,
      email: operator.email,
      password: "",
      district: operator.district,
    });
    setMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        district: form.district.trim(),
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      };

      const response = await fetch(
        editingId ? `${API_URL}/auth/operators/${editingId}` : `${API_URL}/auth/operators`,
        {
          method: editingId ? "PUT" : "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Operator save failed");
      }

      const data = await response.json();
      const savedOperator = data.operator;

      setOperators((current) => {
        if (editingId) {
          return current.map((item) => (item.id === savedOperator.id ? savedOperator : item));
        }
        return [savedOperator, ...current];
      });

      setMessage(editingId ? "Operator updated successfully." : "Operator created successfully.");
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save operator");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (operatorId: string) => {
    const confirmDelete = window.confirm("Delete this District Operator account?");
    if (!confirmDelete) {
      return;
    }

    setDeletingId(operatorId);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/operators/${operatorId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Operator delete failed");
      }

      setOperators((current) => current.filter((item) => item.id !== operatorId));
      if (editingId === operatorId) {
        resetForm();
      }
      setMessage("Operator deleted successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete operator");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Management dashboard
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              District Operator Management
            </h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Create, edit, and remove district accounts for Telangana. State is fixed and this page is restricted to management users.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm ring-1 ring-blue-100">
            <div className="font-semibold text-gray-900">State</div>
            <div>Telangana</div>
          </div>
        </div>
      </div>

      {message && (
        <Alert
          type={message.toLowerCase().includes("success") ? "success" : "error"}
          message={message}
          onClose={() => setMessage("")}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Edit District Operator" : "Create District Operator"}
              </h2>
              <p className="text-sm text-gray-500">
                Name maps to the login username. Password is required on create and optional on edit.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter operator name"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="operator@example.com"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password {editingId ? "(leave blank to keep current)" : ""}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder={editingId ? "Optional new password" : "Create a password"}
                minLength={editingId ? 0 : 6}
                required={!editingId}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">District</label>
              <input
                type="text"
                value={form.district}
                onChange={(event) => setForm({ ...form, district: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter district"
                required
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Saving...
                  </span>
                ) : editingId ? (
                  "Update Operator"
                ) : (
                  "Create Operator"
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-900">Bulk import from CSV</h3>
            <p className="mt-1 text-xs text-gray-500">
              Columns: name (or username), email, password, district. One operator per row.{" "}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Download template
              </button>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-600"
              />
              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={bulkUploading || !bulkFile}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {bulkUploading ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
            {bulkResult && <p className="mt-2 text-xs text-gray-600">{bulkResult}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Current Operators</h2>
              <p className="text-sm text-gray-500">
                {operators.length} operator{operators.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search name, email, or district..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={loadOperators}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={exporting !== null}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {exporting === "csv" ? "Exporting..." : "Export CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={exporting !== null}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {exporting === "excel" ? "Exporting..." : "Export Excel"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <LoadingSpinner size="lg" />
            </div>
          ) : operators.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
              {search.trim() ? "No operators match your search." : "No district operators found."}
            </div>
          ) : (
            <div className="space-y-4">
              {operators.map((operator) => (
                <div
                  key={operator.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{operator.name}</div>
                      <div className="text-sm text-gray-600">{operator.email}</div>
                      <div className="mt-2 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                        Telangana / {operator.district}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(operator)}
                        className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(operator.id)}
                        disabled={deletingId === operator.id}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === operator.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Create Admin Account</h2>
          <p className="mb-6 text-sm text-gray-500">
            Previously only possible via .env plus a server restart — this creates an
            additional ADMIN account directly.
          </p>

          {adminMessage && (
            <div className="mb-4">
              <Alert
                type={adminMessage.toLowerCase().includes("delet") || adminMessage.toLowerCase().includes("creat") ? "success" : "error"}
                message={adminMessage}
                onClose={() => setAdminMessage("")}
              />
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={adminForm.username}
                onChange={(event) => setAdminForm({ ...adminForm, username: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
                disabled={adminSaving}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={adminForm.email}
                onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
                disabled={adminSaving}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={adminForm.password}
                onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                minLength={6}
                required
                disabled={adminSaving}
              />
            </div>
            <button
              type="submit"
              disabled={adminSaving}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {adminSaving ? "Creating..." : "Create Admin"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Current Admins</h2>
              <p className="text-sm text-gray-500">
                You cannot delete your own account or the last remaining admin.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdmins}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={adminsLoading}
            >
              Refresh
            </button>
          </div>

          {adminsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <LoadingSpinner size="lg" />
            </div>
          ) : admins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
              No admin accounts found.
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => {
                const isSelf = currentUsername && admin.username === currentUsername;
                return (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {admin.username} {isSelf && <span className="text-xs text-blue-600">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-500">{admin.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdminDelete(admin)}
                      disabled={Boolean(isSelf) || adminDeletingId === admin.id || admins.length <= 1}
                      title={isSelf ? "You cannot delete your own account" : admins.length <= 1 ? "Cannot delete the last remaining admin" : undefined}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {adminDeletingId === admin.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminOperators;