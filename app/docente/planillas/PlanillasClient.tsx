"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, FileSpreadsheet, FileText, Loader2,
  Save, Undo2, AlertTriangle, Check, Info,
  Plus, Trash2, X, Pencil, CheckCircle, AlertCircle, Clock,
  Eye, EyeOff, Users
} from "lucide-react";
import Link from "next/link";
import QuestionEditor from "../tareas/[id]/QuestionEditor";
import { toColombiaISOString, fromColombiaLocalStringToDate } from "@/lib/dateUtils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
// @ts-ignore
import autoTable from "jspdf-autotable";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Group {
  id: string;
  name: string;
  grade?: { name: string };
}

interface CourseListItem {
  id: string;
  name: string;
  groups: Group[];
}

interface Period {
  id: string;
  name: string;
  active: boolean;
}

interface PlanillasClientProps {
  courses: CourseListItem[];
  periods: Period[];
  teacherName: string;
}

interface Student {
  id: string;
  name: string;
  group: { name: string; grade: { name: string } };
}

interface TaskItem {
  id: string;
  title: string;
  type: string; // EXAM | TASK | SER | FINAL | ATTEND
  active?: boolean;
  isExternal?: boolean;
  submissions: { studentId: string; grade: number | null; status: string }[];
}

interface CourseWeights {
  id: string;
  name: string;
  saberPercent: number;
  hacerPercent: number;
  serPercent: number;
  finalPercent: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// SABER = EXAM (exámenes), HACER = TASK (tareas), SER = SER (actitudinal)
const CATEGORIES = [
  { type: "EXAM",   label: "SABER",       sublabel: "Exámenes",    pctKey: "saberPercent",  color: { header: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300", cell: "bg-purple-50/60 dark:bg-purple-900/10", cellBorder: "border-l-purple-300 dark:border-l-purple-700", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", dot: "#a855f7", btn: "hover:bg-purple-200 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" } },
  { type: "TASK",   label: "HACER",       sublabel: "Tareas",      pctKey: "hacerPercent",  color: { header: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300", cell: "bg-orange-50/60 dark:bg-orange-900/10", cellBorder: "border-l-orange-300 dark:border-l-orange-700", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300", dot: "#d97706", btn: "hover:bg-orange-200 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" } },
  { type: "SER",    label: "SER",         sublabel: "Actitudinal", pctKey: "serPercent",    color: { header: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300", cell: "bg-yellow-50/60 dark:bg-yellow-900/10", cellBorder: "border-l-yellow-400 dark:border-l-yellow-700", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300", dot: "#b45309", btn: "hover:bg-yellow-200 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" } },
  { type: "FINAL",  label: "EXAMEN FINAL", sublabel: "",           pctKey: "finalPercent",  color: { header: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300", cell: "bg-sky-50/60 dark:bg-sky-900/10", cellBorder: "border-l-sky-300 dark:border-l-sky-700", badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300", dot: "#0ea5e9", btn: "hover:bg-sky-200 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" } },
  { type: "ATTEND", label: "ASISTENCIA",  sublabel: "",            pctKey: "",              color: { header: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300", cell: "bg-green-50/60 dark:bg-green-900/10", cellBorder: "border-l-green-300 dark:border-l-green-700", badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", dot: "#10b981", btn: "hover:bg-green-200 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" } },
] as const;

type CatType = (typeof CATEGORIES)[number]["type"];

const getDesempeno = (g: number) => {
  if (g >= 4.6) return { label: "SUPERIOR", cls: "text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300" };
  if (g >= 4.0) return { label: "ALTO",     cls: "text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300" };
  if (g >= 3.0) return { label: "BÁSICO",   cls: "text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300" };
  return           { label: "BAJO",     cls: "text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300" };
};

const gradeColor = (g: number | null) => {
  if (g === null) return "inherit";
  if (g < 3.0)   return "#dc2626";
  if (g < 4.0)   return "#d97706";
  return "#16a34a";
};

/** Converts a 0-based column index to Excel column letters: 0→A, 25→Z, 26→AA … */
const colLetter = (idx: number): string => {
  let s = "";
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlanillasClient({ courses, periods, teacherName }: PlanillasClientProps) {
  // ── Selector state ──
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedPeriod,   setSelectedPeriod]   = useState(periods[0]?.name ?? "Periodo 1");
  const [selectedGroupId,  setSelectedGroupId]  = useState("");

  // ── Data state ──
  const [students,      setStudents]      = useState<Student[]>([]);
  const [tasks,         setTasks]         = useState<TaskItem[]>([]);
  const [courseWeights, setCourseWeights] = useState<CourseWeights | null>(null);
  const [loading,       setLoading]       = useState(false);

  // ── Grades grid state ──
  const [gradesGrid,   setGradesGrid]   = useState<Record<string, Record<string, string>>>({});
  const [initialGrid,  setInitialGrid]  = useState<Record<string, Record<string, string>>>({});

  // ── Weights edit state ──
  const [pctForm,     setPctForm]     = useState({ saber: 25, hacer: 40, ser: 15, final: 20 });
  const [savingPct,   setSavingPct]   = useState(false);
  const [pctSuccess,  setPctSuccess]  = useState(false);
  const [pctError,    setPctError]    = useState("");

  const [saving,      setSaving]      = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError,   setSaveError]   = useState("");

  // ── Add column modal ──
  const [addModal,    setAddModal]    = useState<{ type: CatType } | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskIsExternal, setNewTaskIsExternal] = useState(true);
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [newTaskWeight, setNewTaskWeight] = useState("0");
  const [newTaskGroupIds, setNewTaskGroupIds] = useState<string[]>([]);
  const [newTaskTheme, setNewTaskTheme] = useState("");
  const [newTaskPublishAt, setNewTaskPublishAt] = useState("");
  const [newTaskAllowLateSubmission, setNewTaskAllowLateSubmission] = useState(false);
  const [newTaskExternalUrl, setNewTaskExternalUrl] = useState("");
  const [newTaskFile, setNewTaskFile] = useState<File | null>(null);
  const [addingTask,  setAddingTask]  = useState(false);

  // ── Edit modal ──
  const [editTaskId,  setEditTaskId]  = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // ── Toggle active ──
  const [togglingId, setTogglingId]  = useState<string | null>(null);

  // ── Delete confirm ──
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Manual Grading Modal ──
  const [gradingTask, setGradingTask] = useState<TaskItem | null>(null);
  const [gradingStudents, setGradingStudents] = useState<Array<{ id: string; name: string; groupName: string; submission: { id: string; status: string; grade: number | null; feedback: string | null; submittedAt: string | null } | null }>>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradingError, setGradingError] = useState("");
  const [gradingSaved, setGradingSaved] = useState(false);

  // ── Exam / Task Management Modal ──
  const [questionsModalTask, setQuestionsModalTask] = useState<TaskItem | null>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [manageTab, setManageTab] = useState<"control" | "questions">("control");
  const [taskStudents, setTaskStudents] = useState<any[]>([]);
  const [globalAllowLate, setGlobalAllowLate] = useState(false);
  const [globalLateUntil, setGlobalLateUntil] = useState("");
  const [savedGlobalAllowLate, setSavedGlobalAllowLate] = useState(false);
  const [savedGlobalLateUntil, setSavedGlobalLateUntil] = useState("");
  const [savingGlobalLate, setSavingGlobalLate] = useState(false);
  const [resettingSubmissions, setResettingSubmissions] = useState<string | null>(null);

  // ── Custom Excel Sync Wizard State ──
  const [customExcelData, setCustomExcelData] = useState<{
    rows: any[][];
    headers: string[];
    headerIndex: number;
    workbook: XLSX.WorkBook;
    fileName: string;
  } | null>(null);
  const [excelStudentCol, setExcelStudentCol] = useState<number>(-1);
  const [excelTaskMappings, setExcelTaskMappings] = useState<Record<string, number>>({});
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState<{ matched: number; total: number; created: number; createdNames: string } | null>(null);

  // ── Derived ──
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const groups = selectedCourse?.groups ?? [];

  // Auto-select first group on course change
  useEffect(() => {
    setSelectedGroupId(groups[0]?.id ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  // Fetch when filters complete
  useEffect(() => {
    if (selectedCourseId && selectedPeriod && selectedGroupId) fetchData();
    else { setStudents([]); setTasks([]); setGradesGrid({}); setInitialGrid({}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedPeriod, selectedGroupId]);

  const fetchData = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const res = await fetch(
        `/api/docente/planillas?courseId=${selectedCourseId}&period=${encodeURIComponent(selectedPeriod)}&groupId=${selectedGroupId}`
      );
      const data = await res.json();
      if (!res.ok) return;

      const fStudents: Student[]  = data.students ?? [];
      const fTasks:    TaskItem[] = data.tasks    ?? [];
      setStudents(fStudents);
      setTasks(fTasks);
      const w: CourseWeights = data.course ?? null;
      setCourseWeights(w);
      if (w) {
        setPctForm({
          saber: w.saberPercent  ?? 25,
          hacer: w.hacerPercent  ?? 40,
          ser:   w.serPercent    ?? 15,
          final: w.finalPercent  ?? 20,
        });
      }

      // Build grid from existing submissions
      const grid: Record<string, Record<string, string>> = {};
      for (const s of fStudents) {
        grid[s.id] = {};
        for (const t of fTasks) {
          const sub = t.submissions.find(x => x.studentId === s.id);
          grid[s.id][t.id] = sub?.grade !== null && sub?.grade !== undefined ? String(sub.grade) : "";
        }
      }
      setGradesGrid(grid);
      setInitialGrid(JSON.parse(JSON.stringify(grid)));
    } catch { /* silent */ }
    finally   { setLoading(false); }
  };

  // ── Category slices ──
  const byType = useCallback(
    (type: string) => tasks.filter(t => t.type === type),
    [tasks]
  );

  const taskNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 1;
    for (const cat of CATEGORIES) byType(cat.type).forEach(t => { map[t.id] = n++; });
    return map;
  }, [byType]);

  const hasChanges = useMemo(
    () => JSON.stringify(gradesGrid) !== JSON.stringify(initialGrid),
    [gradesGrid, initialGrid]
  );

  // ── Cell handler ──
  const handleCell = (studentId: string, taskId: string, value: string) => {
    if (value !== "") {
      const p = parseFloat(value);
      if (isNaN(p) || p < 0 || p > 5) return;
    }
    setGradesGrid(prev => ({ ...prev, [studentId]: { ...prev[studentId], [taskId]: value } }));
  };

  // ── Save grades ──
  const handleSave = async () => {
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    const submissions: { studentId: string; taskId: string; grade: string | null }[] = [];
    for (const sid of Object.keys(gradesGrid)) {
      for (const tid of Object.keys(gradesGrid[sid])) {
        if (gradesGrid[sid][tid] !== (initialGrid[sid]?.[tid] ?? ""))
          submissions.push({ studentId: sid, taskId: tid, grade: gradesGrid[sid][tid] || null });
      }
    }
    try {
      const res  = await fetch("/api/docente/planillas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId, submissions })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        setInitialGrid(JSON.parse(JSON.stringify(gradesGrid)));
        setTimeout(() => setSaveSuccess(false), 3000);
      } else setSaveError(data.error ?? "Error al guardar");
    } catch { setSaveError("Error de conexión"); }
    finally   { setSaving(false); }
  };

  // ── Save weight percentages ──
  const pctTotal   = pctForm.saber + pctForm.hacer + pctForm.ser + pctForm.final;
  const pctChanged = courseWeights
    ? pctForm.saber !== courseWeights.saberPercent
      || pctForm.hacer !== courseWeights.hacerPercent
      || pctForm.ser   !== courseWeights.serPercent
      || pctForm.final !== courseWeights.finalPercent
    : false;

  const handleSavePct = async () => {
    if (pctTotal !== 100) return;
    setSavingPct(true); setPctError(""); setPctSuccess(false);
    try {
      const res = await fetch("/api/docente/cursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCourseId,
          saberPercent: pctForm.saber,
          hacerPercent: pctForm.hacer,
          serPercent:   pctForm.ser,
          finalPercent: pctForm.final,
        })
      });
      if (res.ok) {
        setCourseWeights(prev => prev
          ? { ...prev, saberPercent: pctForm.saber, hacerPercent: pctForm.hacer, serPercent: pctForm.ser, finalPercent: pctForm.final }
          : prev
        );
        setPctSuccess(true);
        setTimeout(() => setPctSuccess(false), 3000);
      } else {
        const d = await res.json();
        setPctError(d.error ?? "Error al guardar pesos");
      }
    } catch { setPctError("Error de conexión"); }
    setSavingPct(false);
  };

  // Helper to generate default due date (tomorrow at 23:59)
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ── Add column ──
  const openAddModal = (type: CatType) => {
    setAddModal({ type });
    setNewTaskName("");
    setNewTaskDescription("");
    setNewTaskDueDate(getDefaultDueDate());
    setNewTaskIsExternal(type === "EXAM" || type === "TASK" ? false : true);
    setNewTaskDuration("");
    setNewTaskWeight("0");
    setNewTaskGroupIds(selectedGroupId ? [selectedGroupId] : []);
    setNewTaskTheme(
      type === "EXAM" ? "Saber" :
      type === "TASK" ? "Hacer" :
      type === "SER" ? "Ser" :
      type === "FINAL" ? "Examen Final" : "Asistencia"
    );
    setNewTaskPublishAt("");
    setNewTaskAllowLateSubmission(false);
    setNewTaskExternalUrl("");
    setNewTaskFile(null);
  };

  const buildFormData = () => {
    if (!addModal) return new FormData();
    const fd = new FormData();
    fd.append("title", newTaskName.trim());
    fd.append("type", addModal.type);
    fd.append("period", selectedPeriod);
    fd.append("description", newTaskDescription.trim());
    fd.append("dueDate", newTaskDueDate);
    fd.append("courseId", selectedCourseId);
    fd.append("isExternal", String(newTaskIsExternal));
    if (newTaskDuration) fd.append("duration", newTaskDuration);
    fd.append("weight", newTaskWeight);
    fd.append("groupIds", JSON.stringify(newTaskGroupIds));
    fd.append("theme", newTaskTheme.trim());
    if (newTaskPublishAt) fd.append("publishAt", newTaskPublishAt);
    fd.append("allowLateSubmission", String(newTaskAllowLateSubmission));
    if (newTaskExternalUrl.trim()) fd.append("externalUrl", newTaskExternalUrl.trim());
    if (newTaskFile) fd.append("file", newTaskFile);
    return fd;
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim() || !addModal) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/docente/tareas", { method: "POST", body: buildFormData() });
      if (res.ok) { setAddModal(null); fetchData(); }
      else { const d = await res.json(); alert(d.error ?? "Error al crear la evaluación."); }
    } catch { alert("Error de conexión."); }
    setAddingTask(false);
  };

  const openEditModal = async (task: TaskItem) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/docente/tareas/${task.id}`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Error cargando datos."); return; }
      const t = data.task;
      // Format datetime-local
      const toLocal = (d: string | null) => {
        if (!d) return "";
        if (d.startsWith("9999") || d.startsWith("2100")) return "";
        const date = new Date(d);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      setAddModal({ type: task.type as CatType });
      setEditTaskId(task.id);
      setNewTaskName(t.title || "");
      setNewTaskDescription(t.description || "");
      setNewTaskDueDate(toLocal(t.dueDate));
      setNewTaskIsExternal(!!t.isExternal);
      setNewTaskDuration(t.duration ? String(t.duration) : "");
      setNewTaskWeight(t.weight != null ? String(t.weight) : "0");
      setNewTaskGroupIds((t.groups || []).map((g: any) => g.id));
      setNewTaskTheme(t.theme || "");
      setNewTaskPublishAt(toLocal(t.publishAt));
      setNewTaskAllowLateSubmission(!!t.allowLateSubmission);
      setNewTaskExternalUrl(t.attachmentUrl || "");
      setNewTaskFile(null);
    } catch { alert("Error de conexión."); }
    setLoadingEdit(false);
  };

  const handleEditTask = async () => {
    if (!newTaskName.trim() || !addModal || !editTaskId) return;
    setAddingTask(true);
    try {
      const res = await fetch(`/api/docente/tareas/${editTaskId}`, { method: "PATCH", body: buildFormData() });
      if (res.ok) { setAddModal(null); setEditTaskId(null); fetchData(); }
      else { const d = await res.json(); alert(d.error ?? "Error al guardar cambios."); }
    } catch { alert("Error de conexión."); }
    setAddingTask(false);
  };

  const handleToggleActive = async (taskId: string, currentActive: boolean) => {
    setTogglingId(taskId);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive })
      });
      if (res.ok) fetchData();
      else alert("Error al cambiar estado.");
    } catch { alert("Error de conexión."); }
    setTogglingId(null);
  };

  // ── Delete column ──
  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`⚠️ ¿Eliminar "${taskTitle}"? Se borrarán TODAS las notas asociadas. Esta acción no se puede deshacer.`)) return;
    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/docente/cursos/${selectedCourseId}/grades/spreadsheet/columns?taskId=${taskId}`, { method: "DELETE" });
      if (res.ok) fetchData();
      else        alert("Error eliminando columna.");
    } catch { alert("Error de conexión."); }
    setDeletingId(null);
  };

  // ── Per-student stats ──
  const calcStats = useCallback((studentId: string) => {
    const g = gradesGrid[studentId] ?? {};
    const avg = (list: TaskItem[]) => {
      const vals = list.map(t => parseFloat(g[t.id])).filter(v => !isNaN(v) && v >= 1 && v <= 5);
      return vals.length ? vals.reduce((a, b) => a + b) / vals.length : null;
    };
    // Use pctForm so table recalculates live as user edits weights
    const sp = pctForm.saber;
    const hp = pctForm.hacer;
    const ep = pctForm.ser;
    const fp = pctForm.final;

    const saber = avg(byType("EXAM"));
    const hacer = avg(byType("TASK"));
    const ser   = avg(byType("SER"));
    const final = avg(byType("FINAL"));

    const hasAny = saber !== null || hacer !== null || ser !== null || final !== null;
    const total = hasAny
      ? (saber ?? 0) * (sp / 100) + (hacer ?? 0) * (hp / 100) + (ser ?? 0) * (ep / 100) + (final ?? 0) * (fp / 100)
      : null;

    return { saber, hacer, ser, final, total,
      pondSaber: saber !== null ? saber * (sp / 100) : null,
      pondHacer: hacer !== null ? hacer * (hp / 100) : null,
      pondSer:   ser   !== null ? ser   * (ep / 100) : null,
      pondFinal: final !== null ? final * (fp / 100) : null,
    };
  }, [gradesGrid, byType, pctForm]);

  // ── Manual grading handlers ──────────────────────────────────────────────────
  const openGradingModal = async (task: TaskItem) => {
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
        data.students.forEach((s: any) => {
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

  const openQuestionsModal = async (task: TaskItem) => {
    setQuestionsModalTask(task);
    setManageTab("control");
    setLoadingQuestions(true);
    setExamQuestions([]);
    setTaskStudents([]);
    setGlobalAllowLate(false);
    setGlobalLateUntil("");
    setSavedGlobalAllowLate(false);
    setSavedGlobalLateUntil("");
    try {
      const studentRes = await fetch(`/api/docente/tareas/${task.id}/students-grades`);
      const studentData = await studentRes.json();
      if (studentRes.ok) {
        setTaskStudents(studentData.students || []);
        const al = !!studentData.allowLateSubmission;
        const lu = studentData.lateSubmissionUntil ? toColombiaISOString(studentData.lateSubmissionUntil) : "";
        setGlobalAllowLate(al);
        setGlobalLateUntil(lu);
        setSavedGlobalAllowLate(al);
        setSavedGlobalLateUntil(lu);
      }
      if (task.type === "EXAM") {
        const questRes = await fetch(`/api/docente/tareas/${task.id}/questions`);
        const questData = await questRes.json();
        if (questRes.ok) setExamQuestions(questData.questions || []);
      }
    } catch {
      alert("Error de conexión al cargar la información de la tarea");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const saveGlobalLateConfig = async () => {
    if (!questionsModalTask) return;
    setSavingGlobalLate(true);
    try {
      const res = await fetch(`/api/docente/tareas/${questionsModalTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowLateSubmission: globalAllowLate,
          lateSubmissionUntil: globalAllowLate && globalLateUntil ? fromColombiaLocalStringToDate(globalLateUntil)?.toISOString() : null
        })
      });
      if (res.ok) {
        setSavedGlobalAllowLate(globalAllowLate);
        setSavedGlobalLateUntil(globalLateUntil);
        const r = await fetch(`/api/docente/tareas/${questionsModalTask.id}/students-grades`);
        const d = await r.json();
        if (r.ok) setTaskStudents(d.students || []);
        alert("Prórroga global guardada con éxito.");
      } else { alert("Error al guardar la prórroga."); }
    } catch { alert("Error de red"); } finally { setSavingGlobalLate(false); }
  };

  const saveIndividualLateConfig = async (studentId: string, allow: boolean, untilStr: string) => {
    if (!questionsModalTask) return;
    try {
      const res = await fetch(`/api/docente/calificar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: questionsModalTask.id, studentId,
          allowLateSubmission: allow,
          lateSubmissionUntil: allow && untilStr ? fromColombiaLocalStringToDate(untilStr)?.toISOString() : null
        })
      });
      if (res.ok) {
        const r = await fetch(`/api/docente/tareas/${questionsModalTask.id}/students-grades`);
        const d = await r.json();
        if (r.ok) setTaskStudents(d.students || []);
      } else { alert("Error al actualizar la prórroga del estudiante"); }
    } catch { alert("Error de conexión"); }
  };

  const resetStudentSubmission = async (studentId: string, studentName: string, hasSub: boolean) => {
    if (!questionsModalTask) return;
    const msg = hasSub
      ? `¿Reiniciar el examen de ${studentName}? Se eliminará el intento actual.`
      : `¿Habilitar el examen de ${studentName}?`;
    if (!confirm(msg)) return;
    setResettingSubmissions(studentId);
    try {
      const res = await fetch(`/api/docente/tareas/${questionsModalTask.id}/submission/${studentId}`, { method: "DELETE" });
      if (res.ok) {
        const r = await fetch(`/api/docente/tareas/${questionsModalTask.id}/students-grades`);
        const d = await r.json();
        if (r.ok) setTaskStudents(d.students || []);
        alert(hasSub ? "Intento reiniciado." : "Examen habilitado.");
      } else {
        const d = await res.json();
        alert(d.error || "Error al reiniciar");
      }
    } catch { alert("Error de conexión"); } finally { setResettingSubmissions(null); }
  };

  const resetAllGroupSubmissions = async () => {
    if (!questionsModalTask) return;
    if (!confirm(`¿Reiniciar el examen para los ${taskStudents.length} estudiantes del grupo? Se eliminarán todos los intentos.`)) return;
    setResettingSubmissions("all");
    try {
      const res = await fetch(`/api/docente/tareas/${questionsModalTask.id}/reset-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId })
      });
      const data = await res.json();
      if (res.ok) {
        const r = await fetch(`/api/docente/tareas/${questionsModalTask.id}/students-grades`);
        const d = await r.json();
        if (r.ok) setTaskStudents(d.students || []);
        alert(`Reiniciados ${data.resetCount} intentos.`);
      } else { alert(data.error || "Error al reiniciar"); }
    } catch { alert("Error de conexión"); } finally { setResettingSubmissions(null); }
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
      fetchData();
    } catch {
      setGradingError("Error al guardar calificaciones");
    } finally {
      setSavingGrades(false);
    }
  };

  const statusBadge = (sub: { status: string } | null) => {
    if (!sub) return <span className="text-xs text-muted italic">Sin entrega</span>;
    if (sub.status === "GRADED") return <span className="badge badge-success flex items-center gap-1"><CheckCircle size={10} /> Calificada</span>;
    if (sub.status === "SUBMITTED") return <span className="badge badge-info flex items-center gap-1"><Clock size={10} /> Entregada</span>;
    return <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={10} /> Pendiente</span>;
  };

  // ── Export & Sync ──
  const exportToExcel = () => {
    const t = document.getElementById("planillas-table");
    if (!t) return;
    const wb = XLSX.utils.table_to_book(t, { sheet: "Planilla" });
    XLSX.writeFile(wb, `Planilla_${selectedCourse?.name}_${selectedPeriod}.xlsx`);
  };

  const exportToExcelSync = () => {
    // 1. Prepare headers
    const row1 = ["STUDENT_ID", "STUDENT_NAME", "GROUP"];
    const row2 = ["ID Estudiante", "Nombre Completo", "Grupo"];

    // Get all tasks in the order they appear in the table
    const activeTasks: TaskItem[] = [];
    CATEGORIES.forEach(cat => {
      if (cat.type === "FINAL" && !showFinal) return;
      if (cat.type === "ATTEND" && !showAttend) return;
      const catTasks = byType(cat.type);
      catTasks.forEach(t => {
        activeTasks.push(t);
        row1.push(t.id);
        row2.push(`${cat.label} ${taskNumbers[t.id]} - ${t.title}`);
      });
    });

    const dataRows = [row1, row2];

    // Add student rows
    students.forEach(student => {
      const row = [student.id, student.name, `${student.group.grade?.name || ""} - ${student.group.name}`];
      const studentGrades = gradesGrid[student.id] || {};
      activeTasks.forEach(t => {
        row.push(studentGrades[t.id] || "");
      });
      dataRows.push(row);
    });

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    
    // Hide the first row (metadata row)
    ws["!rows"] = [];
    ws["!rows"][0] = { hidden: true };

    // Auto-fit column widths
    const max_cols = row2.length;
    ws["!cols"] = Array.from({ length: max_cols }, () => ({ wch: 15 }));
    ws["!cols"][0] = { wch: 25 }; // student ID
    ws["!cols"][1] = { wch: 30 }; // student name
    ws["!cols"][2] = { wch: 15 }; // group

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    XLSX.writeFile(wb, `Sincro_Planilla_${selectedCourse?.name}_${selectedPeriod}.xlsx`);
  };

  const importFromExcelSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to 2D Array
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length < 2) {
          alert("El archivo Excel no tiene suficientes filas.");
          return;
        }

        // Detect if it is the synchronizable template with hidden task IDs
        const row1 = rows[0];
        if (row1 && row1[0] === "STUDENT_ID" && row1[1] === "STUDENT_NAME") {
          // Process synchronizable template directly (original logic)
          const taskIds = row1.slice(3);
          const updatedGradesGrid = { ...gradesGrid };

          for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const studentId = row[0];
            if (!studentId || typeof studentId !== "string" || studentId === "STUDENT_ID") continue;

            const studentExists = students.some(s => s.id === studentId);
            if (!studentExists) continue;

            if (!updatedGradesGrid[studentId]) updatedGradesGrid[studentId] = {};

            taskIds.forEach((taskId, index) => {
              if (!taskId) return;
              const colIndex = index + 3;
              const gradeVal = row[colIndex];
              
              let formattedGrade = "";
              if (gradeVal !== undefined && gradeVal !== null && gradeVal !== "") {
                const num = parseFloat(gradeVal);
                if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                  formattedGrade = num.toFixed(1);
                }
              }
              updatedGradesGrid[studentId][taskId] = formattedGrade;
            });
          }

          setGradesGrid(updatedGradesGrid);
          alert(`Sincronización exitosa. Se leyeron calificaciones para los estudiantes en pantalla. Revisa los cambios resaltados en amarillo y presiona 'Guardar' para confirmarlos.`);
          return;
        }

        // Custom Excel Sheet detected!
        // Find header row using a smart scoring algorithm
        let headerIndex = 0;
        let maxScore = -999;
        
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const r = rows[i];
          if (!r) continue;
          
          let score = 0;
          let hasStudentCol = false;
          let nonArr = r.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
          score += Math.min(10, nonArr.length); // Up to 10 points for number of columns filled
          
          r.forEach(cell => {
            if (cell === undefined || cell === null) return;
            const val = String(cell).toLowerCase();
            
            // Student name column indicators
            if (val.includes("nombre") || val.includes("estudiante") || val.includes("alumno") || val.includes("completo") || val.includes("nombres") || val.includes("estudiantes")) {
              hasStudentCol = true;
            }
            
            // Evaluation indicators
            if (val.includes("saber") || val.includes("hacer") || val.includes("ser") || val.includes("nota") || val.includes("calificacion") || val.includes("taller") || val.includes("tarea") || val.includes("examen") || val.includes("evaluacion") || val.includes("def") || val.includes("promedio") || val.includes("asistencia")) {
              score += 3;
            }
            
            // Meta row indicators (negative)
            if (val.includes("institucion") || val.includes("educativa") || val.includes("colegio") || val.includes("escuela") || val.includes("docente") || val.includes("profesor") || val.includes("asignatura") || val.includes("materia") || val.includes("periodo") || val.includes("curso") || val.includes("grado") || val.includes("planilla") || val.includes("consolidado")) {
              score -= 5;
            }
          });
          
          if (hasStudentCol) {
            score += 15; // heavily prioritize rows with a student column
          }
          
          if (score > maxScore && nonArr.length > 1) {
            maxScore = score;
            headerIndex = i;
          }
        }

        const targetRow = rows[headerIndex] || [];
        const nextRow = rows[headerIndex + 1] || [];
        const excelHeaders: string[] = [];
        const maxLen = Math.max(targetRow.length, nextRow.length);
        const isCategoryName = (str: string) => {
          const s = str.toLowerCase();
          return s.includes("saber") || s.includes("hacer") || s.includes("ser") || s.includes("final") || s.includes("asistencia") || s.includes("evalua") || s.includes("nota");
        };

        let lastCategoryHeader = "";
        for (let idx = 0; idx < maxLen; idx++) {
          const val = targetRow[idx] ? String(targetRow[idx]).trim() : "";
          const isCat = val.toLowerCase().includes("saber") || val.toLowerCase().includes("hacer") || val.toLowerCase().includes("ser") || val.toLowerCase().includes("final") || val.toLowerCase().includes("asistencia");
          if (isCat) {
            lastCategoryHeader = val;
          } else if (val) {
            lastCategoryHeader = "";
          }

          const h = val || lastCategoryHeader;
          const sub = nextRow[idx] ? String(nextRow[idx]).trim() : "";
          
          let combined = "";
          if (h && sub) {
            if (h.toLowerCase() === sub.toLowerCase()) {
              combined = h;
            } else if (isCategoryName(h) && sub.length <= 12) {
              combined = `${h} - ${sub}`;
            } else {
              combined = h;
            }
          } else if (h) {
            combined = h;
          } else if (sub) {
            const isNoteLabel = /^[0-9a-zA-Z\s\-_#]{1,10}$/.test(sub);
            if (isNoteLabel) {
              combined = sub;
            } else {
              combined = colLetter(idx);
            }
          } else {
            combined = colLetter(idx);
          }
          excelHeaders.push(combined);
        }
        
        // Auto-select student column (store index)
        const studentColIdx = excelHeaders.findIndex(h => {
          if (!h) return false;
          const nh = h.toLowerCase();
          return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
        });

        // Auto-select mappings for each task (store index, -1 = don't import)
        const mappings: Record<string, number> = {};
        CATEGORIES.forEach(cat => {
          if (cat.type === "FINAL" && !showFinal) return;
          if (cat.type === "ATTEND" && !showAttend) return;
          const catTasks = byType(cat.type);
          catTasks.forEach(t => {
            const platformLabel = `${cat.label} ${taskNumbers[t.id]}`;
            const normLabel = platformLabel.toLowerCase();
            const normTitle = (t.title || "").toLowerCase();
            const numStr = String(taskNumbers[t.id]);

            // Try to match column header (skip weight-only label cols like "SABER 30%")
            const matchedIdx = excelHeaders.findIndex(h => {
              if (!h) return false;
              const nh = h.toLowerCase().trim();
              if (nh === "saber 30%" || nh === "hacer 50%" || nh === "ser 20%") return false;

              // Clean percentage to avoid e.g. "30%" matching digit "3"
              const nhClean = nh.replace(/\d+%/g, "");

              // Exact matches
              if (nh === normLabel || nh === normTitle || nh === numStr) return true;

              // e.g. "saber 30% - 1" contains "saber" and "1"
              const hasCategory = nhClean.includes(cat.label.toLowerCase());
              const hasNum = nhClean.includes(` ${numStr}`) || nhClean.endsWith(`-${numStr}`) || nhClean.endsWith(` ${numStr}`) || nhClean.includes(`-${numStr}-`) || nhClean.includes(` ${numStr} `) || nhClean.endsWith(` - ${numStr}`);
              if (hasCategory && hasNum) return true;

              // Fallback to simple number match ONLY if the column doesn't mention another category
              const mentionsOtherCategory = CATEGORIES.some(otherCat => {
                if (otherCat.type === cat.type) return false;
                return nhClean.includes(otherCat.label.toLowerCase());
              });
              
              if (!mentionsOtherCategory) {
                if (nhClean === numStr || nhClean === `nota ${numStr}` || nhClean === `nota_${numStr}` || nhClean.endsWith(` - ${numStr}`) || nhClean.endsWith(`-${numStr}`) || nhClean.endsWith(` ${numStr}`)) {
                  return true;
                }
              }

              return nhClean.includes(normLabel) || nhClean.includes(normTitle) || normTitle.includes(nhClean);
            });

            mappings[t.id] = matchedIdx; // -1 if no match
          });
        });

        // Open mapping wizard
        setCustomExcelData({ rows, headers: excelHeaders, headerIndex, workbook: wb, fileName: file.name });
        setExcelStudentCol(studentColIdx);
        setExcelTaskMappings(mappings);

      } catch (err: any) {
        console.error(err);
        alert(`Ocurrió un error al procesar el archivo Excel: ${err?.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleHeaderRowChange = (newIndex: number) => {
    if (!customExcelData) return;
    const { rows } = customExcelData;
    const targetRow = rows[newIndex] || [];
    const nextRow = rows[newIndex + 1] || [];
    const excelHeaders: string[] = [];
    const maxLen = Math.max(targetRow.length, nextRow.length);
    const isCategoryName = (str: string) => {
      const s = str.toLowerCase();
      return s.includes("saber") || s.includes("hacer") || s.includes("ser") || s.includes("final") || s.includes("asistencia") || s.includes("evalua") || s.includes("nota");
    };

    let lastCategoryHeader = "";
    for (let idx = 0; idx < maxLen; idx++) {
      const val = targetRow[idx] ? String(targetRow[idx]).trim() : "";
      const isCat = val.toLowerCase().includes("saber") || val.toLowerCase().includes("hacer") || val.toLowerCase().includes("ser") || val.toLowerCase().includes("final") || val.toLowerCase().includes("asistencia");
      if (isCat) {
        lastCategoryHeader = val;
      } else if (val) {
        lastCategoryHeader = "";
      }

      const h = val || lastCategoryHeader;
      const sub = nextRow[idx] ? String(nextRow[idx]).trim() : "";
      
      let combined = "";
      if (h && sub) {
        if (h.toLowerCase() === sub.toLowerCase()) {
          combined = h;
        } else if (isCategoryName(h) && sub.length <= 12) {
          combined = `${h} - ${sub}`;
        } else {
          combined = h;
        }
      } else if (h) {
        combined = h;
      } else if (sub) {
        const isNoteLabel = /^[0-9a-zA-Z\s\-_#]{1,10}$/.test(sub);
        if (isNoteLabel) {
          combined = sub;
        } else {
          combined = colLetter(idx);
        }
      } else {
        combined = colLetter(idx);
      }
      excelHeaders.push(combined);
    }
    
    // Auto-select student column (store index)
    const studentColIdx = excelHeaders.findIndex(h => {
      if (!h) return false;
      const nh = h.toLowerCase();
      return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
    });

    // Auto-select mappings for each task (store index, -1 = don't import)
    const mappings: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      if (cat.type === "FINAL" && !showFinal) return;
      if (cat.type === "ATTEND" && !showAttend) return;
      const catTasks = byType(cat.type);
      catTasks.forEach(t => {
        const platformLabel = `${cat.label} ${taskNumbers[t.id]}`;
        const normLabel = platformLabel.toLowerCase();
        const normTitle = (t.title || "").toLowerCase();

        // Try to match column header (skip weight-only label cols like "SABER 30%")
        const matchedIdx = excelHeaders.findIndex(h => {
          if (!h) return false;
          const nh = h.toLowerCase().trim();
          if (nh === "saber 30%" || nh === "hacer 50%" || nh === "ser 20%") return false;

          // Clean percentage to avoid e.g. "30%" matching digit "3"
          const nhClean = nh.replace(/\d+%/g, "");

          // Exact matches
          if (nh === normLabel || nh === normTitle) return true;

          // e.g. "saber 30% - 1" contains "saber" and "1"
          const hasCategory = nhClean.includes(cat.label.toLowerCase());
          const hasNum = nhClean.includes(` ${taskNumbers[t.id]}`) || nhClean.endsWith(`-${taskNumbers[t.id]}`) || nhClean.endsWith(` ${taskNumbers[t.id]}`) || nhClean.endsWith(` - ${taskNumbers[t.id]}`);
          if (hasCategory && hasNum) return true;

          // Fallback to simple number match ONLY if the column doesn't mention another category
          const mentionsOtherCategory = CATEGORIES.some(otherCat => {
            if (otherCat.type === cat.type) return false;
            return nhClean.includes(otherCat.label.toLowerCase());
          });
          
          if (!mentionsOtherCategory) {
            const numStr = String(taskNumbers[t.id]);
            if (nhClean === numStr || nhClean === `nota ${numStr}` || nhClean === `nota_${numStr}` || nhClean.endsWith(` - ${numStr}`) || nhClean.endsWith(`-${numStr}`) || nhClean.endsWith(` ${numStr}`)) {
              return true;
            }
          }

          return nh.includes(normLabel) || nh.includes(normTitle);
        });

        mappings[t.id] = matchedIdx; // -1 if no match
      });
    });

    setCustomExcelData({ 
      rows, 
      headers: excelHeaders, 
      headerIndex: newIndex,
      workbook: customExcelData.workbook,
      fileName: customExcelData.fileName
    });
    setExcelStudentCol(studentColIdx);
    setExcelTaskMappings(mappings);
  };

  const confirmCustomExcelSync = async () => {
    if (!customExcelData || excelStudentCol === -1) return;

    const { rows, headers, headerIndex } = customExcelData;
    const studentColIdx = excelStudentCol;
    if (studentColIdx === -1 || studentColIdx >= headers.length) {
      alert("Selecciona la columna de nombres de estudiantes.");
      return;
    }

    // ── Step 1: Detect Excel grade columns not yet mapped to any platform task ──
    // All indices currently used by a task or student column
    const usedIndices = new Set<number>([studentColIdx, ...Object.values(excelTaskMappings).filter(v => v !== -1)]);

    // Determine which column type (SABER/HACER/SER) each unmapped column belongs to
    const detectCatFromHeader = (h: string): CatType | null => {
      const nh = h.toLowerCase();
      if (nh.includes("saber") || nh.includes("examen")) return "EXAM";
      if (nh.includes("hacer") || nh.includes("tarea")) return "TASK";
      if (nh.includes("ser") || nh.includes("autoevaluacion") || nh.includes("autoevaluación")) return "SER";
      if (nh.includes("final")) return "FINAL";
      if (nh.includes("asistencia")) return "ATTEND";
      return null;
    };

    // Find grade-like columns that are not already mapped and are not the student or % label columns
    const unmappedGradeCols: { idx: number; header: string; catType: CatType }[] = [];
    headers.forEach((h, idx) => {
      if (usedIndices.has(idx)) return;
      if (!h || h === colLetter(idx)) return; // skip empty/fallback columns
      const nh = h.toLowerCase().trim();
      if (nh === "no." || nh === "no" || nh === "#") return; // skip row number columns
      const cat = detectCatFromHeader(h);
      if (cat) {
        unmappedGradeCols.push({ idx, header: h, catType: cat });
      }
    });

    // ── Step 2: Auto-create missing tasks for unmapped grade columns ──
    const createdTaskMap: Record<number, string> = {}; // colIdx → new taskId

    if (unmappedGradeCols.length > 0) {
      const defaultDueDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        d.setHours(23, 59, 0, 0);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })();

      for (const col of unmappedGradeCols) {
        try {
          const fd = new FormData();
          fd.append("title", col.header);
          fd.append("type", col.catType);
          fd.append("period", selectedPeriod);
          fd.append("description", `Importado desde Excel — columna ${colLetter(col.idx)}`);
          fd.append("dueDate", defaultDueDate);
          fd.append("courseId", selectedCourseId);
          fd.append("isExternal", "true");
          fd.append("weight", "0");
          fd.append("groupIds", JSON.stringify(selectedGroupId ? [selectedGroupId] : []));
          const themeMap: Record<CatType, string> = { EXAM: "Saber", TASK: "Hacer", SER: "Ser", FINAL: "Examen Final", ATTEND: "Asistencia" };
          fd.append("theme", themeMap[col.catType] ?? "");
          fd.append("allowLateSubmission", "false");

          const res = await fetch("/api/docente/tareas", { method: "POST", body: fd });
          if (res.ok) {
            const data = await res.json();
            const newId = data.task?.id ?? data.id;
            if (newId) createdTaskMap[col.idx] = newId;
          }
        } catch {
          // skip individual failures, continue
        }
      }
    }

    // ── Step 3: Apply grades (existing + newly created tasks) ──
    const updatedGradesGrid = { ...gradesGrid };

    const normalizeName = (name: string) =>
      name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");

    const findBestStudentMatch = (excelName: string) => {
      if (!excelName) return null;
      const normExcel = normalizeName(excelName);
      let match = students.find(s => normalizeName(s.name) === normExcel);
      if (match) return match;
      const excelTokens = normExcel.split(" ").filter(t => t.length > 2);
      if (excelTokens.length === 0) return null;
      let bestStudent: typeof students[number] | null = null;
      let maxSharedTokens = 0;
      students.forEach(student => {
        const normStudent = normalizeName(student.name);
        const studentTokens = normStudent.split(" ").filter(t => t.length > 2);
        const shared = studentTokens.filter(t => excelTokens.includes(t)).length;
        if (shared > maxSharedTokens) { maxSharedTokens = shared; bestStudent = student; }
      });
      if (maxSharedTokens >= 2 || (maxSharedTokens >= 1 && excelTokens.length === 1)) return bestStudent;
      return null;
    };

    // Build combined mappings: existing + newly created
    const allMappings: Record<string, number> = { ...excelTaskMappings }; // taskId → colIdx
    Object.entries(createdTaskMap).forEach(([colIdxStr, newTaskId]) => {
      allMappings[newTaskId] = Number(colIdxStr);
    });

    let matchedCount = 0;
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const excelName = row[studentColIdx];
      if (!excelName) continue;
      const studentMatch = findBestStudentMatch(String(excelName));
      if (!studentMatch) continue;
      matchedCount++;
      if (!updatedGradesGrid[studentMatch.id]) updatedGradesGrid[studentMatch.id] = {};
      Object.keys(allMappings).forEach(taskId => {
        const excelColIdx = allMappings[taskId];
        if (excelColIdx === undefined || excelColIdx === -1) return;
        if (excelColIdx >= headers.length) return;
        const gradeVal = row[excelColIdx];
        if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
          const num = parseFloat(gradeVal);
          if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
            updatedGradesGrid[studentMatch.id][taskId] = num.toFixed(1);
          }
        }
      });
    }

    setGradesGrid(updatedGradesGrid);
    setCustomExcelData(null);
    setSyncConfirmOpen(false);

    // ── Step 4: Refresh tasks from server if new tasks were created ──
    const createdCount = Object.keys(createdTaskMap).length;
    if (createdCount > 0) {
      await fetchData(); // refresh task list so new columns appear in planilla
    }

    const createdNames = unmappedGradeCols.filter(c => createdTaskMap[c.idx]).map(c => c.header).join(", ");
    setSyncResultMsg({ matched: matchedCount, total: students.length, created: createdCount, createdNames });
  };


  const exportToOfficialTemplate = () => {
    // ── Column layout (matches template image exactly) ──────────────────────
    // A(0):  No.
    // B(1):  NOMBRE COMPLETO
    // C–F(2–5):   SABER 30% → 4 slots
    // G–P(6–15):  HACER 50% → 10 slots
    // Q–S(16–18): SER 20%   → 3 slots
    // T(19): DEF SABER  (formula)
    // U(20): DEF HACER  (formula)
    // V(21): DEF SER    (formula)
    // W(22): DEF final  (formula)
    // X(23): DESEMPEÑO  (formula)
    const TOTAL_COLS = 24;
    const SABER_START = 2;  const SABER_SLOTS = 4;
    const HACER_START = 6;  const HACER_SLOTS = 10;
    const SER_START  = 16;  const SER_SLOTS   = 3;
    const COL_DEF_SABER = 19;
    const COL_DEF_HACER = 20;
    const COL_DEF_SER   = 21;
    const COL_DEF       = 22;
    const COL_DESEMP    = 23;

    const saberTasks = byType("EXAM").slice(0, SABER_SLOTS);
    const hacerTasks = byType("TASK").slice(0, HACER_SLOTS);
    const serTasks   = byType("SER").slice(0, SER_SLOTS);

    const saberPct = (courseWeights?.saberPercent ?? 30) / 100;
    const hacerPct = (courseWeights?.hacerPercent ?? 50) / 100;
    const serPct   = (courseWeights?.serPercent   ?? 20) / 100;

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const gradeLabel = selectedGroup?.grade?.name
      ? `${selectedGroup.grade.name} - ${selectedGroup.name}`
      : (selectedGroup?.name ?? "");

    // Helper: build empty row of TOTAL_COLS cells
    const emptyRow = () => Array<any>(TOTAL_COLS).fill("");

    // ── Row 0: INSTITUCIÓN EDUCATIVA ─────────────────────────────────────
    const r0 = emptyRow(); r0[0] = "INSTITUCIÓN EDUCATIVA";
    // ── Row 1: School name ───────────────────────────────────────────────
    const r1 = emptyRow(); r1[0] = "MONSEÑOR DÍAZ PLATA";
    // ── Row 2: LISTADO DE DESEMPEÑO ──────────────────────────────────────
    const r2 = emptyRow(); r2[0] = "LISTADO DE DESEMPEÑO 2026";
    // ── Row 3: empty ─────────────────────────────────────────────────────
    const r3 = emptyRow();
    // ── Row 4: meta (DOCENTE / ASIGNATURA / GRADO / PERIODO) ────────────
    const r4 = emptyRow();
    r4[0]  = "DOCENTE:";   r4[1]  = teacherName;
    r4[4]  = "ASIGNATURA:"; r4[5]  = selectedCourse?.name ?? "";
    r4[11] = "GRADO:";     r4[12] = gradeLabel;
    r4[16] = "PERIODO:";   r4[17] = selectedPeriod;
    // ── Row 5: empty ─────────────────────────────────────────────────────
    const r5 = emptyRow();
    // ── Row 6: category headers ──────────────────────────────────────────
    const r6 = emptyRow();
    r6[0]  = "No.";
    r6[1]  = "NOMBRE COMPLETO";
    r6[SABER_START] = `SABER ${Math.round(saberPct * 100)}%`;
    r6[HACER_START] = `HACER ${Math.round(hacerPct * 100)}%`;
    r6[SER_START]   = `SER ${Math.round(serPct * 100)}%`;
    r6[COL_DEF_SABER] = "DEF";
    r6[COL_DEF]     = "DEF";
    r6[COL_DESEMP]  = "DESEMPEÑO";
    // ── Row 7: sub-column numbers ─────────────────────────────────────────
    const r7 = emptyRow();
    for (let j = 0; j < SABER_SLOTS; j++) r7[SABER_START + j] = j + 1;
    for (let j = 0; j < HACER_SLOTS; j++) r7[HACER_START + j] = j + 1;
    for (let j = 0; j < SER_SLOTS;   j++) r7[SER_START   + j] = j + 1;
    r7[COL_DEF_SABER] = "SABER";
    r7[COL_DEF_HACER] = "HACER";
    r7[COL_DEF_SER]   = "SER";

    const wsData: any[][] = [r0, r1, r2, r3, r4, r5, r6, r7];

    // ── Data rows start at Excel row 9 (1-indexed), index 8 ──────────────
    const FIRST_DATA_EXCEL_ROW = 9;

    students.forEach((student, i) => {
      const grades = gradesGrid[student.id] || {};
      const excelRow = FIRST_DATA_EXCEL_ROW + i; // 1-indexed for formulas

      const row: any[] = [i + 1, student.name];

      // SABER slots
      for (let j = 0; j < SABER_SLOTS; j++) {
        const t = saberTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }
      // HACER slots
      for (let j = 0; j < HACER_SLOTS; j++) {
        const t = hacerTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }
      // SER slots
      for (let j = 0; j < SER_SLOTS; j++) {
        const t = serTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }

      // Excel column letters for formula references
      const sE = "C"; const sL = "F"; // SABER C:F
      const hE = "G"; const hL = "P"; // HACER G:P
      const aE = "Q"; const aL = "S"; // SER   Q:S
      const dS = "T"; const dH = "U"; const dA = "V"; const dF = "W";

      row.push({ t: "n", f: `IFERROR(AVERAGE(${sE}${excelRow}:${sL}${excelRow})*${saberPct},0)` });
      row.push({ t: "n", f: `IFERROR(AVERAGE(${hE}${excelRow}:${hL}${excelRow})*${hacerPct},0)` });
      row.push({ t: "n", f: `IFERROR(AVERAGE(${aE}${excelRow}:${aL}${excelRow})*${serPct},0)` });
      row.push({ t: "n", f: `IFERROR(${dS}${excelRow}+${dH}${excelRow}+${dA}${excelRow},0)` });
      row.push({ t: "s", f: `IF(${dF}${excelRow}=0,"",IF(${dF}${excelRow}>=4.6,"SUPERIOR",IF(${dF}${excelRow}>=4.0,"ALTO",IF(${dF}${excelRow}>=3.0,"BÁSICO","BAJO"))))` });

      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // ── Column widths ────────────────────────────────────────────────────
    ws["!cols"] = [
      { wch: 5 },   // A: No.
      { wch: 28 },  // B: Nombre
      ...Array(SABER_SLOTS).fill(null).map(() => ({ wch: 7 })),  // C-F
      ...Array(HACER_SLOTS).fill(null).map(() => ({ wch: 7 })),  // G-P
      ...Array(SER_SLOTS).fill(null).map(() => ({ wch: 7 })),    // Q-S
      { wch: 10 }, { wch: 10 }, { wch: 10 },  // T-V: DEF sub
      { wch: 10 },  // W: DEF
      { wch: 13 },  // X: DESEMPEÑO
    ];

    // ── Row heights ───────────────────────────────────────────────────────
    ws["!rows"] = [
      { hpt: 18 }, // Row 1: Institution
      { hpt: 28 }, // Row 2: School name
      { hpt: 18 }, // Row 3: Listado
      { hpt: 10 }, // Row 4: empty
      { hpt: 20 }, // Row 5: meta
      { hpt: 10 }, // Row 6: empty
      { hpt: 30 }, // Row 7: category headers
      { hpt: 20 }, // Row 8: sub-numbers
    ];

    // ── Cell merges ───────────────────────────────────────────────────────
    ws["!merges"] = [
      // Title rows
      { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } }, // INSTITUCIÓN
      { s: { r: 1, c: 0 }, e: { r: 1, c: TOTAL_COLS - 1 } }, // School name
      { s: { r: 2, c: 0 }, e: { r: 2, c: TOTAL_COLS - 1 } }, // Listado
      // Meta row
      { s: { r: 4, c: 1  }, e: { r: 4, c: 3  } },  // Teacher name value
      { s: { r: 4, c: 5  }, e: { r: 4, c: 10 } },  // Subject value
      { s: { r: 4, c: 12 }, e: { r: 4, c: 15 } },  // Grade value
      { s: { r: 4, c: 17 }, e: { r: 4, c: TOTAL_COLS - 1 } }, // Period value
      // Category header row (row 6) — "No." and "NOMBRE" span 2 rows
      { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },  // No.
      { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } },  // NOMBRE COMPLETO
      { s: { r: 6, c: SABER_START }, e: { r: 6, c: SABER_START + SABER_SLOTS - 1 } }, // SABER
      { s: { r: 6, c: HACER_START }, e: { r: 6, c: HACER_START + HACER_SLOTS - 1 } }, // HACER
      { s: { r: 6, c: SER_START   }, e: { r: 6, c: SER_START   + SER_SLOTS   - 1 } }, // SER
      { s: { r: 6, c: COL_DEF_SABER }, e: { r: 6, c: COL_DEF_SER } }, // DEF (3 sub-cols)
      { s: { r: 6, c: COL_DEF    }, e: { r: 7, c: COL_DEF    } }, // DEF final spans 2 rows
      { s: { r: 6, c: COL_DESEMP }, e: { r: 7, c: COL_DESEMP } }, // DESEMPEÑO spans 2 rows
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planilla Oficial");
    const safeName = (selectedCourse?.name ?? "").replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `Planilla_Oficial_${safeName}_${selectedPeriod}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    doc.text(`Consolidado — ${selectedCourse?.name ?? ""}  |  ${selectedPeriod}  |  Docente: ${teacherName}`, 14, 14);
    autoTable(doc, { html: "#planillas-table", startY: 22, styles: { fontSize: 7 } });
    doc.save(`Planilla_${selectedCourse?.name}_${selectedPeriod}.pdf`);
  };

  // Derived from pctForm so sub-headers update live
  const sp = pctForm.saber;
  const hp = pctForm.hacer;
  const ep = pctForm.ser;
  const fp = pctForm.final;

  const showFinal  = byType("FINAL").length  > 0 || fp > 0;
  const showAttend = byType("ATTEND").length > 0;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderCatHeader = (cat: typeof CATEGORIES[number]) => {
    const catTasks = byType(cat.type);
    return (
      <th
        key={cat.type}
        colSpan={Math.max(1, catTasks.length)}
        className={`border border-gray-200 dark:border-gray-700 p-2 uppercase tracking-wide font-bold text-xs ${cat.color.header}`}
      >
        <div className="flex items-center justify-center gap-1.5">
          <span>{cat.label}</span>
          <button
            onClick={() => openAddModal(cat.type as CatType)}
            className={`p-1 rounded transition-colors ${cat.color.btn}`}
            title={`Agregar columna de ${cat.label}`}
          >
            <Plus size={12} />
          </button>
        </div>
      </th>
    );
  };

  const renderTaskNumHeader = (cat: typeof CATEGORIES[number]) => {
    const catTasks = byType(cat.type);
    return (
      <>
        {catTasks.length === 0
          ? <th key={`${cat.type}-empty`} className="border border-gray-200 dark:border-gray-700 p-1 font-normal italic text-gray-400" style={{ width: "56px", minWidth: "56px" }}>—</th>
          : catTasks.map(t => (
              <th key={t.id} title={t.title} className="border border-gray-200 dark:border-gray-700 p-1 cursor-help text-center group relative" style={{ width: "56px", minWidth: "56px" }}>
                <div className="flex flex-col items-center">
                  <span>{taskNumbers[t.id]}</span>
                  <button
                    onClick={() => handleDeleteTask(t.id, t.title)}
                    disabled={deletingId === t.id}
                    className="opacity-0 group-hover:opacity-100 absolute -top-0.5 -right-0.5 text-red-400 hover:text-red-600 transition-all"
                    title="Eliminar columna"
                  >
                    {deletingId === t.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                  </button>
                </div>
              </th>
            ))
        }
      </>
    );
  };

  const renderStudentCatCells = (studentId: string, cat: typeof CATEGORIES[number], isFirst: boolean = false) => {
    const catTasks = byType(cat.type);
    const g        = gradesGrid[studentId] ?? {};
    return (
      <>
        {catTasks.length === 0
          ? <td key={`${cat.type}-empty`} className={`p-1 border border-gray-100 dark:border-gray-700 ${cat.color.cell} ${isFirst ? `border-l-2 ${cat.color.cellBorder}` : ""}`}></td>
          : catTasks.map((t, tIdx) => {
              const val       = g[t.id] ?? "";
              const num       = parseFloat(val);
              const isLow     = val !== "" && !isNaN(num) && num < 3.0;
              const isChanged = val !== (initialGrid[studentId]?.[t.id] ?? "");
              return (
                <td key={t.id}
                  className={`p-1 border border-gray-100 dark:border-gray-700 text-center ${
                    isChanged ? "bg-amber-50 dark:bg-amber-900/20"
                    : isLow   ? "bg-red-50/60 dark:bg-red-900/10"
                    : cat.color.cell
                  } ${tIdx === 0 ? `border-l-2 ${cat.color.cellBorder}` : ""}`}
                  style={{ width: "56px", minWidth: "56px" }}
                >
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={val}
                    placeholder="—"
                    onChange={e => handleCell(studentId, t.id, e.target.value)}
                    className={`w-full text-center font-bold rounded border px-1 py-0.5 bg-white dark:bg-gray-800 text-xs outline-none focus:ring-1 focus:ring-orange-400 transition-colors ${
                      isLow     ? "text-red-600 border-red-200 dark:border-red-700"
                      : val !== "" ? "text-green-700 dark:text-green-400 border-green-200 dark:border-green-700"
                      : "text-gray-400 border-gray-200 dark:border-gray-600"
                    } ${isChanged ? "border-amber-300 dark:border-amber-600" : ""}`}
                    style={{ MozAppearance: "textfield" } as React.CSSProperties}
                  />
                </td>
              );
            })
        }
      </>
    );
  };

  const pondCell = (val: number | null, color: string) => (
    <td className="p-1.5 border border-gray-200 dark:border-gray-700 bg-blue-50/40 dark:bg-blue-900/10 font-bold text-center text-xs">
      <span style={{ color: val !== null ? color : "#9ca3af" }}>
        {val !== null ? val.toFixed(2) : "—"}
      </span>
    </td>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-12">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/docente" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Consolidado de Calificaciones</h1>
            <p className="text-muted text-sm">{selectedCourse?.name ?? "Selecciona una asignatura"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted">
            {students.length} estudiantes
          </span>
          
          {/* Excel Sync Toolbar */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            <button 
              onClick={exportToExcelSync} 
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-900 px-2.5 py-1.5 rounded-md flex items-center gap-1"
              title="Descargar planilla limpia con códigos ocultos para calificar en Excel"
            >
              <FileSpreadsheet size={13} className="text-green-600 animate-pulse" /> Descargar Sincro
            </button>
            <label 
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-900 px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              title="Cargar archivo Excel para sincronizar las notas con la plataforma"
            >
              <Plus size={13} className="text-blue-600" /> Cargar Sincro
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={importFromExcelSync} 
                className="hidden" 
              />
            </label>
          </div>

          {/* Import from any local Excel */}
          <label
            className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
              bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/40"
            title="Sube tu planilla Excel local y sincroniza las notas con la plataforma"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar mi Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importFromExcelSync}
              className="hidden"
            />
          </label>

          <button onClick={exportToOfficialTemplate} className="btn btn-secondary flex items-center gap-1.5 text-sm" style={{ background: "#1d4ed8", borderColor: "#1e40af", color: "#fff" }} title="Genera la planilla oficial en formato Monseñor Díaz Plata con todas las notas">
            <FileSpreadsheet size={15} /> Planilla Oficial
          </button>
          <button onClick={exportToExcel} className="btn btn-secondary flex items-center gap-1.5 text-sm">
            <FileSpreadsheet size={15} /> Excel (Vista)
          </button>
          <button onClick={exportToPDF} className="btn btn-primary flex items-center gap-1.5 text-sm" style={{ background: "#f97316", borderColor: "#ea580c" }}>
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="card p-4 rounded-xl border flex flex-wrap gap-5 items-end" style={{ borderColor: "var(--border-color)" }}>
        {[
          { label: "Asignatura", value: selectedCourseId, onChange: setSelectedCourseId,
            options: courses.map(c => ({ value: c.id, label: c.name })) },
          { label: "Periodo",    value: selectedPeriod,   onChange: setSelectedPeriod,
            options: periods.map(p => ({ value: p.name, label: p.name })) },
          { label: "Grado y Curso (Grupo)", value: selectedGroupId, onChange: setSelectedGroupId,
            options: groups.map(g => ({ value: g.id, label: g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name })) },
        ].map(({ label, value, onChange, options }) => (
          <div key={label} className="flex-1 min-w-[170px]">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>
            <select
              className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "var(--border-color)" }}
              value={value}
              onChange={e => onChange(e.target.value)}
            >
              {options.length === 0 && <option value="">Sin opciones</option>}
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 text-sm font-semibold">
            <AlertTriangle size={18} className="text-orange-500" />
            Hay notas editadas sin guardar.
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setGradesGrid(JSON.parse(JSON.stringify(initialGrid))); setSaveError(""); }} disabled={saving}
              className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
              <Undo2 size={14} /> Descartar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="btn btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar Notas
            </button>
          </div>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl p-4 text-sm font-bold">
          <Check size={18} /> Calificaciones guardadas correctamente.
        </div>
      )}
      {saveError && <div className="alert alert-danger">{saveError}</div>}

      {/* Main spreadsheet card */}
      <div className="rounded-2xl border shadow-sm bg-white dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>

        {/* Period banner */}
        <div className="flex items-center justify-center py-2.5 bg-orange-100 dark:bg-orange-950/30 border-b" style={{ borderColor: "var(--border-color)" }}>
          <span className="font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 px-4 py-1 rounded-full shadow-sm text-sm">
            {selectedPeriod}
          </span>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-2 md:grid-cols-4 text-sm p-4 border-b gap-4" style={{ borderColor: "var(--border-color)" }}>
          {[
            { label: "Docente",      value: teacherName },
            { label: "Asignatura",   value: selectedCourse?.name ?? "—" },
            { label: "Año Lectivo",  value: new Date().getFullYear() },
            { label: "Periodo",      value: selectedPeriod },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-bold text-gray-400 uppercase mb-0.5">{label}</div>
              <div className="font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Editable Weights exactly styled as requested */}
        <div className="border-b px-4 py-3 bg-white dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap items-center gap-4">

            {/* Icon + Title */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
              <span>Pesos de Evaluación</span>
            </div>

            {/* SABER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-700 dark:text-purple-400 text-xs">Saber</span>
              <div className="flex items-center bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-full px-2.5 py-0.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={pctForm.saber}
                  onChange={e => {
                    setPctForm(p => ({ ...p, saber: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }));
                    setPctSuccess(false);
                  }}
                  className="w-8 text-center font-bold bg-transparent border-none outline-none text-purple-700 dark:text-purple-400 text-xs p-0"
                />
                <span className="text-purple-700 dark:text-purple-400 font-semibold text-xs ml-0.5">%</span>
              </div>
            </div>

            {/* HACER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-700 dark:text-orange-400 text-xs">Hacer</span>
              <div className="flex items-center bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-full px-2.5 py-0.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={pctForm.hacer}
                  onChange={e => {
                    setPctForm(p => ({ ...p, hacer: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }));
                    setPctSuccess(false);
                  }}
                  className="w-8 text-center font-bold bg-transparent border-none outline-none text-orange-700 dark:text-orange-400 text-xs p-0"
                />
                <span className="text-orange-700 dark:text-orange-400 font-semibold text-xs ml-0.5">%</span>
              </div>
            </div>

            {/* SER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-yellow-700 dark:text-yellow-500 text-xs">Ser</span>
              <div className="flex items-center bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-full px-2.5 py-0.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={pctForm.ser}
                  onChange={e => {
                    setPctForm(p => ({ ...p, ser: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }));
                    setPctSuccess(false);
                  }}
                  className="w-8 text-center font-bold bg-transparent border-none outline-none text-yellow-700 dark:text-yellow-500 text-xs p-0"
                />
                <span className="text-yellow-700 dark:text-yellow-500 font-semibold text-xs ml-0.5">%</span>
              </div>
            </div>

            {/* EXAMEN FINAL */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-700 dark:text-sky-400 text-xs">Exam. Final</span>
              <div className="flex items-center bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-full px-2.5 py-0.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={pctForm.final}
                  onChange={e => {
                    setPctForm(p => ({ ...p, final: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }));
                    setPctSuccess(false);
                  }}
                  className="w-8 text-center font-bold bg-transparent border-none outline-none text-sky-700 dark:text-sky-400 text-xs p-0"
                />
                <span className="text-sky-700 dark:text-sky-400 font-semibold text-xs ml-0.5">%</span>
              </div>
            </div>

            {/* Total Indicator */}
            <div className={`font-bold text-xs px-2.5 py-1 rounded-full ${
              pctTotal === 100
                ? "text-green-700 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                : "text-red-700 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
            }`}>
              Total: {pctTotal}%
            </div>

            {/* Actions aligned to the right or next in line */}
            <div className="flex items-center gap-2 ml-auto">
              {pctChanged && pctTotal === 100 && (
                <button
                  onClick={handleSavePct}
                  disabled={savingPct}
                  className="text-xs font-bold text-[#f97316] border border-[#f97316] bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-orange-50 transition-colors"
                >
                  {savingPct ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Guardar Pesos
                </button>
              )}

              {pctSuccess && (
                <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-bold text-xs mr-2 animate-fade-in">
                  <Check size={13} /> Pesos guardados
                </span>
              )}
              {pctError && (
                <span className="text-red-600 text-xs font-semibold mr-2">{pctError}</span>
              )}

              <button
                onClick={() => openAddModal("FINAL")}
                className="text-xs font-bold text-sky-600 border border-sky-200 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-sky-50 transition-colors"
              >
                <Plus size={13} /> Activar Examen Final
              </button>
              <button
                onClick={() => openAddModal("ATTEND")}
                className="text-xs font-bold text-green-600 border border-green-200 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-green-50 transition-colors"
              >
                <Plus size={13} /> Activar Asistencia
              </button>
            </div>

          </div>
        </div>


        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table id="planillas-table" className="border-collapse text-xs text-center" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
              <colgroup>
                <col style={{ width: "36px" }} />{/* No. */}
                <col style={{ width: "200px" }} />{/* Nombre */}
                {CATEGORIES.map(cat => {
                  if (cat.type === "FINAL"  && !showFinal)  return null;
                  if (cat.type === "ATTEND" && !showAttend) return null;
                  const count = Math.max(1, byType(cat.type).length);
                  return Array.from({ length: count }, (_, i) => (
                    <col key={`col-${cat.type}-${i}`} style={{ width: "56px" }} />
                  ));
                })}
                <col style={{ width: "56px" }} />{/* DEF Saber */}
                <col style={{ width: "56px" }} />{/* DEF Hacer */}
                <col style={{ width: "56px" }} />{/* DEF Ser */}
                {showFinal && <col style={{ width: "56px" }} />}{/* DEF Final */}
                <col style={{ width: "80px" }} />{/* Def Final */}
                <col style={{ width: "90px" }} />{/* Desempeño */}
              </colgroup>
              <thead>
                {/* Row 1: Category headers */}
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2" style={{ width: "36px", minWidth: "36px" }}>No.</th>
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2 text-left" style={{ width: "200px", minWidth: "200px" }}>Nombre Completo</th>
                  {CATEGORIES.map(cat => {
                    if (cat.type === "FINAL"  && !showFinal)  return null;
                    if (cat.type === "ATTEND" && !showAttend) return null;
                    return renderCatHeader(cat);
                  })}
                  <th colSpan={showFinal ? 4 : 3} className="border border-gray-200 dark:border-gray-700 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 uppercase tracking-wide font-bold text-xs">
                    DEF (Ponderada)
                  </th>
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2 bg-gray-100 dark:bg-gray-800 font-bold">Def Final</th>
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2 font-bold">Desempeño</th>
                </tr>

                {/* Row 2: Task numbers */}
                <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold text-gray-500 dark:text-gray-400">
                  {CATEGORIES.map(cat => {
                    if (cat.type === "FINAL"  && !showFinal)  return null;
                    if (cat.type === "ATTEND" && !showAttend) return null;
                    return <React.Fragment key={cat.type}>{renderTaskNumHeader(cat)}</React.Fragment>;
                  })}
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10" style={{ width: "56px", minWidth: "56px" }}>Saber</th>
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10" style={{ width: "56px", minWidth: "56px" }}>Hacer</th>
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10" style={{ width: "56px", minWidth: "56px" }}>Ser</th>
                  {showFinal && <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10" style={{ width: "56px", minWidth: "56px" }}>Final</th>}
                </tr>
              </thead>

              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={30} className="py-14 text-muted font-medium italic">
                      No hay estudiantes en este grupo o aún no hay actividades para este periodo.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => {
                    const stats = calcStats(student.id);
                    const desemp = stats.total !== null ? getDesempeno(stats.total) : null;

                    return (
                      <tr key={student.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-400 font-medium text-center">{idx + 1}</td>
                        <td className="p-2 border border-gray-200 dark:border-gray-700 text-left">
                          <div className="font-bold text-gray-800 dark:text-gray-200 leading-tight">{student.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{student.group.grade?.name} — {student.group.name}</div>
                        </td>

                        {/* Category cells */}
                        {CATEGORIES.map(cat => {
                          if (cat.type === "FINAL"  && !showFinal)  return null;
                          if (cat.type === "ATTEND" && !showAttend) return null;
                          return <React.Fragment key={cat.type}>{renderStudentCatCells(student.id, cat)}</React.Fragment>;
                        })}

                        {/* Ponderated */}
                        {pondCell(stats.pondSaber, "#a855f7")}
                        {pondCell(stats.pondHacer, "#d97706")}
                        {pondCell(stats.pondSer,   "#b45309")}
                        {showFinal && pondCell(stats.pondFinal, "#0ea5e9")}

                        {/* Final — same color scale as Desempeño */}
                        <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">
                          {stats.total !== null ? (() => {
                            const d = getDesempeno(stats.total);
                            return (
                              <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-sm ${d.cls}`}>
                                {stats.total.toFixed(2)}
                              </span>
                            );
                          })() : <span className="text-gray-400 font-bold">—</span>}
                        </td>

                        {/* Desempeño */}
                        <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">
                          {desemp
                            ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${desemp.cls}`}>{desemp.label}</span>
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Directorio de evaluaciones */}
      {tasks.length > 0 && (
        <div className="card p-5 border rounded-xl bg-gray-50 dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-1.5">
            <Info size={16} className="text-gray-400" />
            Directorio de Evaluaciones — {selectedPeriod}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {tasks.map(t => {
              const cat = CATEGORIES.find(c => c.type === t.type) ?? CATEGORIES[4];
              const isActive = t.active !== false;
              return (
                <div key={t.id} className={`flex flex-col gap-2 p-3 rounded-lg border shadow-sm group transition-opacity ${isActive ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-70"}`}>
                  {/* Top row: badge + title + type */}
                  <div className="flex gap-2 items-start flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded font-black flex-shrink-0 ${cat.color.badge}`}>
                      {taskNumbers[t.id]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 dark:text-gray-200 leading-tight truncate" title={t.title}>{t.title}</p>
                      <p className="text-gray-400 mt-0.5">{cat.label}{cat.sublabel ? ` — ${cat.sublabel}` : ""}</p>
                    </div>
                  </div>
                  {/* Bottom row: actions */}
                  <div className="flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-700 pt-1.5">
                    <div className="flex items-center justify-between">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t.id, isActive)}
                        disabled={togglingId === t.id}
                        title={isActive ? "Visible para alumnos — clic para ocultar" : "Oculto para alumnos — clic para activar"}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-150 dark:hover:bg-gray-800/60 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                      >
                        {togglingId === t.id ? (
                          <Loader2 size={13} className="animate-spin text-gray-400" />
                        ) : isActive ? (
                          <Eye size={13} className="text-[#f97316]" />
                        ) : (
                          <EyeOff size={13} className="text-gray-400" />
                        )}
                        <span className={`text-[10px] font-bold ${isActive ? "text-[#f97316]" : "text-gray-400"}`}>
                          {isActive ? "Visible" : "Oculto"}
                        </span>
                      </button>
                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openGradingModal(t)} className="p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-[#f98012] transition-colors" title="Calificar estudiantes">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => openEditModal(t)} disabled={loadingEdit} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title="Editar evaluación">
                          {loadingEdit ? <Loader2 size={13} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                        </button>
                        <button onClick={() => handleDeleteTask(t.id, t.title)} disabled={deletingId === t.id} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Eliminar evaluación">
                          {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    {/* Gestionar tarea o examen directamente */}
                    {!t.isExternal && (
                      <button
                        onClick={() => openQuestionsModal(t)}
                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors w-full ${
                          t.type === "EXAM"
                            ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                            : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                        }`}
                        title={t.type === "EXAM" ? "Gestionar preguntas, entregas e intentos" : "Gestionar entregas y prórrogas"}
                      >
                        {t.type === "EXAM" ? "Gestionar Examen" : "Gestionar Entregas"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add column modal styled exactly as requested */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">
                {editTaskId
                  ? (addModal.type === "EXAM" ? "Editar Examen" : "Editar Evaluación")
                  : (addModal.type === "EXAM" ? "Nuevo Examen" : "Nueva Evaluación")}
              </h3>
              <button onClick={() => { setAddModal(null); setEditTaskId(null); }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              
              {/* Row 1: Asignatura & Periodo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Asignatura *</label>
                  <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-750 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-450 cursor-not-allowed text-xs font-semibold" disabled>
                    <option>{selectedCourse?.name || "Asignatura"}</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Periodo *</label>
                  <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-750 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-450 cursor-not-allowed text-xs font-semibold" disabled>
                    <option>{selectedPeriod}</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Título del Examen & Tema */}
              <div className="grid grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {addModal.type === "EXAM" ? "Título del Examen *" : "Título de la Evaluación *"}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder={
                      addModal.type === "EXAM"   ? "Ej. Taller de cinemática" :
                      addModal.type === "TASK"   ? "Ej. Taller de Comprensión" :
                      addModal.type === "SER"    ? "Ej. Coevaluación" :
                      addModal.type === "FINAL"  ? "Ej. Examen Final" :
                      "Ej. Asistencia Semana 1"
                    }
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tema *</label>
                  <input
                    type="text"
                    placeholder="Ej. Dinámica, Termodinámica"
                    value={newTaskTheme}
                    onChange={e => setNewTaskTheme(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required
                  />
                </div>
              </div>

              {/* Row 3: Porcentaje, Fecha Límite & Límite de Tiempo */}
              <div className={(addModal?.type === "EXAM" || addModal?.type === "FINAL") ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Porcentaje de la Nota (0-100) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newTaskWeight}
                    onChange={e => setNewTaskWeight(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Límite de Entrega {newTaskIsExternal ? "(Opcional)" : "*"}
                  </label>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required={!newTaskIsExternal}
                  />
                </div>
                {(addModal?.type === "EXAM" || addModal?.type === "FINAL") && (
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Límite de Tiempo (minutos, opcional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej. 60"
                      value={newTaskDuration}
                      onChange={e => setNewTaskDuration(e.target.value)}
                      className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316] disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={newTaskIsExternal}
                    />
                  </div>
                )}
              </div>

              {/* Row 4: Programar Publicación Automática */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Programar Publicación Automática (Fecha y Hora - Opcional)
                </label>
                <input
                  type="datetime-local"
                  value={newTaskPublishAt}
                  onChange={e => setNewTaskPublishAt(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                  Dejar vacío para publicar inmediatamente. Si se define, la tarea se publicará automáticamente al llegar el momento.
                </span>
              </div>

              {/* Checkboxes structured in styled containers */}
              <div className="flex flex-col gap-3">
                {/* Checkbox 1: isExternal */}
                <div className="border border-gray-300 dark:border-gray-750 rounded-lg p-3 bg-white dark:bg-gray-900 flex items-start gap-3">
                  <input
                    id="isExternalCheck"
                    type="checkbox"
                    checked={newTaskIsExternal}
                    onChange={e => setNewTaskIsExternal(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f97316] focus:ring-[#f97316] mt-0.5 cursor-pointer"
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="isExternalCheck" className="font-bold text-xs text-gray-800 dark:text-gray-200 cursor-pointer select-none">
                      Trabajo fuera de la plataforma (Calificación manual)
                    </label>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                      Si se activa, los estudiantes no tendrán que entregar archivos ni responder cuestionarios. La calificación la registrarás tú directamente.
                    </span>
                  </div>
                </div>

                {/* Checkbox 2: allowLateSubmission */}
                <div className="border border-gray-300 dark:border-gray-750 rounded-lg p-3 bg-white dark:bg-gray-900 flex items-center gap-3">
                  <input
                    id="allowLateCheck"
                    type="checkbox"
                    checked={newTaskAllowLateSubmission}
                    onChange={e => setNewTaskAllowLateSubmission(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f97316] focus:ring-[#f97316] cursor-pointer"
                  />
                  <label htmlFor="allowLateCheck" className="font-bold text-xs text-gray-800 dark:text-gray-200 cursor-pointer select-none">
                    Permitir entregas tardías (Prórroga)
                  </label>
                </div>
              </div>

              {/* Course Groups Assignment Checkboxes */}
              {groups.length > 0 && (
                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Asignar a Grupos (Múltiple) *
                  </label>
                  <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                    {groups.map(g => {
                      const label = g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name;
                      const isChecked = newTaskGroupIds.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNewTaskGroupIds(prev => prev.filter(id => id !== g.id));
                              } else {
                                setNewTaskGroupIds(prev => [...prev, g.id]);
                              }
                            }}
                            className="rounded text-[#f97316] focus:ring-[#f97316] w-4 h-4"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {addModal.type === "EXAM" ? "Descripción del Examen" : "Descripción de la Tarea"}
                </label>
                <textarea
                  placeholder="Escribe las instrucciones aquí..."
                  value={newTaskDescription}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                  rows={4}
                />
              </div>

              {/* Task Additions: Enlace Externo & Archivo Adjunto */}
              {addModal.type !== "EXAM" && (
                <>
                  {/* Enlace Externo */}
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Enlace Externo (Opcional, ej. YouTube, lectura web)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. https://www.youtube.com/watch?v=..."
                      value={newTaskExternalUrl}
                      onChange={e => setNewTaskExternalUrl(e.target.value)}
                      className="w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    />
                  </div>

                  {/* Archivo Adjunto */}
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Archivo Adjunto (Opcional)
                    </label>
                    <div 
                      className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer relative"
                      onClick={() => document.getElementById("modal-file-upload")?.click()}
                    >
                      <input
                        id="modal-file-upload"
                        type="file"
                        className="hidden"
                        onChange={e => setNewTaskFile(e.target.files?.[0] || null)}
                      />
                      <svg className="mx-auto h-8 w-8 text-[#f97316] mb-2" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-xs font-bold text-gray-650 dark:text-gray-350 block">
                        {newTaskFile ? newTaskFile.name : "Selecciona una guía o archivo"}
                      </span>
                    </div>
                  </div>
                </>
              )}



            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => { setAddModal(null); setEditTaskId(null); }} className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={editTaskId ? handleEditTask : handleAddTask}
                disabled={addingTask || !newTaskName.trim() || newTaskGroupIds.length === 0}
                className="text-xs font-bold text-white bg-[#f97316] border border-[#ea580c] px-4 py-2 rounded-lg hover:bg-[#ea580c] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingTask ? <Loader2 size={16} className="animate-spin mx-auto" /> : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>{editTaskId ? "Guardar Cambios" : (addModal.type === "EXAM" ? "Crear Examen" : "Crear Tarea")}</span>
                  </>
                )}
              </button>
            </div>


          </div>
        </div>
      )}

      {/* ── Manual Grading Modal ─────────────────────────────────────────── */}
      {gradingTask && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in"
          onClick={e => e.target === e.currentTarget && setGradingTask(null)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-scale-in" style={{ maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex justify-between items-start p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Pencil size={18} className="text-[#f98012]" />
                  Calificación Manual
                </h2>
                <p className="text-sm text-muted mt-0.5 font-semibold">{gradingTask.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  Asigna notas a trabajos realizados <strong>fuera de la plataforma</strong> (
                  {gradingTask.type === "EXAM" ? "Examen — Nota del Saber" : "Tarea — Nota del Hacer"})
                </p>
              </div>
              <button onClick={() => setGradingTask(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Alerts */}
            <div className="px-5 pt-4 flex-shrink-0">
              {gradingError && <div className="alert alert-danger mb-3">{gradingError}</div>}
              {gradingSaved && (
                <div className="alert alert-success mb-3 flex items-center gap-2">
                  <CheckCircle size={16} /> Calificaciones guardadas correctamente.
                </div>
              )}
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {loadingStudents ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-[#f98012]" size={32} />
                </div>
              ) : gradingStudents.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No hay estudiantes asignados a esta evaluación.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Column headers */}
                  <div className="grid text-xs font-bold uppercase tracking-wider text-muted px-3 pb-1" style={{ gridTemplateColumns: "1fr 90px 1fr" }}>
                    <span>Estudiante</span>
                    <span className="text-center">Nota (1–5)</span>
                    <span className="pl-2">Comentario</span>
                  </div>

                  {gradingStudents.map(student => (
                    <div
                      key={student.id}
                      className="grid items-center gap-3 p-3 rounded-xl"
                      style={{
                        gridTemplateColumns: "1fr 90px 1fr",
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
                          <p className="text-[10px] text-muted">{student.groupName}</p>
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
            <div className="flex justify-end gap-3 border-t p-5 flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
              <button className="btn btn-secondary" onClick={() => setGradingTask(null)}>Cerrar</button>
              <button
                className="btn btn-primary"
                disabled={savingGrades || loadingStudents}
                onClick={saveManualGrades}
              >
                {savingGrades ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar Calificaciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam / Task Management Modal */}
      {questionsModalTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-4xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto flex flex-col gap-4">

            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">
                  {questionsModalTask.type === "EXAM" ? "Gestión de Examen" : "Gestión de Tarea"}: {questionsModalTask.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-450 mt-0.5">
                  Administra entregas, prórrogas e intentos directamente desde la planilla.
                </p>
              </div>
              <button onClick={() => setQuestionsModalTask(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Tabs — only for exams */}
            {questionsModalTask.type === "EXAM" && (
              <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
                {(["control", "questions"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setManageTab(tab)}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                      manageTab === tab
                        ? "border-[#f97316] text-[#f97316]"
                        : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                  >
                    {tab === "control" ? "Entregas e Intentos" : "Preguntas del Examen"}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loadingQuestions ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-[#f98012]" size={32} />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Cargando información...</p>
                </div>
              ) : manageTab === "questions" && questionsModalTask.type === "EXAM" ? (
                <QuestionEditor
                  key={questionsModalTask.id}
                  taskId={questionsModalTask.id}
                  initialQuestions={examQuestions}
                />
              ) : (
                <div className="flex flex-col gap-5">

                  {/* Global late submission toggle */}
                  <div className="p-4 rounded-xl border flex flex-col gap-3 bg-gray-50/40 dark:bg-gray-800/20" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock className="text-[#f98012]" size={18} />
                        <div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Prórroga Global (Entrega Tardía)</h4>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Permite entregar después del plazo a todos los estudiantes.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGlobalAllowLate(v => !v)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            globalAllowLate ? "bg-[#f97316]" : "bg-gray-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            globalAllowLate ? "translate-x-[18px]" : "translate-x-1"
                          }`} />
                        </button>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {globalAllowLate ? "Habilitada" : "Deshabilitada"}
                        </span>
                      </div>
                    </div>
                    {globalAllowLate && (
                      <div className="max-w-xs">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hasta:</label>
                        <input
                          type="datetime-local"
                          value={globalLateUntil}
                          onChange={e => setGlobalLateUntil(e.target.value)}
                          className="input-field w-full text-xs py-1.5 px-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                        />
                      </div>
                    )}
                    {(globalAllowLate !== savedGlobalAllowLate || globalLateUntil !== savedGlobalLateUntil) && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setGlobalAllowLate(savedGlobalAllowLate); setGlobalLateUntil(savedGlobalLateUntil); }} className="btn btn-secondary py-1 px-3 text-xs">Cancelar</button>
                        <button onClick={saveGlobalLateConfig} disabled={savingGlobalLate} className="btn btn-primary py-1 px-3 text-xs flex items-center gap-1">
                          {savingGlobalLate && <Loader2 className="animate-spin" size={12} />} Guardar Prórroga
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Students table header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      Entregas ({taskStudents.length} estudiantes)
                    </h4>
                    {questionsModalTask.type === "EXAM" && (
                      <button
                        onClick={resetAllGroupSubmissions}
                        disabled={resettingSubmissions !== null || taskStudents.length === 0}
                        className="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 border border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 disabled:opacity-50"
                      >
                        {resettingSubmissions === "all" ? <Loader2 className="animate-spin" size={13} /> : <Users size={13} />}
                        Reiniciar Todo el Grupo
                      </button>
                    )}
                  </div>

                  {/* Students table */}
                  <div className="overflow-x-auto border rounded-xl" style={{ borderColor: "var(--border-color)" }}>
                    <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/40 font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                          <th className="py-2 px-4">Estudiante</th>
                          <th className="py-2 px-4">Estado</th>
                          <th className="py-2 px-4">Prórroga Individual</th>
                          <th className="py-2 px-4">Fecha Envío</th>
                          <th className="py-2 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskStudents.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic">No hay estudiantes en este grupo.</td></tr>
                        ) : taskStudents.map(s => {
                          const sub = s.submission;
                          const isGraded = sub?.status === "GRADED";
                          const isSubmitted = sub && sub.status !== "PENDING";
                          const hasSub = !!sub;
                          const indAllow = sub?.allowLateSubmission ?? false;
                          const indUntil = sub?.lateSubmissionUntil ? toColombiaISOString(sub.lateSubmissionUntil) : "";
                          return (
                            <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-gray-800 dark:text-gray-200">{s.name}</div>
                                <div className="text-[10px] text-gray-400">{s.groupName}</div>
                              </td>
                              <td className="py-3 px-4">
                                {isGraded ? (
                                  <span className="badge badge-success flex w-fit items-center gap-1"><CheckCircle size={11} /> Calificada: {sub.grade}</span>
                                ) : isSubmitted ? (
                                  <span className="badge badge-info">Entregada</span>
                                ) : (
                                  <span className="badge badge-warning flex w-fit items-center gap-1"><Clock size={11} /> Pendiente</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {globalAllowLate ? (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={11}/> Global</span>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={indAllow}
                                      onChange={e => saveIndividualLateConfig(s.id, e.target.checked, indUntil)}
                                      className="w-3.5 h-3.5 rounded accent-[#f97316]"
                                    />
                                    {indAllow && (
                                      <input
                                        type="datetime-local"
                                        value={indUntil}
                                        onChange={e => saveIndividualLateConfig(s.id, true, e.target.value)}
                                        className="text-[10px] py-0.5 px-1 border rounded bg-white dark:bg-gray-800 outline-none focus:ring-1 focus:ring-[#f97316] border-gray-300 dark:border-gray-700"
                                      />
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-gray-400">
                                {sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "-"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {questionsModalTask.type !== "EXAM" && sub?.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="btn btn-secondary text-[11px] px-2 py-1 flex items-center gap-1"
                                      title="Descargar archivo de entrega"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </a>
                                  )}
                                  {questionsModalTask.type === "EXAM" && (
                                    <button
                                      onClick={() => resetStudentSubmission(s.id, s.name, hasSub)}
                                      disabled={resettingSubmissions === s.id}
                                      className="btn btn-secondary text-[11px] px-2 py-1 flex items-center gap-1 border border-red-100 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
                                    >
                                      {resettingSubmissions === s.id
                                        ? <Loader2 className="animate-spin" size={12} />
                                        : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>}
                                      {hasSub ? "Reiniciar" : "Habilitar"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button className="btn btn-secondary" onClick={() => setQuestionsModalTask(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Excel Synchronization Mapping Modal */}
      {customExcelData && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 animate-fade-in px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-scale-in max-h-[85vh] flex flex-col" style={{ color: "var(--text-primary)" }}>
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h3 className="font-extrabold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileSpreadsheet className="text-green-600 animate-bounce" size={22} /> Sincronizar Excel Personalizado
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Asocia las columnas de tu archivo local con las evaluaciones de la plataforma.
                </p>
              </div>
              <button 
                onClick={() => setCustomExcelData(null)} 
                className="text-gray-400 hover:text-red-500 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-xs">
              
              {/* Header Row Selector */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/30 flex flex-col gap-2" style={{ borderColor: "var(--border-color)" }}>
                <label className="font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  📌 ¿En qué fila están los encabezados (nombres de las columnas)?
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Si tu Excel tiene filas de título o vacías al inicio, selecciona la fila que tiene los nombres de las columnas (ej: Nombres, Notas, Tareas).
                </p>
                <select
                  value={customExcelData.headerIndex}
                  onChange={(e) => handleHeaderRowChange(parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  {customExcelData.rows.slice(0, 15).map((row, idx) => {
                    const rowPreview = row
                      .filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "")
                      .slice(0, 4)
                      .join(" | ");
                    return (
                      <option key={idx} value={idx}>
                        Fila {idx + 1}: {rowPreview ? (rowPreview.length > 80 ? rowPreview.substring(0, 80) + "..." : rowPreview) : "(Vacía)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Student Name Column Selector */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/30 flex flex-col gap-2" style={{ borderColor: "var(--border-color)" }}>
                <label className="font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  1. Columna de Nombres de Estudiantes
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Selecciona la columna del Excel que contiene los nombres completos de tus alumnos.
                </p>
                <select
                  value={excelStudentCol}
                  onChange={(e) => setExcelStudentCol(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  <option value={-1}>-- Selecciona una columna --</option>
                  {customExcelData.headers.map((h, idx) => (
                    <option key={idx} value={idx}>{colLetter(idx)}{customExcelData.headerIndex + 1}: {h}</option>
                  ))}
                </select>
              </div>

              {/* Platform Task Mapping Grid */}
              <div className="flex flex-col gap-3">
                <label className="font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  2. Asociar Evaluaciones
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  Asocia cada columna de tu Excel local con la respectiva actividad en la plataforma:
                </p>
                
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-b font-bold text-gray-600 dark:text-gray-300" style={{ borderColor: "var(--border-color)" }}>
                        <th className="p-3">Evaluación en Plataforma</th>
                        <th className="p-3">Columna en tu Excel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {CATEGORIES.map(cat => {
                        if (cat.type === "FINAL" && !showFinal) return null;
                        if (cat.type === "ATTEND" && !showAttend) return null;
                        const catTasks = byType(cat.type);
                        
                        return catTasks.map(t => {
                          const platformLabel = `${cat.label} ${taskNumbers[t.id]}`;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                              <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black mr-2 uppercase ${cat.color.badge}`}>
                                  {platformLabel}
                                </span>
                                {t.title}
                              </td>
                              <td className="p-2 w-72">
                                <select
                                  value={excelTaskMappings[t.id] ?? -1}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setExcelTaskMappings(prev => ({ ...prev, [t.id]: val }));
                                  }}
                                  className="w-full p-2 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                                >
                                  <option value={-1}>-- No importar esta columna --</option>
                                  {customExcelData.headers.map((h, idx) => (
                                    <option key={idx} value={idx}>{colLetter(idx)}{customExcelData.headerIndex + 1}: {h}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t mt-4" style={{ borderColor: "var(--border-color)" }}>
              <button 
                type="button" 
                onClick={() => setCustomExcelData(null)}
                className="btn btn-secondary text-xs py-2 px-4"
              >
                Cancelar
              </button>

              <button 
                type="button" 
                onClick={() => setSyncConfirmOpen(true)}
                disabled={excelStudentCol === -1}
                className="btn btn-primary text-xs py-2 px-6 font-bold flex items-center gap-2 transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", borderColor: "#ea580c", opacity: excelStudentCol === -1 ? 0.5 : 1 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Sincronizar Calificaciones
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Sync Confirm Modal ── */}
      {syncConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#f97316,#fb923c)" }} />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.12)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-100 mb-1">¿Confirmar sincronización?</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Esta acción importará las calificaciones del Excel a la planilla de la plataforma.
                    Las notas quedarán resaltadas para que puedas revisarlas antes de guardar.
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)", color: "#92400e" }}>
                💡 Esta acción <strong>no guarda automáticamente</strong>. Debes hacer clic en <strong>"Guardar"</strong> después de revisar.
              </div>
              <div className="flex gap-3 mt-6 justify-end">
                <button
                  onClick={() => setSyncConfirmOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCustomExcelSync}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all hover:brightness-110 shadow-lg"
                  style={{ background: "linear-gradient(135deg,#f97316,#ea580c)", boxShadow: "0 4px 15px rgba(249,115,22,0.35)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Sí, sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync Result Modal ── */}
      {syncResultMsg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#10b981,#059669)" }} />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-100 mb-1">¡Sincronización exitosa!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Las calificaciones fueron importadas a la planilla.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Estudiantes coincidentes</span>
                  <span className="text-xl font-extrabold" style={{ color: "#059669" }}>{syncResultMsg.matched} <span className="text-sm font-normal text-gray-400">/ {syncResultMsg.total}</span></span>
                </div>
                {syncResultMsg.created > 0 && (
                  <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", color: "#1e40af" }}>
                    <span className="font-bold">🆕 {syncResultMsg.created} evaluación(es) creada(s) automáticamente:</span>
                    <br /><span className="opacity-80">{syncResultMsg.createdNames}</span>
                  </div>
                )}
                <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)", color: "#92400e" }}>
                  📝 Revisa las notas resaltadas en <strong>amarillo</strong> y haz clic en <strong>"Guardar"</strong> para confirmarlas en la base de datos.
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSyncResultMsg(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 shadow-lg"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 15px rgba(16,185,129,0.35)" }}
                >
                  Entendido ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
