"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Layers, X, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

interface Period {
  id: string;
  name: string;
  active: boolean;
}

interface GestionPeriodosClientProps {
  initialPeriods: Period[];
}

export default function GestionPeriodosClient({ initialPeriods }: GestionPeriodosClientProps) {
  const router = useRouter();
  const confirm = useConfirm();

  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodForm, setPeriodForm] = useState({ name: "" });

  const refreshPeriods = async () => {
    const res = await fetch("/api/docente/periodos");
    const data = await res.json();
    if (data.periods) {
      setPeriods(data.periods);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!periodForm.name || periodForm.name.trim() === "") {
      setError("El nombre es obligatorio");
      setLoading(false);
      return;
    }

    try {
      const method = editingPeriod ? "PATCH" : "POST";
      const body = editingPeriod
        ? JSON.stringify({ id: editingPeriod.id, name: periodForm.name })
        : JSON.stringify({ name: periodForm.name });

      const res = await fetch("/api/docente/periodos", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();

      if (res.ok) {
        setShowPeriodModal(false);
        await refreshPeriods();
        router.refresh();
      } else {
        setError(data.error || "Error al guardar el periodo");
      }
    } catch {
      setError("Error de conexión al guardar el periodo");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (period: Period) => {
    // If deactivating, warn the user
    if (period.active) {
      const ok = await confirm({
        title: "Desactivar Periodo",
        message: `¿Deseas desactivar "${period.name}"? Esto ocultará automáticamente TODAS las tareas y materiales de este periodo a los estudiantes.`,
        confirmText: "Desactivar",
        type: "danger",
      });
      if (!ok) return;
    }

    try {
      const res = await fetch("/api/docente/periodos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id, active: !period.active }),
      });
      if (res.ok) {
        await refreshPeriods();
        router.refresh();
      }
    } catch {
      console.error("Failed to toggle period status");
    }
  };

  const handleDelete = async (period: Period) => {
    const ok = await confirm({
      title: "Eliminar Periodo",
      message: `¿Estás seguro de que deseas eliminar "${period.name}"? Todas las tareas y recursos de este periodo perderán su asignación.`,
      confirmText: "Eliminar",
      type: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/docente/periodos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id }),
      });
      if (res.ok) {
        await refreshPeriods();
        router.refresh();
      }
    } catch {
      console.error("Failed to delete period");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers size={22} className="text-blue-500" />
            Periodos Lectivos
          </h2>
          <p className="text-muted text-sm mt-1">
            Crea, edita y activa/desactiva los periodos lectivos globales para todas las asignaturas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPeriod(null);
            setPeriodForm({ name: "" });
            setError("");
            setShowPeriodModal(true);
          }}
          className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus size={18} />
          Nuevo Periodo
        </button>
      </div>

      {/* Table */}
      <div
        className="card overflow-hidden p-0"
        style={{ border: "1px solid var(--border-color)", background: "var(--bg-primary)" }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              style={{
                background: "var(--bg-secondary)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted">
                Nombre del Periodo
              </th>
              <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted">
                Estado
              </th>
              <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody
            className="divide-y"
            style={{ borderColor: "var(--border-color)" }}
          >
            {periods.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-10 text-center text-muted">
                  <Layers size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">
                    No hay periodos creados.
                  </p>
                  <p className="text-xs mt-1">
                    Haz clic en &quot;Nuevo Periodo&quot; para empezar.
                  </p>
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr
                  key={period.id}
                  className="hover:bg-slate-50/55 dark:hover:bg-slate-900/30 transition-colors"
                >
                  <td className="p-4 font-semibold text-sm">{period.name}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(period)}
                        className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
                        style={{
                          width: "42px",
                          height: "22px",
                          borderRadius: "9999px",
                          background: period.active
                            ? "var(--success, #10b981)"
                            : "#cbd5e1",
                          border: "none",
                          padding: 0,
                          outline: "none",
                        }}
                        title={
                          period.active
                            ? "Desactivar Periodo"
                            : "Activar Periodo"
                        }
                      >
                        <span
                          className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                          style={{
                            width: "18px",
                            height: "18px",
                            transform: period.active
                              ? "translateX(22px)"
                              : "translateX(2px)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        />
                      </button>
                      <span
                        className={`text-xs font-semibold ${
                          period.active
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-400"
                        }`}
                      >
                        {period.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPeriod(period);
                          setPeriodForm({ name: period.name });
                          setError("");
                          setShowPeriodModal(true);
                        }}
                        className="p-1.5 rounded-lg border hover:bg-slate-100 text-blue-600 dark:text-blue-400 dark:hover:bg-gray-800 transition-all"
                        style={{ borderColor: "var(--border-color)" }}
                        title="Editar Nombre"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(period)}
                        className="p-1.5 rounded-lg border hover:bg-red-50 text-red-600 dark:text-red-400 dark:hover:bg-red-950/30 transition-all"
                        style={{ borderColor: "var(--border-color)" }}
                        title="Eliminar Periodo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showPeriodModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={(e) =>
            e.target === e.currentTarget && setShowPeriodModal(false)
          }
        >
          <form
            onSubmit={handleCreateOrUpdate}
            className="card w-full max-w-md animate-fade-in"
            style={{ borderRadius: "1rem" }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">
                {editingPeriod ? "Editar Periodo" : "Nuevo Periodo"}
              </h2>
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="alert alert-danger mb-4 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="input-group mb-4">
              <label className="font-semibold text-xs mb-1 block">
                Nombre del Periodo *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Periodo 1, Primer Bimestre..."
                value={periodForm.name}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, name: e.target.value })
                }
                required
                autoFocus
              />
            </div>

            <div
              className="flex justify-end gap-3 border-t pt-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPeriodModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {editingPeriod ? "Guardar Cambios" : "Crear Periodo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
