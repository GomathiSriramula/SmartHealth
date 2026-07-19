import { useEffect, useState } from "react";
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

interface AdminOperatorsProps {
  token: string;
}

const initialForm: OperatorFormState = {
  name: "",
  email: "",
  password: "",
  district: "",
};

const AdminOperators: React.FC<AdminOperatorsProps> = ({ token }) => {
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OperatorFormState>(initialForm);
  const [message, setMessage] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loadOperators = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/operators`, { headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load operators");
      }

      const data = await response.json();
      setOperators(data.operators || []);
    } catch (error: any) {
      setMessage(error.message || "Failed to load operators");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperators();
  }, []);

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
    } catch (error: any) {
      setMessage(error.message || "Unable to save operator");
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
    } catch (error: any) {
      setMessage(error.message || "Unable to delete operator");
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
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Current Operators</h2>
              <p className="text-sm text-gray-500">Showing all district operator accounts.</p>
            </div>
            <button
              type="button"
              onClick={loadOperators}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <LoadingSpinner size="lg" />
            </div>
          ) : operators.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
              No district operators found.
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
    </div>
  );
};

export default AdminOperators;