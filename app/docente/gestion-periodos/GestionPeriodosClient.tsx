"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Layers, X, Save, Loader2, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

interface Period {
  id: string;
  name: string;
  active: boolean;
  courseIds?: string[];
}

interface Course {
  id: string;
  name: string;
}

interface GestionPeriodosClientProps {
  initialPeriods: Period[];
  courses: Course[];
}

export default function GestionPeriodosClient({ initialPeriods, courses }: GestionPeriodosClientProps) {
  const router = useRouter();
  const confirm = useConfirm();

  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodForm, setPeriodForm] = useState({ name: "" });

  // ── Course assignment states ──
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningPeriod, setAssigningPeriod] = useState<Period | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  const refreshPeriods = async () => {
    const res = await fetch("/api/docente/periodos");
    const data = await res.json();
    if (data.periods) {
      const mapped = data.periods.map((p: any) => ({
        id: p.id,
        name: p.name,
        active: p.active,
        courseIds: p.periodCourses ? p.periodCourses.map((pc: any) => pc.courseId) : [],
      }));
      setPeriods(mapped);
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

  const openAssignModal = (period: Period) => {
    setAssigningPeriod(period);
    setSelectedCourseIds(period.courseIds ?? []);
    setError("");
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningPeriod) return;
    setSavingAssign(true);
    setError("");

    try {
      const res = await fetch("/api/docente/periodos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assigningPeriod.id, courseIds: selectedCourseIds }),
      });
      const data = await res.json();

      if (res.ok) {
        setShowAssignModal(false);
        await refreshPeriods();
        router.refresh();
      } else {
        setError(data.error || "Error al asignar asignaturas");
      }
    } catch {
      setError("Error de conexión al guardar las asignaciones");
    } finally {
      setSavingAssign(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers size={22} className="text-[#f98012]" />
            Periodos Lectivos
          </h2>
          <p className="text-muted text-sm mt-1">
            Crea, edita, activa/desactiva los periodos lectivos y asigna tus asignaturas.
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
                  <td className="p-4">
                    <div className="font-semibold text-sm">{period.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {period.courseIds && period.courseIds.length > 0 ? (
                        period.courseIds.map((cId) => {
                          const course = courses.find((c) => c.id === cId);
                          return course ? (
                            <span
                              key={cId}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-[#ea580c] dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                            >
                              {course.name}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                          Sin asignaturas vinculadas
                        </span>
                      )}
                    </div>
                  </td>
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
                            ? "var(--primary-color, #f98012)"
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
                        onClick={() => openAssignModal(period)}
                        className="p-1.5 rounded-lg border hover:bg-slate-100 text-blue-600 dark:text-blue-450 dark:hover:bg-gray-800 transition-all"
                        style={{ borderColor: "var(--border-color)" }}
                        title="Asignar Asignaturas"
                      >
                        <BookOpen size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPeriod(period);
                          setPeriodForm({ name: period.name });
                          setError("");
                          setShowPeriodModal(true);
                        }}
                        className="p-1.5 rounded-lg border hover:bg-slate-100 text-[#f98012] dark:text-[#f98012] dark:hover:bg-gray-800 transition-all"
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

      {/* Modal Crear/Editar Periodo */}
      {showPeriodModal && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowPeriodModal(false)
          }
        >
          <form
            onSubmit={handleCreateOrUpdate}
            className="modal-content w-full max-w-md"
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

      {/* Assign Courses Modal */}
      {showAssignModal && assigningPeriod && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowAssignModal(false)
          }
        >
          <form
            onSubmit={handleSaveAssignments}
            className="modal-content w-full max-w-md"
            style={{ borderRadius: "1rem" }}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  Asignar Asignaturas
                </h2>
                <p className="text-xs text-muted mt-0.5 font-semibold">
                  {assigningPeriod.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
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

            <p className="text-xs text-muted mb-3 font-semibold">
              Selecciona las asignaturas que estarán activas en este periodo:
            </p>

            <div
              className="border rounded-lg p-3 max-h-[220px] overflow-y-auto flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 mb-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              {courses.length === 0 ? (
                <p className="text-xs text-muted italic text-center py-4">
                  No tienes asignaturas creadas.
                </p>
              ) : (
                courses.map((c) => {
                  const isChecked = selectedCourseIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer rounded hover:bg-orange-50 dark:hover:bg-orange-900/10 text-xs font-bold text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedCourseIds((prev) =>
                            isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className="rounded text-[#f98012] focus:ring-[#f98012] w-4 h-4 cursor-pointer"
                      />
                      <span>{c.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div
              className="flex justify-end gap-3 border-t pt-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setShowAssignModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary flex items-center gap-2 text-xs"
                disabled={savingAssign}
              >
                {savingAssign ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
