"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardList, Plus, Pencil, X, Save, Loader2, CheckCircle, Clock, AlertCircle, AlertTriangle, Users, Search, UserCheck, ArrowLeft, Sparkles } from "lucide-react";
import TaskActions from "./TaskActions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import { createPortal } from "react-dom";
import { getTaskDeadlineStatus } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";

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
    fileUrl?: string | null;
    allowLateSubmission?: boolean;
    lateSubmissionUntil?: string | null;
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
  const toast = useToast();
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const hasFiltersApplied = selectedTheme !== "" || selectedPeriod !== "";

  // Manual Grading Modal state
  const [gradingTask, setGradingTask] = useState<Task | null>(null);
  const [gradingStudents, setGradingStudents] = useState<StudentGradeEntry[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [initialGradeInputs, setInitialGradeInputs] = useState<Record<string, string>>({});
  const [initialFeedbackInputs, setInitialFeedbackInputs] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradingError, setGradingError] = useState("");
  const [gradingSaved, setGradingSaved] = useState(false);
  const [gradingSearch, setGradingSearch] = useState("");
  const [gradingStatusFilter, setGradingStatusFilter] = useState<"ALL" | "GRADED" | "SUBMITTED" | "PENDING">("ALL");
  const [bulkGradeValue, setBulkGradeValue] = useState("");
  const [gradingActiveGroupId, setGradingActiveGroupId] = useState<string>("all");
  const [gradingAvailableGroups, setGradingAvailableGroups] = useState<{ id: string; name: string; gradeName?: string; label?: string }[]>([]);

  const hasUnsavedGradingChanges = useMemo(() => {
    if (!gradingTask) return false;
    const gradeChanged = Object.keys(gradeInputs).some(id => (gradeInputs[id] ?? "") !== (initialGradeInputs[id] ?? ""));
    const feedbackChanged = Object.keys(feedbackInputs).some(id => (feedbackInputs[id] ?? "") !== (initialFeedbackInputs[id] ?? ""));
    return gradeChanged || feedbackChanged;
  }, [gradingTask, gradeInputs, feedbackInputs, initialGradeInputs, initialFeedbackInputs]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedGradingChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedGradingChanges]);

  // Block ALL in-app link navigation while there are unsaved grading changes
  useEffect(() => {
    if (!hasUnsavedGradingChanges) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link && link.href && !link.href.startsWith("javascript") && !link.href.includes("#")) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          e.stopPropagation();
          toast.warning(
            "¡Calificaciones sin guardar!",
            "Guarda las calificaciones antes de navegar a otra sección de la plataforma."
          );
        }
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [hasUnsavedGradingChanges, toast]);

  const calificarTaskIdParam = searchParams.get("calificarTaskId");
  useEffect(() => {
    if (calificarTaskIdParam && (!gradingTask || gradingTask.id !== calificarTaskIdParam)) {
      const targetG = searchParams.get("groupId") || undefined;
      openGradingModal({ id: calificarTaskIdParam, title: "Cargando actividad...", dueDate: new Date() }, targetG);
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
      const res = await fetch(`/api/docente/tareas/${task.id}/assign`);
      const data = await res.json();
      if (res.ok) {
        setAvailableStudents(data.students || []);
        setAssignedStudentIds(data.assignedStudentIds || []);
      } else {
        setAssignError(data.error || "Error al cargar estudiantes");
      }
    } catch {
      setAssignError("Error de conexión");
    } finally {
      setLoadingAssign(false);
    }
  };

  const toggleStudentAssignment = (studentId: string) => {
    setAssignedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const saveAssignedStudents = async () => {
    if (!assigningTask) return;
    setSavingAssign(true);
    setAssignError("");
    setAssignSaved(false);
    try {
      const res = await fetch(`/api/docente/tareas/${assigningTask.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: assignedStudentIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignSaved(true);
        setTimeout(() => setAssignSaved(false), 2500);
        router.refresh();
      } else {
        setAssignError(data.error || "Error al guardar asignaciones");
      }
    } catch {
      setAssignError("Error de conexión");
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

  // ── Manual Grading Handlers ─────────────────────────────────────────────────
  const openGradingModal = async (task: { id: string; title?: string; type?: string; dueDate?: string | Date }, targetGroupId?: string) => {
    const paramGroupId = searchParams.get("groupId");
    const gId = targetGroupId !== undefined ? targetGroupId : (paramGroupId || "all");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("calificarTaskId", task.id);
      if (gId && gId !== "all") {
        params.set("groupId", gId);
      } else {
        params.delete("groupId");
      }
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }

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
        setSelectedStudentIds([]); // Safely start unselected; user activates per-student with checkbox
        if (data.groups) {
          setGradingAvailableGroups(data.groups);
        }
        setGradingTask(prev => ({
          id: task.id,
          title: data.taskTitle || prev?.title || task.title || "Actividad",
          type: data.taskType || prev?.type || "TASK",
          dueDate: data.dueDate || prev?.dueDate || new Date(),
          allowLateSubmission: data.allowLateSubmission,
          lateSubmissionUntil: data.lateSubmissionUntil,
          isExternal: data.isExternal,
        } as Task));

        const taskInfo = {
          dueDate: data.dueDate || task.dueDate || new Date(),
          allowLateSubmission: data.allowLateSubmission ?? false,
          lateSubmissionUntil: data.lateSubmissionUntil,
          type: data.taskType || task.type || "TASK",
        };

        const inputs: Record<string, string> = {};
        const fInputs: Record<string, string> = {};
        data.students.forEach((s: StudentGradeEntry) => {
          const sub = s.submission;
          // Only treat as submitted if there's an actual file or explicit SUBMITTED status.
          // GRADED alone (no fileUrl) = docente graded without student delivering anything.
          const hasActualSubmission = !!sub && (sub.status === "SUBMITTED" || !!(sub as any).fileUrl);
          const { isClosed } = getTaskDeadlineStatus(taskInfo, sub as any);
          const isOverdueWithoutSubmission = !data.isExternal && isClosed && !hasActualSubmission;

          if (sub?.grade != null) {
            inputs[s.id] = String(sub.grade);
          } else if (isOverdueWithoutSubmission) {
            inputs[s.id] = "1.0";
          } else {
            inputs[s.id] = "";
          }

          if (sub?.feedback) {
            fInputs[s.id] = sub.feedback;
          } else if (isOverdueWithoutSubmission) {
            fInputs[s.id] = "Actividad no entregada dentro del plazo establecido.";
          } else {
            fInputs[s.id] = "";
          }
        });
        setGradeInputs(inputs);
        setFeedbackInputs(fInputs);
        setInitialGradeInputs(inputs);
        setInitialFeedbackInputs(fInputs);
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
    if (hasUnsavedGradingChanges) {
      toast.warning(
        "¡Calificaciones sin guardar!",
        "Tienes notas modificadas pendientes de guardar en este grupo. Guarda las calificaciones antes de cambiar de grupo."
      );
      return;
    }
    openGradingModal(gradingTask, newGroupId);
  };

  const closeGrading = () => {
    if (hasUnsavedGradingChanges) {
      toast.warning(
        "¡Calificaciones sin guardar!",
        "Has modificado notas o comentarios. Debes presionar 'Guardar Calificaciones' para guardar los cambios antes de salir."
      );
      return;
    }
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

  const toggleStudentSelection = (studentId: string) => {
    // Only one student can be activated at a time for safety
    setSelectedStudentIds(prev => (prev.includes(studentId) ? [] : [studentId]));
  };

  const toggleSelectAllFiltered = (filteredIds: string[]) => {
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const applyBulkGrade = () => {
    const num = parseFloat(bulkGradeValue);
    if (isNaN(num) || num < 1.0 || num > 5.0) {
      toast.warning("Calificación inválida", "Por favor ingresa un valor entre 1.0 y 5.0");
      return;
    }
    const formatted = num.toFixed(1);
    const targetStudents = gradingStudents.filter(s => selectedStudentIds.includes(s.id));
    if (targetStudents.length === 0) {
      toast.warning("Sin selección", "Selecciona al menos un estudiante con el checkbox para aplicar la calificación.");
      return;
    }
    setGradeInputs(prev => {
      const updated = { ...prev };
      targetStudents.forEach(s => {
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
    // Save all students who have any grade or feedback entered
    const targetStudents = gradingStudents.filter(
      s => (gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "") || (feedbackInputs[s.id] !== undefined && feedbackInputs[s.id] !== "")
    );
    if (targetStudents.length === 0) {
      toast.warning("Nada que guardar", "No hay calificaciones ingresadas para guardar.");
      return;
    }
    setSavingGrades(true);
    setGradingError("");
    setGradingSaved(false);
    try {
      const promises = targetStudents
        .map(s =>
          fetch("/api/docente/calificar", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: gradingTask.id,
              studentId: s.id,
              grade: gradeInputs[s.id] !== "" && gradeInputs[s.id] !== undefined ? Number(gradeInputs[s.id]) : undefined,
              feedback: feedbackInputs[s.id] !== undefined ? feedbackInputs[s.id] : undefined,
            }),
          })
        );
      await Promise.all(promises);
      setInitialGradeInputs({ ...gradeInputs });
      setInitialFeedbackInputs({ ...feedbackInputs });
      setSelectedStudentIds([]);
      setGradingSaved(true);
      setTimeout(() => setGradingSaved(false), 2500);
      router.refresh();
      toast.success("¡Calificaciones guardadas!", "Todas las notas fueron registradas correctamente.");
    } catch {
      setGradingError("Error al guardar calificaciones");
      toast.error("Error al guardar", "No se pudieron guardar las calificaciones. Intenta de nuevo.");
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
      // Always keep actively selected student visible so they never disappear or get blocked while editing
      if (selectedStudentIds.includes(s.id)) return true;

      const hasInitialGrade = s.submission?.grade != null || s.submission?.status === "GRADED";
      if (gradingStatusFilter === "GRADED") return hasInitialGrade || (gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "");
      if (gradingStatusFilter === "SUBMITTED") return (s.submission?.status === "SUBMITTED" || (s.submission as any)?.fileUrl) && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PENDING") return !hasInitialGrade && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      return true;
    });

    const taskCourse = courses.find(c => c.tasks.some(t => t.id === gradingTask.id));
    const activeGroupObj = gradingAvailableGroups.find(g => g.id === gradingActiveGroupId);
    const groupGradeBadge = activeGroupObj?.gradeName && activeGroupObj?.name
      ? `Grado ${activeGroupObj.gradeName} — Grupo ${activeGroupObj.name}`
      : activeGroupObj?.name
      ? `Grupo ${activeGroupObj.name}`
      : "";

    return (
      <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 60px - 4rem)', minHeight: '580px' }}>
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
                <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-xs uppercase tracking-wider ${
                  gradingTask.type === "EXAM" || gradingTask.type === "TASK_SABER"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                    : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
                }`}>
                  {gradingTask.type === "EXAM" ? "Examen — Saber" : gradingTask.type === "TASK_SABER" ? "Tarea — Saber" : "Tarea — Hacer"}
                </span>
                {groupGradeBadge && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    🎓 {groupGradeBadge}
                  </span>
                )}
                <span className="text-xs text-muted font-semibold">
                  {taskCourse?.name ? `${taskCourse.name} • ` : ""}{gradingTask.period}
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
                <Pencil size={22} className="text-[#f98012]" />
                {gradingTask.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedGradingChanges && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 px-3 py-2 rounded-xl animate-pulse shadow-xs">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Cambios sin guardar</span>
              </div>
            )}
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

            {/* Selection Quick Actions */}
            {selectedStudentIds.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="text-xs font-bold text-orange-800 dark:text-orange-300">
                  Editando a: <strong>{gradingStudents.find(s => s.id === selectedStudentIds[0])?.name}</strong>
                </span>
                <span className="text-orange-300 dark:text-orange-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs font-bold text-orange-600 hover:text-orange-800 dark:hover:text-orange-200 underline"
                >
                  Bloquear
                </button>
              </div>
            )}

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

        </div>

        {/* Main Students List / Table */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
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
                    <th className="py-3.5 px-4 w-14 text-center">No.</th>
                    <th className="py-3.5 px-4 min-w-[220px]">
                      <span>Estudiante</span>
                    </th>
                    <th className="py-3.5 px-4 min-w-[170px]">Estado de Entrega</th>
                    <th className="py-3.5 px-6 w-44 text-center whitespace-nowrap">Calificación (1–5)</th>
                    <th className="py-3.5 px-6 min-w-[340px]">Retroalimentación / Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                  {filteredStudents.map((student, idx) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    const gradeVal = gradeInputs[student.id] ?? "";
                    const numGrade = parseFloat(gradeVal);
                    const hasValidGrade = !isNaN(numGrade) && numGrade >= 1.0 && numGrade <= 5.0;

                    return (
                      <tr
                        key={student.id}
                        className={`transition-all ${
                          isSelected
                            ? "bg-orange-50/50 dark:bg-orange-950/20 border-l-4 border-l-[#f98012] shadow-sm font-medium"
                            : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40 border-l-4 border-l-transparent"
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3.5 px-4 text-center font-bold text-xs text-muted">
                          {idx + 1}
                        </td>

                        {/* Student Name & Avatar with Checkbox */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012] shrink-0"
                              title={isSelected ? "Estudiante activado para calificar (clic para desactivar)" : "Activar checkbox para calificar a este estudiante"}
                            />
                            <div
                              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                              style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold leading-tight truncate text-gray-900 dark:text-gray-100">
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
                                {isSelected ? (
                                  <>
                                    <a
                                      href={(student.submission as any).fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs cursor-pointer"
                                      title="Ver archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      Ver Archivo
                                    </a>
                                    <a
                                      href={(student.submission as any).fileUrl}
                                      download
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer"
                                      title="Descargar archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </a>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed select-none opacity-60"
                                      title="Activa la casilla del estudiante para ver el archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      Ver Archivo
                                    </button>
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed select-none opacity-60"
                                      title="Activa la casilla del estudiante para descargar el archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Grade Input */}
                        <td className="py-3.5 px-6 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            disabled={!isSelected}
                            value={gradeVal}
                            onChange={e => {
                              let val = e.target.value.replace(',', '.');
                              if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
                              const num = parseFloat(val);
                              if (!isNaN(num) && num > 5.0) return;
                              setGradeInputs(prev => ({ ...prev, [student.id]: val }));
                            }}
                            title={!isSelected ? "Activa la casilla del estudiante para modificar calificación" : undefined}
                            className={`w-24 text-center font-black rounded-xl border py-1.5 text-base outline-none transition-all ${
                              isSelected
                                ? "border-orange-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ring-2 ring-orange-500 shadow-sm"
                                : hasValidGrade
                                ? numGrade < 3.0
                                  ? "border-red-300 text-red-600 bg-red-50/50 dark:bg-red-950/20 shadow-sm"
                                  : numGrade < 4.0
                                  ? "border-amber-300 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                                  : "border-emerald-300 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            }`}
                          />
                        </td>

                        {/* Feedback / Comentario */}
                        <td className="py-3.5 px-6">
                          <input
                            type="text"
                            placeholder={!isSelected ? "Activa la casilla para escribir observación…" : "Comentario u observación opcional para el estudiante…"}
                            disabled={!isSelected}
                            value={feedbackInputs[student.id] ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              setFeedbackInputs(prev => ({ ...prev, [student.id]: val }));
                            }}
                            title={!isSelected ? "Activa la casilla del estudiante para escribir comentario" : undefined}
                            className={`w-full py-1.5 px-3 rounded-xl border text-sm transition-colors ${
                              isSelected
                                ? "border-orange-400 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ring-2 ring-orange-500/50 focus:outline-none"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white placeholder:text-gray-400"
                            }`}
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
        </div>

        {/* Bottom Bar */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-5 py-3 rounded-2xl border shadow-lg flex items-center justify-between gap-4 mt-1" style={{ borderColor: "var(--border-color)" }}>
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



      {/* Assign Specific Students Full-Page View */}
      {assigningTask && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-gray-950 flex flex-col w-screen h-screen overflow-hidden animate-fade-in">
          {/* Top Navigation Header */}
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAssigningTask(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 px-3.5 py-2 rounded-xl transition-all"
              >
                <ArrowLeft size={16} />
                <span>Volver a Tareas</span>
              </button>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
              <div>
                <h1 className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2 leading-tight">
                  <Users size={20} className="text-blue-600" />
                  Activar Actividad por Asistencia en Clase
                </h1>
                <p className="text-xs text-muted font-semibold mt-0.5">
                  {assigningTask.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAssigningTask(null)}
                className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                disabled={savingAssign || loadingAssign}
                onClick={saveAssignedStudents}
              >
                {savingAssign ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Guardando...
                  </>
                ) : assignSaved ? (
                  <>
                    <CheckCircle size={14} /> ¡Guardado!
                  </>
                ) : (
                  <>
                    <Save size={14} /> Guardar Activación
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Full Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 dark:bg-gray-950">
            <div className="max-w-5xl mx-auto flex flex-col gap-5">
              
              {/* Info Notice Box */}
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3 shadow-sm">
                <Sparkles size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <strong className="text-sm">Control de Asistencia para la Actividad</strong>
                  <p>
                    Marca únicamente a los estudiantes que <strong>asistieron a la clase</strong>. Los estudiantes que queden desmarcados tendrán la actividad automáticamente <strong>cerrada con nota 1.0</strong> por inasistencia y no podrán presentarla.
                  </p>
                </div>
              </div>

              {assignError && <div className="alert alert-danger">{assignError}</div>}
              {assignSaved && (
                <div className="alert alert-success flex items-center gap-2">
                  <CheckCircle size={16} /> Asignaciones y activación de estudiantes guardadas correctamente.
                </div>
              )}

              {/* Main Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col gap-4">
                
                {/* Search and Action Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, grado o grupo..."
                      value={assignSearch}
                      onChange={e => setAssignSearch(e.target.value)}
                      className="input-field pl-9 pr-3 text-xs py-2 w-full border border-gray-300 dark:border-gray-750 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = availableStudents.map(s => s.id);
                        setAssignedStudentIds(allIds);
                      }}
                      className="btn btn-secondary text-xs py-2 px-3.5 rounded-xl font-bold whitespace-nowrap"
                    >
                      Activar Todos ({availableStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignedStudentIds([]);
                      }}
                      className="btn btn-secondary text-xs py-2 px-3.5 rounded-xl text-red-600 hover:text-red-700 font-bold whitespace-nowrap"
                    >
                      Desactivar Todos
                    </button>
                  </div>
                </div>

                {/* Counters */}
                <div className="flex items-center justify-between text-xs px-1 text-muted">
                  <span>
                    <strong className="text-blue-600 font-bold">{assignedStudentIds.length}</strong> de <strong>{availableStudents.length}</strong> estudiantes activados (presentes)
                  </span>
                  {availableStudents.length - assignedStudentIds.length > 0 && assignedStudentIds.length > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                      {availableStudents.length - assignedStudentIds.length} estudiante(s) quedarán con nota 1.0 (ausentes)
                    </span>
                  )}
                </div>

                {/* Students Grid */}
                {loadingAssign ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="animate-spin text-blue-600" size={36} />
                  </div>
                ) : availableStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted text-sm">No hay estudiantes disponibles en los grupos de esta tarea.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
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
                            className={`flex items-center justify-between gap-2.5 p-3 rounded-xl cursor-pointer transition-all border select-none ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-sm"
                                : "bg-slate-50 dark:bg-slate-900/50 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300"
                            }`}
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
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                              />
                              <div
                                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                                  isChecked ? "bg-blue-600" : "bg-gray-400"
                                }`}
                              >
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-semibold text-xs truncate ${isChecked ? "text-blue-900 dark:text-blue-200" : "text-gray-800 dark:text-gray-200"}`}>
                                  {student.name}
                                </p>
                                <p className="text-[10px] text-muted truncate">@{student.username}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">
                                {groupLabel}
                              </span>
                              {isChecked ? (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                                  <UserCheck size={12} /> Presente
                                </span>
                              ) : (
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                                  Ausente (1.0)
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}

                {/* Bottom Card Footer */}
                <div className="flex items-center justify-between pt-5 mt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-xs text-muted">
                    {assignedStudentIds.length} estudiante(s) activado(s)
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="btn btn-secondary text-xs px-4 py-2 rounded-xl" onClick={() => setAssigningTask(null)}>Cancelar</button>
                    <button
                      className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2 rounded-xl flex items-center gap-2"
                      disabled={savingAssign || loadingAssign}
                      onClick={saveAssignedStudents}
                    >
                      {savingAssign ? (
                        <>
                          <Loader2 className="animate-spin" size={14} /> Guardando...
                        </>
                      ) : assignSaved ? (
                        <>
                          <CheckCircle size={14} /> ¡Guardado!
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Guardar Activación
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </main>
        </div>,
        document.body
      )}
    </div>
  );
}
