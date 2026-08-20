"use client";

import { useState } from "react";
import { ClipboardList, Plus, Pencil, X, Save, Loader2, CheckCircle, Clock, AlertCircle, Users, Search, UserCheck } from "lucide-react";
import TaskActions from "./TaskActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import { createPortal } from "react-dom";

interface Task {
  id: string;
  title: string;
  type?: string;
  dueDate: string | Date;
  theme?: string | null;
  period?: string | null;
  weight?: number | null;
  attachmentUrl?: string | null;
  active?: boolean;
  publishAt?: string | null;
  gdriveEmail?: string | null;
  isExternal?: boolean;
}

interface Course {
  id: string;
  name: string;
  period1Active?: boolean;
  period2Active?: boolean;
  period3Active?: boolean;
  period4Active?: boolean;
  tasks: Task[];
}

interface Period {
  id: string;
  name: string;
  active: boolean;
}

interface StudentGradeEntry {
  id: string;
  name: string;
  groupName: string;
  submission: {
    id: string;
    status: string;
    grade: number | null;
    feedback: string | null;
    submittedAt: string | null;
  } | null;
}

export default function TareasDocenteClient({ courses, periods }: { courses: Course[], periods: Period[] }) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const hasFiltersApplied = selectedTheme !== "" || selectedPeriod !== "";

  // Manual Grading Modal state
  const [gradingTask, setGradingTask] = useState<Task | null>(null);
  const [gradingStudents, setGradingStudents] = useState<StudentGradeEntry[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradingError, setGradingError] = useState("");
  const [gradingSaved, setGradingSaved] = useState(false);

  // Assign Students Modal state
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [availableStudents, setAvailableStudents] = useState<{ id: string; name: string; username: string; groupName?: string; grade?: string; group?: any }[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSaved, setAssignSaved] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");

  const openAssignModal = async (task: Task) => {
    setAssigningTask(task);
    setAssignError("");
    setAssignSaved(false);
    setLoadingAssign(true);
    setAssignSearch("");
    setAvailableStudents([]);
    setAssignedStudentIds([]);
    try {
      const res = await fetch(`/api/docente/tareas/${task.id}/assigned-students`);
      const data = await res.json();
      if (res.ok) {
        setAvailableStudents(data.availableStudents || []);
        setAssignedStudentIds((data.assignedStudents || []).map((s: any) => s.id));
      } else {
        setAssignError(data.error || "Error al cargar estudiantes");
      }
    } catch {
      setAssignError("Error de conexión");
    } finally {
      setLoadingAssign(false);
    }
  };

  const saveAssignedStudents = async () => {
    if (!assigningTask) return;
    setSavingAssign(true);
    setAssignError("");
    setAssignSaved(false);
    try {
      const res = await fetch(`/api/docente/tareas/${assigningTask.id}/assigned-students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: assignedStudentIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignSaved(true);
        setTimeout(() => {
          setAssignSaved(false);
          setAssigningTask(null);
        }, 1200);
        router.refresh();
      } else {
        setAssignError(data.error || "Error al guardar asignaciones");
      }
    } catch {
      setAssignError("Error de conexión al guardar");
    } finally {
      setSavingAssign(false);
    }
  };

  const toggleTaskActive = async (task: Task) => {
    const newVal = task.active !== false ? false : true;
    try {
      await fetch(`/api/docente/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newVal })
      });
      router.refresh();
    } catch {
      console.error("Failed to toggle task status");
    }
  };

  const openGradingModal = async (task: Task) => {
    setGradingTask(task);
    setGradingError("");
    setGradingSaved(false);
    setLoadingStudents(true);
    setGradingStudents([]);
    try {
      const res = await fetch(`/api/docente/tareas/${task.id}/students-grades`);
      const data = await res.json();
      if (res.ok && data.students) {
        setGradingStudents(data.students);
        const inputs: Record<string, string> = {};
        const fInputs: Record<string, string> = {};
        data.students.forEach((s: StudentGradeEntry) => {
          inputs[s.id] = s.submission?.grade != null ? String(s.submission.grade) : "";
          fInputs[s.id] = s.submission?.feedback ?? "";
        });
        setGradeInputs(inputs);
        setFeedbackInputs(fInputs);
      } else {
        setGradingError(data.error || "Error al cargar estudiantes");
      }
    } catch {
      setGradingError("Error de conexión");
    } finally {
      setLoadingStudents(false);
    }
  };

  const saveManualGrades = async () => {
    if (!gradingTask) return;
    setSavingGrades(true);
    setGradingError("");
    setGradingSaved(false);
    try {
      const promises = gradingStudents
        .filter(s => gradeInputs[s.id] !== "")
        .map(s =>
          fetch("/api/docente/calificar", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: gradingTask.id,
              studentId: s.id,
              grade: Number(gradeInputs[s.id]),
              feedback: feedbackInputs[s.id] || undefined,
            }),
          })
        );
      await Promise.all(promises);
      setGradingSaved(true);
      setTimeout(() => setGradingSaved(false), 2500);
      router.refresh();
    } catch {
      setGradingError("Error al guardar calificaciones");
    } finally {
      setSavingGrades(false);
    }
  };

  // Extract all unique non-null themes and periods across all tasks in all courses
  const allTasks = courses.flatMap(c => c.tasks);
  const uniqueThemes = Array.from(new Set(allTasks.map(t => t.theme).filter(Boolean))) as string[];
  const uniquePeriods = Array.from(new Set(allTasks.map(t => t.period).filter(Boolean))) as string[];

  const statusBadge = (sub: StudentGradeEntry["submission"]) => {
    if (!sub) return <span className="text-xs text-muted italic">Sin entrega</span>;
    if (sub.status === "GRADED" || sub.grade != null) return <span className="badge badge-success flex items-center gap-1"><CheckCircle size={10} /> Calificada</span>;
    if (sub.status === "SUBMITTED") return <span className="badge badge-info flex items-center gap-1"><Clock size={10} /> Entregada</span>;
    return <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={10} /> Pendiente</span>;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Global Filter Toolbar */}
      {allTasks.length > 0 && uniquePeriods.length > 0 && (
        <div className="card p-4 flex flex-wrap gap-4 items-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <span className="font-semibold text-sm text-muted">Filtrar Tareas:</span>
          {uniquePeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted font-medium">Periodo:</label>
              <select 
                className="input-field py-1 px-3 text-xs h-auto" 
                value={selectedPeriod} 
                onChange={e => setSelectedPeriod(e.target.value)}
                style={{ width: "160px" }}
              >
                <option value="">Todos los periodos</option>
                {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Courses List */}
      <div className="flex flex-col gap-6">
        {courses.map(course => {
          const filteredTasks = course.tasks.filter(task => {
            const matchTheme = !selectedTheme || task.theme === selectedTheme;
            const matchPeriod = !selectedPeriod || task.period === selectedPeriod;
            return matchTheme && matchPeriod;
          });

          if (hasFiltersApplied && filteredTasks.length === 0) return null;

          return (
            <div key={course.id} className="card w-full">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ClipboardList className="text-[#f98012]" />
                {course.name}
              </h2>
              
              <div className="flex flex-col gap-5">
                {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4", "Otros"].map(periodName => {
                  const periodTasks = filteredTasks.filter(t => {
                    if (periodName === "Otros") {
                      return !t.period || !["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].includes(t.period);
                    }
                    return t.period === periodName;
                  });

                  if (periodName === "Otros" && periodTasks.length === 0) return null;

                  const isPeriodActive = periodName === "Otros" || (() => {
                    const p = periods.find(p => p.name.toLowerCase() === periodName.toLowerCase());
                    return p ? p.active : true;
                  })();

                  return (
                    <div key={periodName} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', opacity: isPeriodActive ? 1 : 0.6 }}>
                      <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isPeriodActive ? 'bg-orange-500' : 'bg-gray-400'}`}></span>
                          {periodName}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isPeriodActive && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">Oculto para Alumnos</span>}
                          {periodName !== "Otros" && (
                            <Link href={`/docente/tareas/nueva?courseId=${course.id}&periodo=${encodeURIComponent(periodName)}`} className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1">
                              <Plus size={12} /> Crear Tarea
                            </Link>
                          )}
                        </div>
                      </h4>
                      
                      {periodTasks.length === 0 ? (
                        <p className="text-muted text-xs italic p-2">No hay tareas creadas en este periodo.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th className="py-2 px-4 font-medium text-xs">Título</th>
                                <th className="py-2 px-4 font-medium text-xs">Grado</th>
                                <th className="py-2 px-4 font-medium text-xs">Grupo</th>
                                <th className="py-2 px-4 font-medium text-xs">Porcentaje</th>
                                <th className="py-2 px-4 font-medium text-xs">Fecha Límite</th>
                                <th className="py-2.5 px-4 font-bold text-center text-xs">Estado</th>
                                <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodTasks.map(task => (
                                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                  <td className="py-3 px-4 font-semibold text-sm text-slate-800">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-2">
                                        <span>{task.title}</span>
                                        {task.isExternal ? (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}>
                                            📁 Entrega en clase
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "#f0f9ff", color: "#0369a1", borderColor: "#b9e6fe" }}>
                                            💻 Entrega en plataforma
                                          </span>
                                        )}
                                      </div>
                                      {task.gdriveEmail && (
                                        <GDriveEmailDisplay email={task.gdriveEmail} context="tasks" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{(task as any).groups?.[0]?.grade?.name || "Sin Grado"}</td>
                                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{(task as any).groups?.map((g: any) => g.name).join(", ") || "Sin Grupo"}</td>
                                  <td className="py-3 px-4">
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                      {task.weight !== undefined && task.weight !== null ? task.weight : 0}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-muted text-sm">
                                    {new Date(task.dueDate).getFullYear() >= 9000 ? "Sin fecha límite" : new Date(task.dueDate).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskActive(task)}
                                        className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
                                        style={{
                                          width: "42px",
                                          height: "22px",
                                          borderRadius: "9999px",
                                          background: task.active !== false ? "var(--primary-color, #f98012)" : "#cbd5e1",
                                          border: "none",
                                          padding: 0,
                                          outline: "none"
                                        }}
                                        title={task.active !== false ? "Visible para alumnos (Click para ocultar)" : "Oculto para alumnos (Click para mostrar)"}
                                      >
                                        <span
                                          className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                                          style={{
                                            width: "18px",
                                            height: "18px",
                                            transform: task.active !== false ? "translateX(22px)" : "translateX(2px)",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                          }}
                                        />
                                      </button>
                                      {task.active !== false && task.publishAt && new Date(task.publishAt) > new Date() && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50" title={`Se publicará el ${new Date(task.publishAt).toLocaleString()}`}>
                                          Programada
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {/* Assign specific students button */}
                                      <button
                                        title="Asignar estudiantes específicos"
                                        onClick={() => openAssignModal(task)}
                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition-colors"
                                      >
                                        <Users size={15} />
                                      </button>
                                      {/* Manual grade button */}
                                      <button
                                        title="Calificar manualmente (trabajo fuera de plataforma)"
                                        onClick={() => openGradingModal(task)}
                                        className="p-1.5 rounded-lg hover:bg-orange-50 text-muted hover:text-[#f98012] transition-colors"
                                      >
                                        <Pencil size={15} />
                                      </button>
                                      <TaskActions taskId={task.id} attachmentUrl={task.attachmentUrl} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {hasFiltersApplied && courses.length > 0 && courses.every(c => c.tasks.filter(t => (!selectedTheme || t.theme === selectedTheme) && (!selectedPeriod || t.period === selectedPeriod)).length === 0) && (
          <div className="card text-center py-10 text-muted">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
            <p>No se encontraron tareas que coincidan con los filtros de búsqueda.</p>
          </div>
        )}
      </div>

      {/* Manual Grading Modal */}
      {gradingTask && typeof window !== "undefined" && createPortal(
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setGradingTask(null)}
        >
          <div className="modal-content" style={{ maxWidth: "600px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div className="flex justify-between items-start mb-3" style={{ flexShrink: 0 }}>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Pencil size={18} style={{ color: "#f98012" }} />
                  Calificación Manual
                </h2>
                <p className="text-sm text-muted mt-0.5">{gradingTask.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  Asigna notas a trabajos realizados <strong>fuera de la plataforma</strong> (
                  {gradingTask.type === "EXAM" ? "Examen — Nota del Saber" : "Tarea — Nota del Hacer"})
                </p>
              </div>
              <button onClick={() => setGradingTask(null)} className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {gradingError && <div className="alert alert-danger mb-3">{gradingError}</div>}
            {gradingSaved && (
              <div className="alert alert-success mb-3 flex items-center gap-2">
                <CheckCircle size={16} /> Calificaciones guardadas correctamente.
              </div>
            )}

            {/* Student list */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "2px" }}>
              {loadingStudents ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-[#f98012]" size={32} />
                </div>
              ) : gradingStudents.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No hay estudiantes asignados a esta tarea.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Column headers */}
                  <div className="grid text-xs font-bold uppercase tracking-wider text-muted px-3 pb-1" style={{ gridTemplateColumns: "1fr 80px 1fr" }}>
                    <span>Estudiante</span>
                    <span className="text-center">Nota (1–5)</span>
                    <span className="pl-2">Comentario</span>
                  </div>

                  {gradingStudents.map(student => (
                    <div
                      key={student.id}
                      className="grid items-center gap-3 p-3 rounded-xl"
                      style={{
                        gridTemplateColumns: "1fr 80px 1fr",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {/* Name + status */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
                          style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                        >
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{student.name}</p>
                          <div className="mt-0.5">{statusBadge(student.submission)}</div>
                        </div>
                      </div>

                      {/* Grade input */}
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="0.1"
                        placeholder="—"
                        value={gradeInputs[student.id] ?? ""}
                        onChange={e => setGradeInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="input-field text-center font-bold"
                        style={{ padding: "0.4rem 0.4rem", fontSize: "0.95rem" }}
                      />

                      {/* Feedback input */}
                      <input
                        type="text"
                        placeholder="Comentario opcional…"
                        value={feedbackInputs[student.id] ?? ""}
                        onChange={e => setFeedbackInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="input-field text-sm"
                        style={{ padding: "0.4rem 0.6rem" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t pt-4 mt-4" style={{ borderColor: "var(--border-color)", flexShrink: 0 }}>
              <div>
                {gradingSaved && (
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg animate-fade-in">
                    <CheckCircle size={18} /> ¡Calificaciones guardadas exitosamente!
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button className="btn btn-secondary" onClick={() => setGradingTask(null)}>Cerrar</button>
                <button
                  className={`btn ${gradingSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "btn-primary"}`}
                  disabled={savingGrades || loadingStudents}
                  onClick={saveManualGrades}
                >
                  {savingGrades ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Guardando...
                    </>
                  ) : gradingSaved ? (
                    <>
                      <CheckCircle size={18} /> ¡Guardado con éxito!
                    </>
                  ) : (
                    <>
                      <Save size={18} /> Guardar Calificaciones
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Specific Students Modal */}
      {assigningTask && typeof window !== "undefined" && createPortal(
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setAssigningTask(null)}
        >
          <div className="modal-content" style={{ maxWidth: "620px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div className="flex justify-between items-start mb-3" style={{ flexShrink: 0 }}>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  Asignar a Estudiantes Específicos
                </h2>
                <p className="text-sm text-muted mt-0.5">{assigningTask.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  Selecciona los estudiantes individuales que tendrán acceso a esta actividad además de los grupos asignados.
                </p>
              </div>
              <button onClick={() => setAssigningTask(null)} className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {assignError && <div className="alert alert-danger mb-3">{assignError}</div>}
            {assignSaved && (
              <div className="alert alert-success mb-3 flex items-center gap-2">
                <CheckCircle size={16} /> Asignaciones guardadas correctamente.
              </div>
            )}

            {/* Search and selection toolbar */}
            <div className="flex flex-col gap-2 mb-3" style={{ flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante por nombre o grupo..."
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    className="input-field pl-8 text-sm py-1.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const filtered = availableStudents.filter(s =>
                      s.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                      (s.groupName && s.groupName.toLowerCase().includes(assignSearch.toLowerCase())) ||
                      (s.group?.name && s.group.name.toLowerCase().includes(assignSearch.toLowerCase()))
                    );
                    const allFilteredIds = filtered.map(s => s.id);
                    const allSelected = allFilteredIds.every(id => assignedStudentIds.includes(id));
                    if (allSelected) {
                      setAssignedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                    } else {
                      setAssignedStudentIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                    }
                  }}
                  className="btn btn-secondary text-xs whitespace-nowrap py-1.5"
                >
                  {availableStudents.filter(s =>
                    s.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                    (s.groupName && s.groupName.toLowerCase().includes(assignSearch.toLowerCase())) ||
                    (s.group?.name && s.group.name.toLowerCase().includes(assignSearch.toLowerCase()))
                  ).every(s => assignedStudentIds.includes(s.id)) && availableStudents.length > 0
                    ? "Deseleccionar filtrados"
                    : "Seleccionar filtrados"}
                </button>
              </div>

              <div className="flex justify-between items-center text-xs text-muted px-1">
                <span>
                  <strong>{assignedStudentIds.length}</strong> de <strong>{availableStudents.length}</strong> estudiantes asignados
                </span>
                {assignedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssignedStudentIds([])}
                    className="text-red-500 hover:underline"
                  >
                    Deseleccionar todos
                  </button>
                )}
              </div>
            </div>

            {/* Students list */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "2px" }}>
              {loadingAssign ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : availableStudents.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No hay estudiantes disponibles en este curso.</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {availableStudents
                    .filter(s =>
                      s.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                      (s.groupName && s.groupName.toLowerCase().includes(assignSearch.toLowerCase())) ||
                      (s.group?.name && s.group.name.toLowerCase().includes(assignSearch.toLowerCase())) ||
                      (s.group?.grade?.name && s.group.grade.name.toLowerCase().includes(assignSearch.toLowerCase()))
                    )
                    .map(student => {
                      const isChecked = assignedStudentIds.includes(student.id);
                      const groupLabel = student.group?.grade?.name
                        ? `${student.group.grade.name} - ${student.group.name}`
                        : (student.groupName || "Sin grupo");

                      return (
                        <label
                          key={student.id}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                            isChecked
                              ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                              : "bg-slate-50 dark:bg-slate-900/50 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                          } border`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setAssignedStudentIds(prev =>
                                  isChecked ? prev.filter(id => id !== student.id) : [...prev, student.id]
                                );
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <div
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                                isChecked ? "bg-blue-600" : "bg-gray-400"
                              }`}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${isChecked ? "text-blue-900 dark:text-blue-200" : ""}`}>
                                {student.name}
                              </p>
                              <p className="text-[11px] text-muted truncate">@{student.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                              {groupLabel}
                            </span>
                            {isChecked && (
                              <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                                <UserCheck size={14} /> Asignado
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t pt-4 mt-4" style={{ borderColor: "var(--border-color)", flexShrink: 0 }}>
              <div className="text-xs text-muted">
                {assignedStudentIds.length} estudiante(s) seleccionado(s)
              </div>
              <div className="flex items-center gap-3">
                <button className="btn btn-secondary" onClick={() => setAssigningTask(null)}>Cancelar</button>
                <button
                  className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  disabled={savingAssign || loadingAssign}
                  onClick={saveAssignedStudents}
                >
                  {savingAssign ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Guardando...
                    </>
                  ) : assignSaved ? (
                    <>
                      <CheckCircle size={16} /> ¡Guardado!
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Guardar Asignaciones
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
