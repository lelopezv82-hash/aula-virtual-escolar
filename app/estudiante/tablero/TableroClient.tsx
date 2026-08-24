"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ClipboardList,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  UserCheck,
  Check,
  Flame,
  Layers,
  CalendarDays,
  Sparkles,
  ExternalLink,
  GraduationCap,
  Download,
  Paperclip
} from "lucide-react";

export interface TableroTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  publishAt: string | null;
  type: string;
  weight: number;
  period: string | null;
  courseId: string;
  courseName: string;
  teacherName: string;
  attachmentUrl?: string | null;
  resources?: { id: string; title: string; type: string; url: string; }[];
  isExternal: boolean;
  allowLateSubmission: boolean;
  lateSubmissionUntil: string | null;
  isIndividuallyAssigned: boolean;
  submission: {
    id: string;
    status: string;
    grade: number | null;
    submittedAt: string | null;
    startedAt: string | null;
    attempt: number;
  } | null;
}

export interface CourseOption {
  id: string;
  name: string;
}

interface TableroClientProps {
  tasks: TableroTask[];
  courses: CourseOption[];
  periods: string[];
  studentName: string;
}

export default function TableroClient({
  tasks,
  courses,
  periods,
  studentName
}: TableroClientProps) {
  const [viewMode, setViewMode] = useState<"timeline" | "calendar">("timeline");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedDayTasks, setSelectedDayTasks] = useState<TableroTask[] | null>(null);
  const [selectedDayString, setSelectedDayString] = useState<string>("");

  const now = new Date();

  // Helper to compute deadline & remaining status
  const getTaskInfo = (task: TableroTask) => {
    const due = new Date(task.dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const isSubmitted = !!(task.submission && task.submission.status !== "PENDING");
    const isLateAllowed = task.allowLateSubmission && task.lateSubmissionUntil && new Date(task.lateSubmissionUntil) > now;
    const isExpired = diffMs < 0 && !isLateAllowed;
    const isDueToday = diffHours > 0 && diffHours <= 24;
    const isUrgent = diffHours > 0 && diffHours <= 48;
    const isGraded = !!(task.submission && (task.submission.status === "GRADED" || task.submission.grade != null)) || (isExpired && !isSubmitted);
    const grade = task.submission?.grade ?? (isExpired && !isSubmitted ? 1.0 : null);

    let timeText = "";
    if (diffMs < 0) {
      const absDays = Math.abs(diffDays);
      timeText = absDays === 0 ? "Venció hoy" : `Venció hace ${absDays} día${absDays > 1 ? "s" : ""}`;
    } else if (diffHours <= 1) {
      const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      timeText = `Quedan ${mins} min`;
    } else if (diffHours <= 24) {
      const hrs = Math.floor(diffHours);
      timeText = `Quedan ${hrs} hora${hrs > 1 ? "s" : ""}`;
    } else {
      timeText = `Quedan ${diffDays} día${diffDays > 1 ? "s" : ""}`;
    }

    return {
      due,
      diffMs,
      diffHours,
      diffDays,
      isSubmitted,
      isGraded,
      grade,
      isExpired,
      isDueToday,
      isUrgent,
      timeText
    };
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const info = getTaskInfo(task);

      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesCourse = task.courseName.toLowerCase().includes(query);
        const matchesDesc = task.description ? task.description.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesCourse && !matchesDesc) return false;
      }

      if (selectedCourse !== "all" && task.courseId !== selectedCourse) return false;
      if (selectedType !== "all" && task.type !== selectedType) return false;
      if (selectedPeriod !== "all" && task.period !== selectedPeriod) return false;

      if (selectedStatus === "urgent") {
        return !info.isSubmitted && info.isUrgent;
      }
      if (selectedStatus === "pending") {
        return !info.isSubmitted && !info.isExpired;
      }
      if (selectedStatus === "submitted") {
        return info.isSubmitted;
      }
      if (selectedStatus === "expired") {
        return !info.isSubmitted && info.isExpired;
      }

      return true;
    });
  }, [tasks, searchTerm, selectedCourse, selectedType, selectedPeriod, selectedStatus]);

  // KPIs
  const kpis = useMemo(() => {
    let urgentCount = 0;
    let pendingTasksCount = 0;
    let pendingExamsCount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      const info = getTaskInfo(task);
      if (info.isSubmitted) {
        completedCount++;
      } else {
        if (info.isUrgent && !info.isExpired) urgentCount++;
        if (!info.isExpired) {
          if (task.type === "EXAM") pendingExamsCount++;
          else pendingTasksCount++;
        }
      }
    });

    return {
      urgentCount,
      pendingTasksCount,
      pendingExamsCount,
      completedCount,
      totalCount: tasks.length
    };
  }, [tasks]);

  // Timeline Groups
  const timelineGroups = useMemo(() => {
    const today: TableroTask[] = [];
    const thisWeek: TableroTask[] = [];
    const upcoming: TableroTask[] = [];
    const submitted: TableroTask[] = [];
    const expired: TableroTask[] = [];

    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    filteredTasks.forEach(task => {
      const info = getTaskInfo(task);

      if (info.isSubmitted) {
        submitted.push(task);
      } else if (info.isExpired) {
        expired.push(task);
      } else if (info.isDueToday) {
        today.push(task);
      } else if (info.due <= endOfWeek) {
        thisWeek.push(task);
      } else {
        upcoming.push(task);
      }
    });

    // Sort active ascending by due date
    const sortByDueDateAsc = (a: TableroTask, b: TableroTask) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    today.sort(sortByDueDateAsc);
    thisWeek.sort(sortByDueDateAsc);
    upcoming.sort(sortByDueDateAsc);

    // Sort submitted descending
    submitted.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    expired.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    return { today, thisWeek, upcoming, submitted, expired };
  }, [filteredTasks]);

  // Calendar calculations
  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      dayNumber: number;
      isCurrentMonth: boolean;
      dateString: string;
      tasks: TableroTask[];
    }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dateStr = new Date(year, month - 1, d).toISOString().split("T")[0];
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        dateString: dateStr,
        tasks: []
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const currentD = new Date(year, month, d);
      const dateStr = currentD.toISOString().split("T")[0];
      const dayTasks = tasks.filter(t => {
        try {
          const tDateStr = new Date(t.dueDate).toISOString().split("T")[0];
          return tDateStr === dateStr;
        } catch {
          return false;
        }
      });

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateString: dateStr,
        tasks: dayTasks
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = 42 - days.length;
    if (remaining < 7 && days.length > 35) {
      // Keep 42
    }
    const targetLength = days.length <= 35 ? 35 : 42;
    const toAdd = targetLength - days.length;
    for (let d = 1; d <= toAdd; d++) {
      const dateStr = new Date(year, month + 1, d).toISOString().split("T")[0];
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        dateString: dateStr,
        tasks: []
      });
    }

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return {
      monthName: monthNames[month],
      year,
      days
    };
  }, [calendarDate, tasks]);

  const monthPrev = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };
  const monthNext = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };
  const monthToday = () => {
    setCalendarDate(new Date());
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es-CO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <div className="z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <Sparkles size={12} /> Tablero Virtual del Estudiante
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ¡Hola, {studentName}! 👋
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Aquí puedes ver todas tus tareas y exámenes próximos a realizar, organizados cronológicamente para que nunca te atrases.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="z-10 flex items-center bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "timeline"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Layers size={15} />
            Línea de Tiempo
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "calendar"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <CalendarDays size={15} />
            Calendario
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Urgent Card */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === "urgent" ? "all" : "urgent")}
          className={`cursor-pointer transition-all card p-4 rounded-xl border flex items-center gap-3.5 ${
            selectedStatus === "urgent"
              ? "ring-2 ring-red-500 shadow-md bg-red-50/50 dark:bg-red-950/20"
              : "hover:shadow-md hover:border-red-300"
          }`}
          style={{ borderColor: kpis.urgentCount > 0 ? "#fca5a5" : "var(--border-color)" }}
        >
          <div className={`p-3 rounded-xl ${kpis.urgentCount > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 animate-pulse" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}>
            <Flame size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpis.urgentCount}</div>
            <div className="text-xs font-semibold text-red-600 dark:text-red-400">Por vencer (&lt; 48h)</div>
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === "pending" ? "all" : "pending")}
          className={`cursor-pointer transition-all card p-4 rounded-xl border flex items-center gap-3.5 ${
            selectedStatus === "pending"
              ? "ring-2 ring-blue-500 shadow-md bg-blue-50/50 dark:bg-blue-950/20"
              : "hover:shadow-md hover:border-blue-300"
          }`}
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <FileText size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpis.pendingTasksCount}</div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Tareas Pendientes</div>
          </div>
        </div>

        {/* Pending Exams Card */}
        <div
          onClick={() => setSelectedType(selectedType === "EXAM" ? "all" : "EXAM")}
          className={`cursor-pointer transition-all card p-4 rounded-xl border flex items-center gap-3.5 ${
            selectedType === "EXAM"
              ? "ring-2 ring-orange-500 shadow-md bg-orange-50/50 dark:bg-orange-950/20"
              : "hover:shadow-md hover:border-orange-300"
          }`}
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="p-3 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
            <ClipboardList size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpis.pendingExamsCount}</div>
            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">Exámenes Próximos</div>
          </div>
        </div>

        {/* Completed Card */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === "submitted" ? "all" : "submitted")}
          className={`cursor-pointer transition-all card p-4 rounded-xl border flex items-center gap-3.5 ${
            selectedStatus === "submitted"
              ? "ring-2 ring-emerald-500 shadow-md bg-emerald-50/50 dark:bg-emerald-950/20"
              : "hover:shadow-md hover:border-emerald-300"
          }`}
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpis.completedCount}</div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Entregadas / Listas</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card p-4 rounded-xl border flex flex-wrap items-center gap-3"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Buscar por título o materia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-auto"
          />
        </div>

        {/* Course Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-muted whitespace-nowrap">Materia:</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="input-field text-xs py-1.5 px-2.5 h-auto w-auto max-w-[160px]"
          >
            <option value="all">Todas las materias</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-muted whitespace-nowrap">Tipo:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input-field text-xs py-1.5 px-2.5 h-auto w-auto"
          >
            <option value="all">Todo</option>
            <option value="TASK">Tareas (Hacer)</option>
            <option value="EXAM">Exámenes (Saber)</option>
          </select>
        </div>

        {/* Period Filter */}
        {periods.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-muted whitespace-nowrap">Periodo:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="input-field text-xs py-1.5 px-2.5 h-auto w-auto"
            >
              <option value="all">Todos los periodos</option>
              {periods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reset filters */}
        {(searchTerm || selectedCourse !== "all" || selectedType !== "all" || selectedPeriod !== "all" || selectedStatus !== "all") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCourse("all");
              setSelectedType("all");
              setSelectedPeriod("all");
              setSelectedStatus("all");
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold ml-auto"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Main View Render */}
      {viewMode === "timeline" ? (
        <div className="flex flex-col gap-8">
          {/* Section: Hoy / Muy Urgente */}
          {timelineGroups.today.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Flame size={20} className="animate-bounce" />
                <h2 className="text-lg font-extrabold tracking-tight">Vencen Hoy / Urgentes</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-950 font-bold">
                  {timelineGroups.today.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineGroups.today.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Esta Semana */}
          {timelineGroups.thisWeek.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <CalendarIcon size={20} className="text-blue-600" />
                <h2 className="text-lg font-extrabold tracking-tight">Esta Semana</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-950 font-bold text-blue-700 dark:text-blue-300">
                  {timelineGroups.thisWeek.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineGroups.thisWeek.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Próximas Semanas */}
          {timelineGroups.upcoming.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Clock size={20} className="text-slate-500" />
                <h2 className="text-lg font-extrabold tracking-tight">Más Adelante</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  {timelineGroups.upcoming.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineGroups.upcoming.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Entregadas / Completadas */}
          {timelineGroups.submitted.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={20} />
                <h2 className="text-lg font-extrabold tracking-tight">Entregadas / Completadas</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-950 font-bold text-emerald-700 dark:text-emerald-300">
                  {timelineGroups.submitted.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineGroups.submitted.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Vencidas */}
          {timelineGroups.expired.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-500">
                <AlertTriangle size={20} />
                <h2 className="text-lg font-extrabold tracking-tight">Cerradas / Sin Entrega</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 font-bold text-gray-600 dark:text-gray-400">
                  {timelineGroups.expired.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineGroups.expired.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredTasks.length === 0 && (
            <div className="card text-center py-16 px-4 rounded-2xl border flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">¡Todo al día!</h3>
              <p className="text-muted text-sm max-w-sm mt-1">
                No tienes actividades que coincidan con los filtros seleccionados.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="flex flex-col gap-6">
          <div className="card p-6 rounded-2xl border shadow-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
            {/* Calendar Header Navigation */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 capitalize">
                  {calendarData.monthName} {calendarData.year}
                </h2>
                <button
                  onClick={monthToday}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                >
                  Hoy
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={monthPrev}
                  className="p-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={monthNext}
                  className="p-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold uppercase tracking-wider text-muted">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span className="text-blue-500">Sáb</span>
              <span className="text-red-500">Dom</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarData.days.map((day, idx) => {
                const isToday =
                  day.isCurrentMonth &&
                  day.dayNumber === now.getDate() &&
                  calendarDate.getMonth() === now.getMonth() &&
                  calendarDate.getFullYear() === now.getFullYear();

                const hasTasks = day.tasks.length > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (hasTasks) {
                        setSelectedDayTasks(day.tasks);
                        setSelectedDayString(day.dateString);
                      }
                    }}
                    className={`min-h-[90px] p-2 rounded-xl border flex flex-col justify-between transition-all ${
                      hasTasks ? "cursor-pointer hover:border-blue-500 hover:shadow-md" : ""
                    } ${
                      !day.isCurrentMonth ? "opacity-30 bg-gray-50/50 dark:bg-gray-900/30" : "bg-slate-50/70 dark:bg-slate-900/40"
                    } ${isToday ? "ring-2 ring-blue-500 bg-blue-50/30 dark:bg-blue-950/20" : ""}`}
                    style={{ borderColor: isToday ? "#3b82f6" : "var(--border-color)" }}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {hasTasks && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {day.tasks.length}
                        </span>
                      )}
                    </div>

                    {/* Task Pills on Day */}
                    <div className="flex flex-col gap-1 mt-1.5 overflow-hidden">
                      {day.tasks.slice(0, 2).map(t => {
                        const isExam = t.type === "EXAM";
                        const isDone = !!(t.submission && t.submission.status !== "PENDING");
                        return (
                          <div
                            key={t.id}
                            title={`${t.courseName}: ${t.title}`}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate ${
                              isDone
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : isExam
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}
                          >
                            {t.title}
                          </div>
                        );
                      })}
                      {day.tasks.length > 2 && (
                        <span className="text-[9px] text-muted font-bold pl-1">
                          +{day.tasks.length - 2} más
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Modal / Details */}
          {selectedDayTasks && (
            <div className="card p-6 rounded-2xl border shadow-lg animate-fade-in" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CalendarDays size={20} className="text-blue-600" />
                    Actividades para el {selectedDayString}
                  </h3>
                  <p className="text-xs text-muted">
                    {selectedDayTasks.length} actividad(es) programada(s) para este día
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDayTasks(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDayTasks.map(task => (
                  <TaskCard key={task.id} task={task} info={getTaskInfo(task)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component: Individual Task / Exam Card
function TaskCard({ task, info }: { task: TableroTask; info: any }) {
  const isExam = task.type === "EXAM" || task.type === "FINAL";
  const href = isExam
    ? `/estudiante/examenes/${task.id}`
    : `/estudiante/tareas/${task.id}`;

  const dueFormatted = new Date(task.dueDate).toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div
      className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-lg ${
        info.isSubmitted
          ? "bg-slate-50/50 dark:bg-slate-900/30 border-emerald-200 dark:border-emerald-950"
          : info.isUrgent
          ? "border-red-300 dark:border-red-900/50 shadow-sm bg-red-50/20 dark:bg-red-950/10"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80"
      }`}
    >
      <div>
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Course Badge */}
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <BookOpen size={12} />
              {task.courseName}
            </span>

            {/* Type Badge */}
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                isExam
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              {isExam ? <ClipboardList size={12} /> : <FileText size={12} />}
              {isExam ? "Examen (Saber)" : "Tarea (Hacer)"}
            </span>

            {/* Individual Assignment Badge */}
            {task.isIndividuallyAssigned && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 flex items-center gap-1" title="Asignada especialmente para ti">
                <UserCheck size={12} /> Personal
              </span>
            )}
          </div>

          {/* Time text Badge */}
          {!info.isSubmitted && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                info.isDueToday
                  ? "bg-red-600 text-white animate-pulse"
                  : info.isUrgent
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : info.isExpired
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900/50"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40"
              }`}
            >
              <Clock size={12} />
              {info.isExpired ? "Cerrada · Nota: 1.0" : info.timeText}
            </span>
          )}

          {info.isSubmitted && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 size={12} />
              {info.isGraded ? `Nota: ${info.grade}` : "Entregada"}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-snug mb-1">
          {task.title}
        </h3>

        {/* Description snippet */}
        {task.description && (
          <p className="text-xs text-muted line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        {/* Attached Guide and Resources */}
        {(task.attachmentUrl || (task.resources && task.resources.length > 0)) && (
          <div className="mt-2.5 mb-1 p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 flex flex-col gap-2" style={{ borderColor: "var(--border-color)" }}>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Paperclip size={12} /> Material adjunto de la tarea:
            </div>
            {task.attachmentUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={task.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors"
                >
                  <Download size={13} />
                  Descargar Guía de la Tarea
                </a>
              </div>
            )}
            {task.resources && task.resources.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {task.resources.map(res => (
                  <div key={res.id} className="flex items-center gap-2">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors truncate max-w-full"
                    >
                      <ExternalLink size={12} />
                      <span className="truncate">{res.title}</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info & Action Button */}
      <div className="border-t pt-3 mt-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <CalendarIcon size={11} /> Vence: <strong>{dueFormatted}</strong>
          </span>
          {task.period && <span>Periodo: {task.period}</span>}
        </div>

        <Link
          href={href}
          className={`btn text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
            info.isSubmitted
              ? "btn-secondary !text-slate-700 dark:!text-slate-200 hover:!text-slate-800"
              : isExam
              ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 !text-white hover:!text-white"
              : "btn-primary !text-white hover:!text-white"
          }`}
        >
          {info.isSubmitted ? (
            <>
              Ver Entrega <ArrowRight size={14} />
            </>
          ) : isExam ? (
            <>
              Comenzar Examen <ArrowRight size={14} />
            </>
          ) : (
            <>
              Realizar Tarea <ArrowRight size={14} />
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
