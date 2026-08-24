"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Plus, Pencil, X, Save, Loader2, CheckCircle, Clock, AlertCircle, Users, Search, UserCheck, ArrowLeft, Sparkles } from "lucide-react";
import TaskActions from "./TaskActions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

const getDesempeno = (g: number) => {
  if (g >= 4.6) return { label: "SUPERIOR", cls: "text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300" };
  if (g >= 4.0) return { label: "ALTO",     cls: "text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300" };
  if (g >= 3.0) return { label: "BÁSICO",   cls: "text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300" };
  return           { label: "BAJO",     cls: "text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300" };
};

export default function TareasDocenteClient({ courses, periods }: { courses: Course[], periods: Period[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [gradingSearch, setGradingSearch] = useState("");
  const [gradingStatusFilter, setGradingStatusFilter] = useState<"ALL" | "GRADED" | "SUBMITTED" | "PENDING">("ALL");
  const [bulkGradeValue, setBulkGradeValue] = useState("");
  const [gradingActiveGroupId, setGradingActiveGroupId] = useState<string>("all");
  const [gradingAvailableGroups, setGradingAvailableGroups] = useState<{ id: string; name: string; gradeName?: string; label?: string }[]>([]);

  const calificarTaskIdParam = searchParams.get("calificarTaskId");
  useEffect(() => {
    if (calificarTaskIdParam && (!gradingTask || gradingTask.id !== calificarTaskIdParam)) {
      openGradingModal({ id: calificarTaskIdParam, title: "Cargando actividad...", dueDate: new Date() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calificarTaskIdParam]);

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

  const openGradingModal = async (task: { id: string; title?: string; dueDate?: any }, targetGroupId?: string) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("calificarTaskId", task.id);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }

    const gId = targetGroupId !== undefined ? targetGroupId : "all";
    setGradingActiveGroupId(gId);
    setGradingTask(task as Task);
    setGradingError("");
    setGradingSaved(false);
    setLoadingStudents(true);
    setGradingStudents([]);
    try {
      const qp = gId && gId !== "all" ? `?groupId=${encodeURIComponent(gId)}` : "";
      const res = await fetch(`/api/docente/tareas/${task.id}/students-grades${qp}`);
      const data = await res.json();
      if (res.ok && data.students) {
        setGradingStudents(data.students);
        if (data.groups) {
          setGradingAvailableGroups(data.groups);
        }
        setGradingTask(prev => ({
          id: task.id,
          title: data.taskTitle || prev?.title || task.title || "Actividad",
          type: data.taskType || prev?.type || "TASK",
          dueDate: prev?.dueDate || new Date()
        }));
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

  const changeGradingGroup = (newGroupId: string) => {
    if (!gradingTask) return;
    openGradingModal(gradingTask, newGroupId);
  };

  const closeGrading = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("calificarTaskId");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    setGradingTask(null);
    setGradingSearch("");
    setBulkGradeValue("");
    router.refresh();
  };

  const applyBulkGrade = () => {
    const num = parseFloat(bulkGradeValue);
    if (isNaN(num) || num < 1.0 || num > 5.0) {
      alert("Por favor ingresa una calificación válida entre 1.0 y 5.0");
      return;
    }
    const formatted = num.toFixed(1);
    setGradeInputs(prev => {
      const updated = { ...prev };
      gradingStudents.forEach(s => {
        if (!updated[s.id] || updated[s.id].trim() === "") {
          updated[s.id] = formatted;
        }
      });
      return updated;
    });
    setBulkGradeValue("");
  };

  const saveManualGrades = async () => {
    if (!gradingTask) return;
    setSavingGrades(true);
    setGradingError("");
    setGradingSaved(false);
    try {
      const promises = gradingStudents
        .filter(s => gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "")
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

  // ── Full-Screen Manual Grading View ─────────────────────────────────────────
  if (gradingTask) {
    const totalCount = gradingStudents.length;
    const gradedCount = gradingStudents.filter(s => gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "").length;
    const pendingCount = totalCount - gradedCount;
    
    // Average
    const validGrades = gradingStudents
      .map(s => parseFloat(gradeInputs[s.id] || ""))
      .filter(g => !isNaN(g) && g >= 1.0 && g <= 5.0);
    const averageGrade = validGrades.length > 0
      ? (validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(2)
      : null;

    const filteredStudents = gradingStudents.filter(s => {
      const q = gradingSearch.toLowerCase().trim();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || (s.groupName && s.groupName.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (gradingStatusFilter === "GRADED") return gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "";
      if (gradingStatusFilter === "SUBMITTED") return (s.submission?.status === "SUBMITTED" || (s.submission as any)?.fileUrl) && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PENDING") return !gradeInputs[s.id] || gradeInputs[s.id] === "";
      return true;
    });

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-24">
        {/* Top Header & Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-sm" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-4">
            <button
              onClick={closeGrading}
              className="p-2.5 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-700 dark:text-gray-200 flex items-center gap-2 font-semibold text-sm shadow-sm"
              style={{ borderColor: "var(--border-color)" }}
              title="Volver a la lista de tareas"
            >
              <ArrowLeft size={18} />
              <span>Volver a Tareas</span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full font-extrabold text-xs uppercase tracking-wider bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                  {gradingTask.type === "EXAM" ? "Examen — Saber" : "Tarea — Hacer"}
                </span>
                {gradingTask.period && (
                  <span className="text-xs text-muted font-medium">
                    {gradingTask.period}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
                <Pencil size={22} className="text-[#f98012]" />
                {gradingTask.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={closeGrading}
              className="btn btn-secondary text-sm font-semibold"
            >
              Volver a Tareas
            </button>
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents}
              className={`btn ${gradingSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "btn-primary"} px-5 py-2.5 font-bold shadow-md flex items-center gap-2`}
            >
              {savingGrades ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Guardando...
                </>
              ) : gradingSaved ? (
                <>
                  <CheckCircle size={18} />
                  ¡Guardado con Éxito!
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Calificaciones
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {gradingSaved && (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-4 py-3 rounded-xl animate-fade-in shadow-sm">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            ¡Todas las calificaciones y comentarios fueron guardados correctamente en el sistema!
          </div>
        )}
        {gradingError && (
          <div className="alert alert-danger font-semibold text-sm">
            {gradingError}
          </div>
        )}

        {/* KPI / Stats Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex items-center gap-3 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Total Estudiantes</p>
              <p className="text-xl font-black">{totalCount}</p>
            </div>
          </div>

          <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex items-center gap-3 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Calificados</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{gradedCount} / {totalCount}</p>
            </div>
          </div>

          <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex items-center gap-3 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Pendientes</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
            </div>
          </div>

          <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex items-center gap-3 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Promedio Actual</p>
              <p className="text-xl font-black text-purple-600 dark:text-purple-400">{averageGrade ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters Card */}
        <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-4 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 flex-1 min-w-[260px] flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre de estudiante o grupo..."
                value={gradingSearch}
                onChange={e => setGradingSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ borderColor: "var(--border-color)" }}
              />
              {gradingSearch && (
                <button
                  onClick={() => setGradingSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              {[
                { key: "ALL", label: "Todos" },
                { key: "PENDING", label: `Pendientes (${pendingCount})` },
                { key: "GRADED", label: `Calificados (${gradedCount})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setGradingStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    gradingStatusFilter === tab.key
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {gradingAvailableGroups.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[11px] font-bold text-muted px-2">Grupo:</span>
                <button
                  onClick={() => changeGradingGroup("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    gradingActiveGroupId === "all"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Todos ({gradingAvailableGroups.length})
                </button>
                {gradingAvailableGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => changeGradingGroup(g.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      gradingActiveGroupId === g.id
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick bulk grade tool */}
          <div className="flex items-center gap-2 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 p-1.5 rounded-xl">
            <span className="text-xs font-bold text-orange-800 dark:text-orange-300 pl-2">Nota para pendientes:</span>
            <input
              type="number"
              min="1.0"
              max="5.0"
              step="0.1"
              placeholder="5.0"
              value={bulkGradeValue}
              onChange={e => setBulkGradeValue(e.target.value)}
              className="w-16 text-center font-bold text-sm py-1 px-1 rounded-lg border bg-white dark:bg-gray-900"
              style={{ borderColor: "var(--border-color)" }}
            />
            <button
              onClick={applyBulkGrade}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* Main Students List / Table */}
        <div className="card rounded-2xl border shadow-sm bg-white dark:bg-gray-900 overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-[#f98012]" size={40} />
              <p className="text-sm font-semibold text-muted">Cargando lista de estudiantes...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-20 px-4">
              <p className="text-muted font-medium text-base">No se encontraron estudiantes para los filtros seleccionados.</p>
              {(gradingSearch || gradingStatusFilter !== "ALL") && (
                <button
                  onClick={() => { setGradingSearch(""); setGradingStatusFilter("ALL"); }}
                  className="mt-3 text-xs font-bold text-[#f98012] underline hover:no-underline"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80 dark:bg-gray-800/60 text-xs font-bold uppercase tracking-wider text-muted" style={{ borderColor: "var(--border-color)" }}>
                    <th className="py-3.5 px-4 w-12 text-center">No.</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Estudiante</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Estado de Entrega</th>
                    <th className="py-3.5 px-4 w-32 text-center">Calificación (1–5)</th>
                    <th className="py-3.5 px-4 w-28 text-center">Desempeño</th>
                    <th className="py-3.5 px-4 min-w-[280px]">Retroalimentación / Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                  {filteredStudents.map((student, idx) => {
                    const gradeVal = gradeInputs[student.id] ?? "";
                    const numGrade = parseFloat(gradeVal);
                    const hasValidGrade = !isNaN(numGrade) && numGrade >= 1.0 && numGrade <= 5.0;
                    const desemp = hasValidGrade ? getDesempeno(numGrade) : null;

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors ${
                          hasValidGrade ? "" : "bg-slate-50/30 dark:bg-slate-900/30"
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3.5 px-4 text-center font-bold text-xs text-muted">
                          {idx + 1}
                        </td>

                        {/* Student Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                              style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                                {student.name}
                              </p>
                              <p className="text-xs text-muted mt-0.5 font-medium">{student.groupName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Submission status & attachments */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div>{statusBadge(student.submission)}</div>
                            {student.submission?.submittedAt && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock size={11} className="text-[#f97316]" />
                                <span>{new Date(student.submission.submittedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            )}
                            {(student.submission as any)?.fileUrl && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <a
                                  href={(student.submission as any).fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title="Ver archivo"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                  Ver Archivo
                                </a>
                                <a
                                  href={(student.submission as any).fileUrl}
                                  download
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title="Descargar archivo"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Descargar
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Grade Input */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="number"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            placeholder="—"
                            value={gradeVal}
                            onChange={e => setGradeInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                            className={`w-24 text-center font-black rounded-xl border py-1.5 text-base outline-none focus:ring-2 focus:ring-orange-500 transition-all ${
                              hasValidGrade
                                ? numGrade < 3.0
                                  ? "border-red-300 text-red-600 bg-red-50/50 dark:bg-red-950/20"
                                  : numGrade < 4.0
                                  ? "border-amber-300 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                                  : "border-emerald-300 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                                : "border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800 text-gray-400"
                            }`}
                          />
                        </td>

                        {/* Desempeño */}
                        <td className="py-3.5 px-4 text-center">
                          {desemp ? (
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${desemp.cls}`}>
                              {desemp.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted font-semibold">—</span>
                          )}
                        </td>

                        {/* Feedback / Comentario */}
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            placeholder="Comentario u observación opcional para el estudiante…"
                            value={feedbackInputs[student.id] ?? ""}
                            onChange={e => setFeedbackInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                            className="w-full py-1.5 px-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                            style={{ borderColor: "var(--border-color)" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky Bottom Bar for fast saving */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-6 py-3 rounded-2xl border shadow-xl flex items-center gap-6" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 text-xs font-bold text-muted">
            <span>Calificados: <strong className="text-emerald-600 text-sm">{gradedCount}</strong>/{totalCount}</span>
            <span>•</span>
            <span>Pendientes: <strong className="text-amber-600 text-sm">{pendingCount}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={closeGrading}
              className="btn btn-secondary py-2 px-4 text-xs font-bold"
            >
              Volver a Tareas
            </button>
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents}
              className={`btn ${gradingSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "btn-primary"} py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md`}
            >
              {savingGrades ? (
                <>
                  <Loader2 className="animate-spin" size={15} />
                  Guardando...
                </>
              ) : gradingSaved ? (
                <>
                  <CheckCircle size={15} />
                  ¡Guardado!
                </>
              ) : (
                <>
                  <Save size={15} />
                  Guardar Calificaciones
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
