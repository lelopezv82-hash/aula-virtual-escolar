"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  Gamepad2, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  Search, 
  Filter,
  ArrowRight
} from "lucide-react";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";

export interface SerializedTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  courseId: string;
  dueDate: string;
  publishAt: string | null;
  attachmentUrl: string | null;
  interactiveUrl?: string | null;
  isExternal: boolean;
  allowLateSubmission: boolean;
  lateSubmissionUntil: string | null;
  period: string | null;
  createdAt: string;
  course: {
    id: string;
    name: string;
  };
  assignedStudents: { id: string }[];
  submissions: {
    id: string;
    studentId: string;
    status: string;
    grade: number | null;
    feedback: string | null;
    fileUrl: string | null;
    fileUrls?: any;
    answers?: any;
    submittedAt: string | null;
    allowLateSubmission: boolean;
    lateSubmissionUntil: string | null;
  }[];
}

interface TareasClientProps {
  tasks: SerializedTask[];
  studentId: string;
}

export default function TareasClient({ tasks, studentId }: TareasClientProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "graded" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const now = new Date();

  // Helper to determine status and grade of each task
  const getTaskStatus = (task: SerializedTask) => {
    const submission = task.submissions[0];
    const isTaskSaber = task.type === "TASK_SABER" || task.type === "SABER";
    const isInteractive = task.type === "INTERACTIVE" || !!task.interactiveUrl || (!!task.attachmentUrl && (task.attachmentUrl.includes(".html") || task.attachmentUrl.includes("/activities/")));

    const { activeDeadline, hasExtension, isClosed, isLate } = getTaskDeadlineStatus(
      {
        dueDate: task.dueDate,
        allowLateSubmission: task.allowLateSubmission,
        lateSubmissionUntil: task.lateSubmissionUntil,
        type: task.type,
      },
      submission ? {
        allowLateSubmission: submission.allowLateSubmission,
        lateSubmissionUntil: submission.lateSubmissionUntil,
      } : undefined
    );

    const hasRealTeacherGrade = submission?.grade !== null && submission?.grade !== undefined;
    const isNotActivated = !task.assignedStudents.some(s => s.id === studentId) && !submission?.allowLateSubmission && !hasRealTeacherGrade;
    const isOverdue = isClosed || (task.dueDate && now > new Date(task.dueDate));

    const isInteractiveSubmitted = isInteractive && !!(submission && (submission.grade !== null && submission.grade !== undefined || submission.status === "GRADED"));
    const isStandardSubmitted = !isInteractive && (
      task.isExternal ||
      (submission && (submission.status === "SUBMITTED" || submission.status === "GRADED" || !!(submission.fileUrl && submission.fileUrl.trim() !== "")))
    );

    const isSubmitted = isInteractive ? isInteractiveSubmitted : isStandardSubmitted;
    const virtualGraded = !task.isExternal && ((!submission && isOverdue) || (submission && submission.status === "PENDING" && isOverdue && !hasRealTeacherGrade));

    const activeStatus = isInteractive
      ? (isInteractiveSubmitted ? "GRADED" : (virtualGraded ? "GRADED" : null))
      : (isStandardSubmitted
        ? (submission?.status === "GRADED" || hasRealTeacherGrade ? "GRADED" : "SUBMITTED")
        : (virtualGraded ? "GRADED" : (submission?.status || null)));

    const activeGrade = isInteractive
      ? (isInteractiveSubmitted ? submission?.grade ?? null : (virtualGraded ? 1.0 : null))
      : (hasRealTeacherGrade
        ? submission!.grade!
        : (virtualGraded ? 1.0 : null));

    const isFinalInteractive = isInteractive && !!((submission?.answers as any)?.isFinal || (activeGrade !== null && activeGrade >= 5.0));

    // Determine if it should be displayed in pending vs completed
    // Interactive tasks in progress (active with a grade < 5.0 and not overdue) are available in Pending so the student can keep improving!
    const isPending = isNotActivated 
      ? false 
      : isInteractive
      ? (!isOverdue && !isFinalInteractive)
      : (!isSubmitted && !virtualGraded);

    const isGraded = activeStatus === "GRADED" || isNotActivated;
    const isCompleted = isSubmitted || isGraded || virtualGraded;

    const neverSubmitted = !submission || (submission.status === "PENDING" && !hasRealTeacherGrade && !isInteractiveSubmitted);
    const gradeReason = isNotActivated
      ? "No asistió a clase"
      : (virtualGraded && neverSubmitted ? "No entregado (plazo vencido)" : null);

    const leftBorderColor = isGraded && activeGrade !== null
      ? (Number(activeGrade) < 3.0 ? "var(--danger)" : "var(--success)")
      : isSubmitted
      ? "var(--success)"
      : isLate
      ? "var(--danger)"
      : isInteractive
      ? "#9333ea"
      : isTaskSaber
      ? "#8b5cf6"
      : "var(--primary-color)";

    const gradeColor = (activeGrade !== null && Number(activeGrade) >= 3) ? "var(--success)" : "var(--danger)";

    return {
      submission,
      isTaskSaber,
      isInteractive,
      activeDeadline,
      hasExtension,
      isClosed,
      isLate,
      isOverdue,
      isNotActivated,
      isSubmitted,
      isGraded,
      isPending,
      isCompleted,
      isFinalInteractive,
      virtualGraded,
      activeGrade: isNotActivated ? 1.0 : activeGrade,
      gradeReason,
      leftBorderColor,
      gradeColor,
    };
  };

  // Filter tasks based on activeTab, search, and type
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const status = getTaskStatus(task);

      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesCourse = task.course.name.toLowerCase().includes(query);
        const matchesDesc = task.description ? task.description.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesCourse && !matchesDesc) return false;
      }

      if (selectedType !== "all") {
        if (selectedType === "INTERACTIVE" && !status.isInteractive) return false;
        if (selectedType === "TASK" && (status.isInteractive || status.isTaskSaber)) return false;
        if (selectedType === "SABER" && !status.isTaskSaber) return false;
      }

      if (activeTab === "pending") {
        return status.isPending;
      }
      if (activeTab === "graded") {
        return status.isGraded || status.isSubmitted;
      }

      return true;
    });
  }, [tasks, activeTab, searchTerm, selectedType]);

  const pendingCount = useMemo(() => {
    return tasks.filter(t => getTaskStatus(t).isPending).length;
  }, [tasks]);

  const gradedCount = useMemo(() => {
    return tasks.filter(t => {
      const s = getTaskStatus(t);
      return s.isGraded || s.isSubmitted;
    }).length;
  }, [tasks]);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Header */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Actividades y Tareas</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Revisa tus asignaciones, avances y calificaciones en tiempo real.</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 self-start md:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Pendientes y En Curso</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"}`}>
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("graded")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "graded"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Calificadas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "graded" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"}`}>
              {gradedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Todas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
              {tasks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título o materia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
            <Filter size={13} /> Tipo:
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-hidden"
          >
            <option value="all">Todos los tipos</option>
            <option value="INTERACTIVE">🎮 Interactivas</option>
            <option value="TASK">📋 Tareas (Hacer)</option>
            <option value="SABER">📖 Saber</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex flex-col gap-4">
        {filteredTasks.length === 0 ? (
          <div className="card text-center py-12 text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-40 text-slate-400" />
            <p className="font-semibold text-base">No hay actividades para mostrar en este filtro.</p>
            <p className="text-xs text-slate-400 mt-1">Cambia de pestaña o modifica los criterios de búsqueda.</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const status = getTaskStatus(task);
            const { 
              submission, 
              isTaskSaber, 
              isInteractive, 
              activeDeadline, 
              hasExtension, 
              isClosed, 
              isLate, 
              isNotActivated, 
              isSubmitted, 
              isGraded, 
              activeGrade, 
              gradeReason, 
              leftBorderColor, 
              gradeColor 
            } = status;

            return (
              <div 
                key={task.id}
                style={{
                  background: "var(--bg-primary)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1.25rem",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-lg)",
                  border: `1px solid var(--border-color)`,
                  borderLeft: `5px solid ${leftBorderColor}`,
                  boxShadow: "var(--shadow-sm)",
                }}
                className="flex-col sm:flex-row transition-all hover:shadow-md"
              >
                {/* Left: Info */}
                <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", background: "#f3f4f6", borderRadius: "6px", color: "#4b5563" }}>
                      {task.course.name}
                    </span>

                    {isInteractive ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }} className="flex items-center gap-1">
                        <Gamepad2 size={13} /> Actividad Interactiva (Hacer)
                      </span>
                    ) : isTaskSaber ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }}>
                        📖 Saber (Cognitivo)
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" }}>
                        📋 Hacer (Procedimental)
                      </span>
                    )}

                    {task.isExternal ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
                        📁 Entrega en clase
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#f0f9ff", color: "#0369a1", border: "1px solid #b9e6fe" }}>
                        💻 Entrega en plataforma
                      </span>
                    )}

                    {/* Status badges */}
                    {isInteractive && activeGrade !== null && !status.isOverdue && !status.isFinalInteractive ? (
                      <span className="badge flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-200">
                        <Sparkles size={12} className="text-purple-600" /> Avance guardado · Nota: {Number(activeGrade).toFixed(1)}
                      </span>
                    ) : isGraded ? (
                      <span className={`badge flex items-center gap-1 ${gradeReason ? 'badge-danger' : 'badge-success'}`}>
                        <CheckCircle size={12} /> Calificada
                      </span>
                    ) : isSubmitted && !isGraded ? (
                      <span className="badge badge-info flex items-center gap-1">
                        <Clock size={12} /> Entregada
                      </span>
                    ) : !isSubmitted && isLate ? (
                      <span className="badge badge-danger">Atrasada</span>
                    ) : null}

                    {gradeReason && (
                      <span className="text-xs text-red-500 dark:text-red-400 font-semibold">
                        — {gradeReason}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontWeight: 800, fontSize: "1.15rem", margin: "0 0 0.35rem", color: "var(--primary-color)" }}>
                    {task.title}
                  </h3>

                  {task.description && (
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 0.5rem 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Instrucciones: </span>
                      {task.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()}
                    </p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                    <Clock size={13} className="shrink-0" />
                    {activeDeadline && new Date(activeDeadline).getFullYear() < 9000 && (
                      <span>Vence: <strong>{formatToColombiaString(activeDeadline)}</strong> {hasExtension && "(Prórroga Activa)"}</span>
                    )}
                    {task.period && <span>· Periodo: {task.period}</span>}
                  </div>

                  {submission?.submittedAt && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "#16a34a", marginTop: "0.4rem", fontWeight: 600, flexWrap: "wrap" }}>
                      <CheckCircle size={13} />
                      <span>{isInteractive ? "Último registro:" : "Entregada el:"} {new Date(submission.submittedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {submission.fileUrl && (
                        <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 600, marginLeft: "0.5rem", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          📎 Ver archivo
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Grade badge + action */}
                <div 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    justifyContent: "center",
                    gap: "0.5rem", 
                    minWidth: "140px", 
                    textAlign: "center" 
                  }}
                  className="w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0"
                >
                  {/* Grade display if exists */}
                  {activeGrade !== null ? (
                    <div className="flex flex-col items-center">
                      <div style={{ fontSize: "2.2rem", fontWeight: 900, color: gradeColor, lineHeight: 1 }}>
                        {Number(activeGrade).toFixed(1)}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                        {isInteractive && !status.isOverdue && !status.isFinalInteractive ? "Nota actual" : "Nota final"}
                      </div>
                    </div>
                  ) : isSubmitted && !isGraded ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Pendiente de revisión
                    </div>
                  ) : null}

                  {/* Action Link */}
                  <Link 
                    href={`/estudiante/tareas/${task.id}`} 
                    className={`btn w-full text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all !text-white hover:!text-white ${
                      isInteractive
                        ? (status.isOverdue && !hasExtension
                            ? "bg-slate-600 hover:bg-slate-700"
                            : activeGrade !== null
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                            : "bg-purple-600 hover:bg-purple-700")
                        : (isSubmitted || isGraded || (isClosed && !hasExtension)
                            ? "bg-slate-600 hover:bg-slate-700"
                            : "btn-primary")
                    }`}
                  >
                    {isInteractive ? (
                      status.isOverdue && !hasExtension ? (
                        <>Ver Detalle <ArrowRight size={13} /></>
                      ) : activeGrade !== null ? (
                        <>Continuar Actividad <ArrowRight size={13} /></>
                      ) : (
                        <>Realizar Actividad <ArrowRight size={13} /></>
                      )
                    ) : task.isExternal ? (
                      isSubmitted ? "Ver Calificación" : "Ver Detalles"
                    ) : (
                      isSubmitted || isGraded ? "Ver Entrega" : "Subir Tarea"
                    )}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
