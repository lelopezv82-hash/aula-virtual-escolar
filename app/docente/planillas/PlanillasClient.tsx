"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, FileSpreadsheet, FileText, Loader2,
  Save, Undo2, AlertTriangle, Check, Info,
  Plus, Trash2, X, Pencil, CheckCircle, AlertCircle, Clock,
  Eye, EyeOff, Users, Search, Sparkles, Copy
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QuestionEditor from "../tareas/[id]/QuestionEditor";
import { toColombiaISOString, fromColombiaLocalStringToDate, getTaskDeadlineStatus } from "@/lib/dateUtils";
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
  dueDate?: string;
  allowLateSubmission?: boolean;
  lateSubmissionUntil?: string;
  duration?: number;
  submissions: { 
    studentId: string; 
    grade: number | null; 
    status: string;
    startedAt?: string;
    allowLateSubmission?: boolean;
    lateSubmissionUntil?: string;
  }[];
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

// SABER = EXAM / TASK_SABER (exámenes / tareas), HACER = TASK (tareas), SER = SER (actitudinal)
const CATEGORIES = [
  { type: "EXAM",   label: "SABER",       sublabel: "Exámenes / Tareas", pctKey: "saberPercent",  color: { header: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300", cell: "bg-purple-50/60 dark:bg-purple-900/10", cellBorder: "border-l-purple-300 dark:border-l-purple-700", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", dot: "#a855f7", btn: "hover:bg-purple-200 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" } },
  { type: "TASK",   label: "HACER",       sublabel: "Tareas",      pctKey: "hacerPercent",  color: { header: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300", cell: "bg-orange-50/60 dark:bg-orange-900/10", cellBorder: "border-l-orange-300 dark:border-l-orange-700", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300", dot: "#d97706", btn: "hover:bg-orange-200 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" } },
  { type: "SER",    label: "SER",         sublabel: "Actitudinal", pctKey: "serPercent",    color: { header: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300", cell: "bg-teal-50/60 dark:bg-teal-900/10", cellBorder: "border-l-teal-400 dark:border-l-teal-700", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300", dot: "#0d9488", btn: "hover:bg-teal-200 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" } },
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
  const searchParams = useSearchParams();
  const initCourseId = searchParams.get("courseId") || courses[0]?.id || "";
  const initGroupId = searchParams.get("groupId") || "";

  // ── Selector state ──
  const [selectedCourseId, setSelectedCourseId] = useState(initCourseId);
  const [selectedPeriod,   setSelectedPeriod]   = useState(periods[0]?.name ?? "Periodo 1");
  const [selectedGroupId,  setSelectedGroupId]  = useState(initGroupId);

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

  // ── Portal mount guard (SSR-safe) ──
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // ── Add column modal ──
  const [addModal,    setAddModal]    = useState<{ type: CatType } | null>(null);
  const [selectedSaberSubtype, setSelectedSaberSubtype] = useState<"TASK_SABER" | "EXAM">("TASK_SABER");
  const [allCourseStudents, setAllCourseStudents] = useState<{ id: string; name: string; groupName?: string; grade?: string; groupId?: string; group?: any }[]>([]);
  const [newTaskStudentIds, setNewTaskStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskIsExternal, setNewTaskIsExternal] = useState(true);
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [newTaskWeight, setNewTaskWeight] = useState("0");
  const [newTaskGroupIds, setNewTaskGroupIds] = useState<string[]>([]);
  const [newTaskSelectedThemes, setNewTaskSelectedThemes] = useState<string[]>([]);
  const [planillasThemes, setPlanillasThemes] = useState<{id: string, title: string}[]>([]);
  const [newTaskPublishAt, setNewTaskPublishAt] = useState("");
  const [newTaskAllowLateSubmission, setNewTaskAllowLateSubmission] = useState(false);
  const [newTaskLateSubmissionUntil, setNewTaskLateSubmissionUntil] = useState("");
  const [newTaskExternalUrl, setNewTaskExternalUrl] = useState("");
  const [newTaskFile, setNewTaskFile] = useState<File | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [addingTask,  setAddingTask]  = useState(false);

  // ── Resource linking in modal ──
  const [modalResources, setModalResources] = useState<{id: string; title: string; type: string}[]>([]);
  const [newTaskResourceIds, setNewTaskResourceIds] = useState<string[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // ── Edit modal ──
  const [editTaskId,  setEditTaskId]  = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // ── Toggle active ──
  const [togglingId, setTogglingId]  = useState<string | null>(null);

  // ── Delete confirm ──
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Manual Grading Full-Screen State ──
  const [gradingTask, setGradingTask] = useState<TaskItem | null>(null);
  const [gradingStudents, setGradingStudents] = useState<Array<{ id: string; name: string; groupName: string; submission: { id: string; status: string; grade: number | null; feedback: string | null; submittedAt: string | null; fileUrl: string | null } | null }>>([]); 
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
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

  // ── Duplication / Cloning Modal State ──
  const [duplicateModalTask, setDuplicateModalTask] = useState<TaskItem | null>(null);
  const [duplicateTargetCourseId, setDuplicateTargetCourseId] = useState<string>("");
  const [duplicateTargetGroupIds, setDuplicateTargetGroupIds] = useState<string[]>([]);
  const [duplicateTargetPeriod, setDuplicateTargetPeriod] = useState<string>("");
  const [duplicateTitle, setDuplicateTitle] = useState<string>("");
  const [duplicateDueDate, setDuplicateDueDate] = useState<string>("");
  const [duplicating, setDuplicating] = useState<boolean>(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState<string>("");
  const [duplicateError, setDuplicateError] = useState<string>("");

  // ── Reusable tasks for Add Modal ──
  const [reusableTasks, setReusableTasks] = useState<any[]>([]);
  const [loadingReusableTasks, setLoadingReusableTasks] = useState(false);
  const [selectedReuseTaskId, setSelectedReuseTaskId] = useState<string>("");
  const [showReusePicker, setShowReusePicker] = useState<boolean>(false);

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
  const [syncResultMsg, setSyncResultMsg] = useState<{ matched: number; total: number; added: number; skipped: number } | null>(null);
  const [syncPreview, setSyncPreview] = useState<{ toAdd: number; toSkip: number; unmatched: number } | null>(null);

  // Google Drive Sync states
  const [gDriveConnected, setGDriveConnected] = useState(false);
  const [gDriveFileExists, setGDriveFileExists] = useState(false);
  const [gDriveWebViewLink, setGDriveWebViewLink] = useState("");
  const [gDriveSyncing, setGDriveSyncing] = useState(false);
  const [gDriveStatusLoading, setGDriveStatusLoading] = useState(true);
  const [gDriveUploading, setGDriveUploading] = useState(false);
  const [gDriveSuccessInfo, setGDriveSuccessInfo] = useState<{
    message: string; webViewLink: string; drivePath: string;
  } | null>(null);

  const loadGDriveStatus = useCallback(async () => {
    if (!selectedCourseId || !selectedPeriod) return;
    setGDriveStatusLoading(true);
    try {
      const res = await fetch(`/api/docente/gdrive/sync?courseId=${selectedCourseId}&period=${encodeURIComponent(selectedPeriod)}`);
      const json = await res.json();
      if (res.ok) {
        setGDriveConnected(!!json.isConnected);
        setGDriveFileExists(!!json.fileExists);
        setGDriveWebViewLink(json.webViewLink || "");
      }
    } catch (e) {
      console.error("Error loading GDrive sync status:", e);
    } finally {
      setGDriveStatusLoading(false);
    }
  }, [selectedCourseId, selectedPeriod]);

  useEffect(() => {
    loadGDriveStatus();
    setGDriveSuccessInfo(null); // clear banner on course/period change
  }, [selectedCourseId, selectedPeriod, loadGDriveStatus, loading]);

  const handleGDriveSync = async () => {
    if (!selectedCourseId || !selectedPeriod) return;
    setGDriveSyncing(true);
    setGDriveSuccessInfo(null);
    try {
      const res = await fetch(`/api/docente/gdrive/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId, period: selectedPeriod })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Update Drive state directly from response
        if (json.fileId) {
          setGDriveFileExists(true);
          setGDriveWebViewLink(json.webViewLink || "");
        }
        setGDriveSuccessInfo({
          message: json.message,
          webViewLink: json.webViewLink || "",
          drivePath: json.drivePath || ""
        });
        fetchData();
      } else {
        alert(json.error || "Error al sincronizar con Google Drive");
      }
    } catch (e) {
      alert("Error de conexión al sincronizar");
    } finally {
      setGDriveSyncing(false);
    }
  };

  const handleGDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCourseId || !selectedPeriod) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setGDriveUploading(true);
    setGDriveSuccessInfo(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', selectedCourseId);
    formData.append('period', selectedPeriod);

    try {
      const res = await fetch('/api/docente/gdrive/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.fileId) {
          setGDriveFileExists(true);
          setGDriveWebViewLink(json.webViewLink || "");
        }
        setGDriveSuccessInfo({
          message: json.message,
          webViewLink: json.webViewLink || "",
          drivePath: json.drivePath || ""
        });
        loadGDriveStatus();
      } else {
        alert(json.error || 'Error al subir el archivo a Google Drive');
      }
    } catch (err) {
      alert('Error de conexión al subir el archivo');
    } finally {
      setGDriveUploading(false);
      e.target.value = '';
    }
  };


  // ── Derived ──
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const groups = selectedCourse?.groups ?? [];

  // Auto-select first group on course change
  useEffect(() => {
    // Only auto-select if selectedGroupId is empty OR not part of the new course
    const groupExists = groups.some(g => g.id === selectedGroupId);
    if (!groupExists && groups.length > 0) {
      setSelectedGroupId(groups[0]?.id ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, groups]);

  // Fetch when filters complete
  useEffect(() => {
    if (selectedCourseId && selectedPeriod && selectedGroupId) fetchData();
    else { setStudents([]); setTasks([]); setGradesGrid({}); setInitialGrid({}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedPeriod, selectedGroupId]);

  // ── URL Query Param watcher for calificarTaskId persistence across F5 ──
  const calificarTaskIdParam = searchParams.get("calificarTaskId");
  useEffect(() => {
    if (calificarTaskIdParam && (!gradingTask || gradingTask.id !== calificarTaskIdParam)) {
      openGradingModal({ id: calificarTaskIdParam, title: "Cargando actividad...", type: "TASK", submissions: [] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calificarTaskIdParam]);

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

      // Build grid from existing submissions and apply auto 1.0 for expired non-submitted tasks
      const grid: Record<string, Record<string, string>> = {};
      const now = new Date();
      for (const s of fStudents) {
        grid[s.id] = {};
        for (const t of fTasks) {
          const sub = t.submissions.find(x => x.studentId === s.id);
          const hasRealGrade = sub?.grade !== null && sub?.grade !== undefined;
          
          let defaultVal = "";
          if (!t.isExternal) {
            const { isClosed } = getTaskDeadlineStatus(t as any, sub as any);
            const isTimerExpired = sub?.startedAt && t.duration &&
              (new Date(sub.startedAt).getTime() + t.duration * 60 * 1000 + 30000 < now.getTime());

            if (t.type === "TASK") {
              const studentSubmitted = !!sub && ((sub as any).fileUrl || sub.status === "SUBMITTED" || sub.status === "GRADED");
              if (isClosed && !studentSubmitted) {
                defaultVal = "1.0";
              }
            } else if (t.type === "EXAM" || t.type === "FINAL") {
              if (isClosed || isTimerExpired) {
                defaultVal = "1.0";
              }
            }
          }

          if (hasRealGrade) {
            grid[s.id][t.id] = String(sub.grade);
          } else if (defaultVal) {
            grid[s.id][t.id] = defaultVal;
          } else {
            grid[s.id][t.id] = "";
          }
        }
      }
      setGradesGrid(grid);
      setInitialGrid(JSON.parse(JSON.stringify(grid)));

    } catch { /* silent */ }
    finally   { setLoading(false); }
  };

  // ── Category slices ──
  const byType = useCallback(
    (type: string) => {
      if (type === "EXAM") {
        return tasks.filter(t => t.type === "EXAM" || t.type === "TASK_SABER" || t.type === "SABER");
      }
      if (type === "TASK") {
        return tasks.filter(t => t.type === "TASK" || t.type === "TASK_HACER" || t.type === "HACER");
      }
      return tasks.filter(t => t.type === type);
    },
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
    setSelectedSaberSubtype("TASK_SABER");
    setNewTaskName("");
    setNewTaskDescription("");
    setNewTaskDueDate(getDefaultDueDate());
    setNewTaskIsExternal(type === "SER" ? true : false);
    setNewTaskDuration("");
    setNewTaskWeight("0");
    setNewTaskGroupIds(selectedGroupId ? [selectedGroupId] : []);
    setNewTaskStudentIds([]);
    setStudentSearch("");
    setNewTaskSelectedThemes([]);
    setNewTaskPublishAt("");
    setNewTaskAllowLateSubmission(false);
    setNewTaskLateSubmissionUntil("");
    setNewTaskExternalUrl("");
    setExistingAttachmentUrl(null);
    setNewTaskFile(null);
    setNewTaskResourceIds([]);
    setShowReusePicker(false);
    setSelectedReuseTaskId("");
    fetchReusableTasks(type);
    // Fetch resources, themes, and students for the selected course
    if (selectedCourseId) {
      setLoadingResources(true);
      fetch(`/api/docente/recursos?courseId=${selectedCourseId}`)
        .then(r => r.json())
        .then(d => { if (d.resources) setModalResources(d.resources); })
        .catch(() => {})
        .finally(() => setLoadingResources(false));
      fetch(`/api/docente/temas?courseId=${selectedCourseId}`)
        .then(r => r.json())
        .then(d => { if (d.themes) setPlanillasThemes(d.themes); })
        .catch(() => {});
      fetch("/api/docente/estudiantes")
        .then(r => r.json())
        .then(d => { if (d.students) setAllCourseStudents(d.students); })
        .catch(() => {});
    }
  };

  const buildFormData = () => {
    if (!addModal) return new FormData();
    const fd = new FormData();
    fd.append("title", newTaskName.trim());
    const effectiveType = addModal.type === "EXAM" ? selectedSaberSubtype : addModal.type;
    fd.append("type", effectiveType);
    fd.append("period", selectedPeriod);
    fd.append("description", newTaskDescription.trim());
    fd.append("dueDate", newTaskDueDate);
    fd.append("courseId", selectedCourseId);
    
    if (addModal.type === "SER") {
      fd.append("isExternal", "true");
    } else {
      fd.append("isExternal", String(newTaskIsExternal));
    }
    fd.append("theme", JSON.stringify(newTaskSelectedThemes));

    if (newTaskDuration) fd.append("duration", newTaskDuration);
    fd.append("weight", newTaskWeight);
    fd.append("groupIds", JSON.stringify(newTaskGroupIds));
    fd.append("studentIds", JSON.stringify(newTaskStudentIds));
    
    if (addModal.type !== "SER") {
      if (newTaskPublishAt) fd.append("publishAt", newTaskPublishAt);
      fd.append("allowLateSubmission", String(newTaskAllowLateSubmission));
      if (newTaskAllowLateSubmission && newTaskLateSubmissionUntil) {
        fd.append("lateSubmissionUntil", newTaskLateSubmissionUntil);
      } else {
        fd.append("lateSubmissionUntil", "");
      }
      if (newTaskExternalUrl.trim()) fd.append("externalUrl", newTaskExternalUrl.trim());
      if (newTaskFile) fd.append("file", newTaskFile);
      if (newTaskResourceIds.length > 0) fd.append("resourceIds", JSON.stringify(newTaskResourceIds));
    }

    return fd;
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim() || !addModal) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/docente/tareas", { method: "POST", body: buildFormData() });
      if (res.ok) { setAddModal(null); fetchData(); }
      else { const d = await res.json(); alert(d.error ?? (addModal.type === "EXAM" ? "Error al crear la actividad del Saber." : addModal.type === "TASK" ? "Error al crear la tarea." : "Error al crear la evaluación.")); }
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
      const taskType = t.type || "TASK";
      const catType = (taskType === "TASK_SABER" || taskType === "SABER" ? "EXAM" : taskType) as CatType;
      setAddModal({ type: catType });
      setSelectedSaberSubtype(taskType === "EXAM" ? "EXAM" : "TASK_SABER");
      setEditTaskId(task.id);
      setNewTaskName(t.title || "");
      setNewTaskDescription(t.description || "");
      setNewTaskDueDate(toLocal(t.dueDate));
      setNewTaskIsExternal(!!t.isExternal);
      setNewTaskDuration(t.duration ? String(t.duration) : "");
      setNewTaskWeight(t.weight != null ? String(t.weight) : "0");
      setNewTaskGroupIds((t.groups || []).map((g: any) => g.id));
      setNewTaskStudentIds((t.assignedStudents || []).map((s: any) => s.id));
      setStudentSearch("");
      setNewTaskSelectedThemes(
        t.themes && t.themes.length > 0
          ? t.themes.map((th: any) => th.title)
          : (t.theme ? [t.theme] : [])
      );
      setNewTaskPublishAt(toLocal(t.publishAt));
      setNewTaskAllowLateSubmission(!!t.allowLateSubmission);
      setNewTaskLateSubmissionUntil(toLocal(t.lateSubmissionUntil));
      setExistingAttachmentUrl(t.attachmentUrl || null);
      setNewTaskExternalUrl("");
      setNewTaskFile(null);
      setNewTaskResourceIds((t.resources || []).map((r: any) => r.id));
      // Fetch available resources and themes for course
      if (selectedCourseId) {
        setLoadingResources(true);
        fetch(`/api/docente/recursos?courseId=${selectedCourseId}`)
          .then(r => r.json())
          .then(d => { if (d.resources) setModalResources(d.resources); })
          .catch(() => {})
          .finally(() => setLoadingResources(false));
        fetch(`/api/docente/temas?courseId=${selectedCourseId}`)
          .then(r => r.json())
          .then(d => { if (d.themes) setPlanillasThemes(d.themes); })
          .catch(() => {});
        fetch("/api/docente/estudiantes")
          .then(r => r.json())
          .then(d => { if (d.students) setAllCourseStudents(d.students); })
          .catch(() => {});
      }
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
  const openGradingModal = async (task: { id: string; title?: string; type?: string; submissions?: any[] }, targetGroupId?: string) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("calificarTaskId", task.id);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }

    const gId = targetGroupId !== undefined ? targetGroupId : (selectedGroupId || "all");
    setGradingActiveGroupId(gId);
    setGradingTask(task as TaskItem);
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
        setSelectedStudentIds(data.students.map((s: any) => s.id));
        if (data.groups) {
          setGradingAvailableGroups(data.groups);
        }
        setGradingTask(prev => ({
          id: task.id,
          title: data.taskTitle || prev?.title || task.title || "Actividad",
          type: data.taskType || prev?.type || task.type || "TASK",
          dueDate: data.dueDate || (task as any).dueDate,
          allowLateSubmission: data.allowLateSubmission ?? (task as any).allowLateSubmission,
          lateSubmissionUntil: data.lateSubmissionUntil ?? (task as any).lateSubmissionUntil,
          isExternal: data.isExternal ?? (task as any).isExternal,
          duration: data.duration ?? (task as any).duration,
          submissions: prev?.submissions || []
        }));

        const taskInfo = {
          dueDate: data.dueDate || (task as any).dueDate,
          allowLateSubmission: data.allowLateSubmission ?? (task as any).allowLateSubmission,
          lateSubmissionUntil: data.lateSubmissionUntil ?? (task as any).lateSubmissionUntil,
          type: data.taskType || task.type || "TASK",
        };

        const inputs: Record<string, string> = {};
        const fInputs: Record<string, string> = {};
        data.students.forEach((s: any) => {
          const sub = s.submission;
          // A student is truly submitted only if they uploaded a file or their status is SUBMITTED.
          // "GRADED" alone (no fileUrl) means the docente assigned a grade without an actual delivery.
          const hasActualSubmission = !!sub && (sub.status === "SUBMITTED" || !!sub.fileUrl);
          const { isClosed } = getTaskDeadlineStatus(taskInfo, sub);
          const isOverdueWithoutSubmission = !(data.isExternal ?? (task as any).isExternal) && isClosed && !hasActualSubmission;

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

  // ── Duplication / Cloning Handlers ──
  const openDuplicateModal = (task: TaskItem) => {
    setDuplicateModalTask(task);
    setDuplicateTargetCourseId(selectedCourseId);
    setDuplicateTargetPeriod(selectedPeriod);
    setDuplicateTitle(task.title);
    setDuplicateDueDate(getDefaultDueDate());
    setDuplicateSuccess("");
    setDuplicateError("");
    const crs = courses.find(c => c.id === selectedCourseId);
    if (crs && crs.groups.length > 0) {
      setDuplicateTargetGroupIds(selectedGroupId ? [selectedGroupId] : [crs.groups[0].id]);
    } else {
      setDuplicateTargetGroupIds([]);
    }
  };

  const handleDuplicateTask = async () => {
    if (!duplicateModalTask || !duplicateTargetCourseId || duplicateTargetGroupIds.length === 0) {
      setDuplicateError("Selecciona la asignatura de destino y al menos un grupo.");
      return;
    }
    setDuplicating(true);
    setDuplicateError("");
    setDuplicateSuccess("");
    try {
      const res = await fetch(`/api/docente/tareas/${duplicateModalTask.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCourseId: duplicateTargetCourseId,
          targetGroupIds: duplicateTargetGroupIds,
          targetPeriod: duplicateTargetPeriod,
          title: duplicateTitle,
          dueDate: duplicateDueDate || undefined,
        })
      });
      const data = await res.json();
      if (res.ok && data.task) {
        setDuplicateSuccess("¡Actividad clonada con éxito con planilla de notas 100% limpia y nueva fecha!");
        setTimeout(() => {
          setDuplicateModalTask(null);
          setDuplicateSuccess("");
          fetchData();
        }, 1200);
      } else {
        setDuplicateError(data.error || "Error al duplicar la actividad");
      }
    } catch {
      setDuplicateError("Error de conexión al duplicar");
    } finally {
      setDuplicating(false);
    }
  };

  const fetchReusableTasks = async (type?: string) => {
    setLoadingReusableTasks(true);
    try {
      const qp = type ? `?type=${type}` : "";
      const res = await fetch(`/api/docente/tareas${qp}`);
      const data = await res.json();
      if (res.ok && data.tasks) {
        setReusableTasks(data.tasks);
      }
    } catch {
      console.error("Error loading reusable tasks");
    } finally {
      setLoadingReusableTasks(false);
    }
  };

  const handleCloneFromPicker = async () => {
    if (!selectedReuseTaskId || !selectedCourseId) {
      alert("Selecciona una actividad para clonar.");
      return;
    }
    const targetGroups = newTaskGroupIds.length > 0 ? newTaskGroupIds : (selectedGroupId ? [selectedGroupId] : []);
    if (targetGroups.length === 0) {
      alert("Selecciona al menos un grupo de destino.");
      return;
    }
    setAddingTask(true);
    try {
      const res = await fetch(`/api/docente/tareas/${selectedReuseTaskId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCourseId: selectedCourseId,
          targetGroupIds: targetGroups,
          targetPeriod: selectedPeriod,
          title: newTaskName.trim() || undefined,
          dueDate: newTaskDueDate || undefined,
        })
      });
      const data = await res.json();
      if (res.ok && data.task) {
        setAddModal(null);
        setShowReusePicker(false);
        setSelectedReuseTaskId("");
        fetchData();
      } else {
        alert(data.error || "Error al clonar la actividad.");
      }
    } catch {
      alert("Error de conexión al clonar.");
    } finally {
      setAddingTask(false);
    }
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
    fetchData();
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
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
      alert("Por favor ingresa una calificación válida entre 1.0 y 5.0");
      return;
    }
    const formatted = num.toFixed(1);
    const targetStudents = gradingStudents.filter(s => selectedStudentIds.includes(s.id));
    if (targetStudents.length === 0) {
      alert("Selecciona al menos un estudiante con el checkbox para aplicar la calificación.");
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
      if (task.type === "EXAM" || task.type === "FINAL") {
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
    const targetStudents = gradingStudents.filter(s => selectedStudentIds.includes(s.id));
    if (targetStudents.length === 0) {
      alert("Por favor selecciona al menos un estudiante con el checkbox para guardar su calificación.");
      return;
    }
    setSavingGrades(true);
    setGradingError("");
    setGradingSaved(false);
    try {
      const promises = targetStudents
        .filter(s => (gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "") || (feedbackInputs[s.id] !== undefined && feedbackInputs[s.id] !== ""))
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
      setGradingSaved(true);
      setTimeout(() => setGradingSaved(false), 3500);
      fetchData();
      alert("¡Calificaciones guardadas exitosamente!");
    } catch {
      setGradingError("Error al guardar calificaciones");
      alert("Error al guardar calificaciones.");
    } finally {
      setSavingGrades(false);
    }
  };

  const statusBadge = (sub: { status: string; grade?: number | null } | null) => {
    if (!sub) return <span className="text-xs text-muted italic">Sin entrega</span>;
    if (sub.status === "GRADED" || sub.grade != null) return <span className="badge badge-success flex items-center gap-1"><CheckCircle size={10} /> Calificada</span>;
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

  const buildExcelMappings = (excelHeaders: string[], studentColIdx: number): Record<string, number> => {
    const mappings: Record<string, number> = {};
    const usedColIndices = new Set<number>();
    if (studentColIdx !== -1) usedColIndices.add(studentColIdx);

    const getColCategory = (header: string): string | null => {
      const h = header.toLowerCase();
      if (h.includes("def") || h.includes("promedio") || h.includes("desempeño") || h.includes("total") || h.includes("nota final") || h.includes("planilla")) {
        return null;
      }
      if (h.includes("saber") || h.includes("exam") || h.includes("evaluaci") || h.includes("quiz") || h.includes("prueba")) return "EXAM";
      if (h.includes("hacer") || h.includes("taller") || h.includes("tarea") || h.includes("actividad") || h.includes("trabajo") || h.includes("proyecto") || h.includes("clase")) return "TASK";
      if (h.includes("ser") || h.includes("actit") || h.includes("auto") || h.includes("coev") || h.includes("portamiento") || h.includes("disciplina")) return "SER";
      if (h.includes("final") || h.includes("examen f")) return "FINAL";
      if (h.includes("asistencia") || h.includes("asist") || h.includes("falta")) return "ATTEND";
      return null;
    };

    const excelColsByCat: Record<string, number[]> = {
      EXAM: [],
      TASK: [],
      SER: [],
      FINAL: [],
      ATTEND: []
    };

    excelHeaders.forEach((h, idx) => {
      if (idx === studentColIdx) return;
      const cat = getColCategory(h);
      if (cat) excelColsByCat[cat].push(idx);
    });

    CATEGORIES.forEach(cat => {
      if (cat.type === "FINAL" && !showFinal) return;
      if (cat.type === "ATTEND" && !showAttend) return;

      const platformTasks = byType(cat.type);
      const excelCols = excelColsByCat[cat.type].sort((a, b) => a - b);

      // Positional category mapping:
      // Map the i-th task of the category in the platform strictly to the i-th column of the same category in Excel.
      platformTasks.forEach((task, index) => {
        if (index < excelCols.length) {
          const colIdx = excelCols[index];
          mappings[task.id] = colIdx;
          usedColIndices.add(colIdx);
        } else {
          mappings[task.id] = -1;
        }
      });
    });

    return mappings;
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
        
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length < 2) {
          alert("El archivo Excel no tiene suficientes filas.");
          return;
        }

        const row1 = rows[0];
        if (row1 && row1[0] === "STUDENT_ID" && row1[1] === "STUDENT_NAME") {
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

        let headerIndex = 0;
        let maxScore = -999;
        
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const r = rows[i];
          if (!r) continue;
          
          let score = 0;
          let hasStudentCol = false;
          let nonArr = r.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
          score += Math.min(10, nonArr.length);
          
          r.forEach(cell => {
            if (cell === undefined || cell === null) return;
            const val = String(cell).toLowerCase();
            
            if (val.includes("nombre") || val.includes("estudiante") || val.includes("alumno") || val.includes("completo") || val.includes("nombres") || val.includes("estudiantes")) {
              hasStudentCol = true;
            }
            
            if (val.includes("saber") || val.includes("hacer") || val.includes("ser") || val.includes("nota") || val.includes("calificacion") || val.includes("taller") || val.includes("tarea") || val.includes("examen") || val.includes("evaluacion") || val.includes("def") || val.includes("promedio") || val.includes("asistencia")) {
              score += 3;
            }
            
            if (val.includes("institucion") || val.includes("educativa") || val.includes("colegio") || val.includes("escuela") || val.includes("docente") || val.includes("profesor") || val.includes("asignatura") || val.includes("materia") || val.includes("periodo") || val.includes("curso") || val.includes("grado") || val.includes("planilla") || val.includes("consolidado")) {
              score -= 5;
            }
          });
          
          if (hasStudentCol) {
            score += 15;
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
        
        const studentColIdx = excelHeaders.findIndex(h => {
          if (!h) return false;
          const nh = h.toLowerCase();
          return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
        });


        // Use smart sequential-positional category mapping instead of complex text parsing
        const mappings = buildExcelMappings(excelHeaders, studentColIdx);

        // If student column was detected, skip the wizard and go straight to preview
        if (studentColIdx !== -1) {
          // Store state first, then trigger preview immediately
          setCustomExcelData({ rows, headers: excelHeaders, headerIndex, workbook: wb, fileName: file.name });
          setExcelStudentCol(studentColIdx);
          setExcelTaskMappings(mappings);
          // computeSyncPreview reads from state, so we compute inline here
          const activeMappings: Record<string, number> = {};
          Object.entries(mappings).forEach(([taskId, colIdx]) => {
            if (colIdx !== undefined && colIdx !== -1) activeMappings[taskId] = colIdx;
          });
          let toAdd = 0, toSkip = 0, unmatched = 0;
          for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const excelName = row[studentColIdx];
            if (!excelName || String(excelName).trim() === "") continue;
            const normExcel = _normalizeName(String(excelName));
            let studentMatch = students.find(s => _normalizeName(s.name) === normExcel) ?? null;
            if (!studentMatch) {
              const excelTokens = normExcel.split(" ").filter(t => t.length > 2);
              if (excelTokens.length > 0) {
                let bestStudent: typeof students[number] | null = null;
                let maxShared = 0;
                students.forEach(s => {
                  const st = _normalizeName(s.name).split(" ").filter(t => t.length > 2);
                  const shared = st.filter(t => excelTokens.includes(t)).length;
                  if (shared > maxShared) { maxShared = shared; bestStudent = s; }
                });
                if (maxShared >= 2 || (maxShared >= 1 && excelTokens.length === 1)) studentMatch = bestStudent;
              }
            }
            if (!studentMatch) { unmatched++; continue; }
            Object.entries(activeMappings).forEach(([taskId, excelColIdx]) => {
              if (excelColIdx >= excelHeaders.length) return;
              const gradeVal = row[excelColIdx];
              if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") return;
              const num = parseFloat(String(gradeVal).replace(",", ".").trim());
              if (isNaN(num) || num < 1.0 || num > 5.0) return;
              const existingGrade = gradesGrid[studentMatch!.id]?.[taskId];
              const alreadyHasGrade = existingGrade !== undefined && existingGrade !== null && String(existingGrade).trim() !== "";
              if (alreadyHasGrade) toSkip++; else toAdd++;
            });
          }
          setSyncPreview({ toAdd, toSkip, unmatched });
          setSyncConfirmOpen(true);
        } else {
          // Auto-detection failed: open minimal fallback wizard
          setCustomExcelData({ rows, headers: excelHeaders, headerIndex, workbook: wb, fileName: file.name });
          setExcelStudentCol(studentColIdx);
          setExcelTaskMappings(mappings);
        }

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

    // Use smart sequential-positional category mapping instead of complex text parsing
    const mappings = buildExcelMappings(excelHeaders, studentColIdx);

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

  // ── Shared helpers for Excel sync ──
  const _normalizeName = (name: string) =>
    name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
      .trim()
      .replace(/\s+/g, " ");

  const _findBestStudentMatch = (excelName: string) => {
    if (!excelName) return null;
    const normExcel = _normalizeName(excelName);
    let match = students.find(s => _normalizeName(s.name) === normExcel);
    if (match) return match;
    const excelTokens = normExcel.split(" ").filter(t => t.length > 2);
    if (excelTokens.length === 0) return null;
    let bestStudent: typeof students[number] | null = null;
    let maxSharedTokens = 0;
    students.forEach(student => {
      const normStudent = _normalizeName(student.name);
      const studentTokens = normStudent.split(" ").filter(t => t.length > 2);
      const shared = studentTokens.filter(t => excelTokens.includes(t)).length;
      if (shared > maxSharedTokens) { maxSharedTokens = shared; bestStudent = student; }
    });
    if (maxSharedTokens >= 2 || (maxSharedTokens >= 1 && excelTokens.length === 1)) return bestStudent;
    return null;
  };

  const _getActiveMappings = () => {
    const m: Record<string, number> = {};
    Object.entries(excelTaskMappings).forEach(([taskId, colIdx]) => {
      if (colIdx !== undefined && colIdx !== -1) m[taskId] = colIdx;
    });
    return m;
  };

  /** Calculates a preview of what would happen without touching any state */
  const computeSyncPreview = () => {
    if (!customExcelData || excelStudentCol === -1) return;
    const { rows, headers, headerIndex } = customExcelData;
    const studentColIdx = excelStudentCol;
    const activeMappings = _getActiveMappings();

    let toAdd = 0, toSkip = 0, unmatched = 0;

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const excelName = row[studentColIdx];
      if (!excelName || String(excelName).trim() === "") continue;
      const studentMatch = _findBestStudentMatch(String(excelName));
      if (!studentMatch) { unmatched++; continue; }

      Object.entries(activeMappings).forEach(([taskId, excelColIdx]) => {
        if (excelColIdx >= headers.length) return;
        const gradeVal = row[excelColIdx];
        if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") return;
        const cleanGrade = String(gradeVal).replace(",", ".").trim();
        const num = parseFloat(cleanGrade);
        if (isNaN(num) || num < 1.0 || num > 5.0) return;
        const existingGrade = gradesGrid[studentMatch.id]?.[taskId];
        const alreadyHasGrade = existingGrade !== undefined && existingGrade !== null && String(existingGrade).trim() !== "";
        if (alreadyHasGrade) toSkip++; else toAdd++;
      });
    }

    setSyncPreview({ toAdd, toSkip, unmatched });
    setSyncConfirmOpen(true);
  };

  const confirmCustomExcelSync = () => {
    if (!customExcelData || excelStudentCol === -1) return;

    const { rows, headers, headerIndex } = customExcelData;
    const studentColIdx = excelStudentCol;
    if (studentColIdx === -1 || studentColIdx >= headers.length) return;

    const activeMappings = _getActiveMappings();

    // ── Deep copy to avoid mutating original grid entries ──
    // A shallow copy ({ ...gradesGrid }) shares inner objects, so writing to
    // updatedGradesGrid[id][taskId] would also mutate gradesGrid[id][taskId],
    // breaking the "already has grade" check below.
    const updatedGradesGrid: Record<string, Record<string, string>> = {};
    for (const sid of Object.keys(gradesGrid)) {
      updatedGradesGrid[sid] = { ...gradesGrid[sid] };
    }

    let matchedCount = 0, addedCount = 0, skippedCount = 0;

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const excelName = row[studentColIdx];
      if (!excelName || String(excelName).trim() === "") continue;
      const studentMatch = _findBestStudentMatch(String(excelName));
      if (!studentMatch) continue;
      matchedCount++;
      if (!updatedGradesGrid[studentMatch.id]) updatedGradesGrid[studentMatch.id] = {};

      Object.entries(activeMappings).forEach(([taskId, excelColIdx]) => {
        if (excelColIdx >= headers.length) return;
        const gradeVal = row[excelColIdx];
        // Read existing grade from the ORIGINAL grid, not the mutating copy
        const existingGrade = gradesGrid[studentMatch.id]?.[taskId];
        const alreadyHasGrade = existingGrade !== undefined && existingGrade !== null && String(existingGrade).trim() !== "";
        if (alreadyHasGrade) {
          // There is already a grade on the platform — skip, never overwrite
          skippedCount++;
        } else if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
          const cleanGrade = String(gradeVal).replace(",", ".").trim();
          const num = parseFloat(cleanGrade);
          if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
            updatedGradesGrid[studentMatch.id][taskId] = num.toFixed(1);
            addedCount++;
          }
        }
      });
    }

    setGradesGrid(updatedGradesGrid);
    setCustomExcelData(null);
    setSyncConfirmOpen(false);
    setSyncPreview(null);
    setSyncResultMsg({ matched: matchedCount, total: students.length, added: addedCount, skipped: skippedCount });
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
      if (gradingStatusFilter === "SUBMITTED") return (s.submission?.status === "SUBMITTED" || s.submission?.fileUrl) && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PENDING") return !gradeInputs[s.id] || gradeInputs[s.id] === "";
      return true;
    });

    const catInfo = CATEGORIES.find(c => c.type === (gradingTask.type === "TASK_SABER" || gradingTask.type === "SABER" ? "EXAM" : gradingTask.type)) ?? CATEGORIES[1];
    const selectedGroupObj = groups.find(g => g.id === selectedGroupId);
    const activeGroupObj = gradingAvailableGroups.find(g => g.id === gradingActiveGroupId) || selectedGroupObj;
    const activeGradeName = (activeGroupObj as any)?.gradeName || (activeGroupObj as any)?.grade?.name || selectedGroupObj?.grade?.name || students[0]?.group?.grade?.name || "";
    const activeGroupName = activeGroupObj?.name || selectedGroupObj?.name || students[0]?.group?.name || "";
    const groupGradeBadge = activeGradeName && activeGroupName 
      ? `Grado ${activeGradeName} — Grupo ${activeGroupName}`
      : activeGroupName 
      ? `Grupo ${activeGroupName}`
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
              title="Volver a la planilla"
            >
              <ArrowLeft size={18} />
              <span>Volver a la Planilla</span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-xs uppercase tracking-wider ${catInfo.color.badge}`}>
                  {catInfo.label} {catInfo.sublabel ? `— ${catInfo.sublabel}` : ""}
                </span>
                {groupGradeBadge && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    🎓 {groupGradeBadge}
                  </span>
                )}
                <span className="text-xs text-muted font-semibold">
                  {selectedCourse?.name ? `${selectedCourse.name} • ` : ""}{selectedPeriod}
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
                <Pencil size={22} className="text-[#f98012]" />
                {gradingTask.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents || selectedStudentIds.length === 0}
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
                  Guardar Calificaciones ({selectedStudentIds.length})
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
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                <strong className="text-[#f98012]">{selectedStudentIds.length}</strong> de {gradingStudents.length} seleccionados
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={() => setSelectedStudentIds(gradingStudents.map(s => s.id))}
                className="text-xs font-bold text-[#f98012] hover:underline"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Ninguno
              </button>
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
                    <th className="py-3.5 px-4 w-12 text-center">No.</th>
                    <th className="py-3.5 px-4 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))}
                          onChange={() => toggleSelectAllFiltered(filteredStudents.map(s => s.id))}
                          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012]"
                          title="Seleccionar / Deseleccionar todos"
                        />
                        <span>Estudiante</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[180px]">Estado de Entrega</th>
                    <th className="py-3.5 px-4 w-32 text-center">Calificación (1–5)</th>
                    <th className="py-3.5 px-4 w-28 text-center">Desempeño</th>
                    <th className="py-3.5 px-4 min-w-[280px]">Retroalimentación / Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                  {filteredStudents.map((student, idx) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    const gradeVal = gradeInputs[student.id] ?? "";
                    const numGrade = parseFloat(gradeVal);
                    const hasValidGrade = !isNaN(numGrade) && numGrade >= 1.0 && numGrade <= 5.0;
                    const desemp = hasValidGrade ? getDesempeno(numGrade) : null;

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors ${
                          isSelected ? "bg-orange-50/20 dark:bg-orange-950/10" : "opacity-80"
                        } ${hasValidGrade ? "" : "bg-slate-50/30 dark:bg-slate-900/30"}`}
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
                              title="Seleccionar estudiante para calificar"
                            />
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
                            {student.submission?.fileUrl && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <a
                                  href={student.submission.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title="Ver archivo"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                  Ver Archivo
                                </a>
                                <a
                                  href={student.submission.fileUrl}
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
                            onChange={e => {
                              const val = e.target.value;
                              setGradeInputs(prev => ({ ...prev, [student.id]: val }));
                              setSelectedStudentIds(prev => prev.includes(student.id) ? prev : [...prev, student.id]);
                            }}
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
                            onChange={e => {
                              const val = e.target.value;
                              setFeedbackInputs(prev => ({ ...prev, [student.id]: val }));
                              setSelectedStudentIds(prev => prev.includes(student.id) ? prev : [...prev, student.id]);
                            }}
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
        </div>

        {/* Bottom Bar */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-5 py-3 rounded-2xl border shadow-lg flex items-center justify-between gap-4 mt-1" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 text-xs font-bold text-muted">
            <span>Calificados: <strong className="text-emerald-600 text-sm">{gradedCount}</strong>/{totalCount}</span>
            <span>•</span>
            <span>Pendientes: <strong className="text-amber-600 text-sm">{pendingCount}</strong></span>
            <span>•</span>
            <span>Seleccionados: <strong className="text-orange-600 text-sm">{selectedStudentIds.length}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={closeGrading}
              className="btn btn-secondary py-2 px-4 text-xs font-bold"
            >
              Volver a Planilla
            </button>
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents || selectedStudentIds.length === 0}
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
                  Guardar Calificaciones ({selectedStudentIds.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <button onClick={exportToPDF} className="btn btn-primary flex items-center gap-1.5 text-sm" style={{ background: "#f97316", borderColor: "#ea580c" }}>
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Google Drive success banner */}
      {gDriveSuccessInfo && (
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-xl px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 mt-0.5 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{gDriveSuccessInfo.message}</p>
            {gDriveSuccessInfo.drivePath && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {gDriveSuccessInfo.drivePath}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {gDriveSuccessInfo.webViewLink && (
              <a
                href={gDriveSuccessInfo.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:no-underline"
              >
                Abrir en Drive →
              </a>
            )}
            <button
              onClick={() => setGDriveSuccessInfo(null)}
              className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

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

        {/* Static Weights view */}
        <div className="border-b px-4 py-3 bg-white dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap items-center gap-4">

            {/* Icon + Title */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
              <span>Pesos de Evaluación</span>
            </div>

            {/* SABER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-700 dark:text-purple-400 text-xs">Saber:</span>
              <span className="font-bold text-purple-800 dark:text-purple-300 text-xs">{courseWeights?.saberPercent ?? 30}%</span>
            </div>

            {/* HACER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-700 dark:text-orange-400 text-xs">Hacer:</span>
              <span className="font-bold text-orange-800 dark:text-orange-300 text-xs">{courseWeights?.hacerPercent ?? 50}%</span>
            </div>

            {/* SER */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-700 dark:text-teal-500 text-xs">Ser:</span>
              <span className="font-bold text-teal-800 dark:text-teal-400 text-xs">{courseWeights?.serPercent ?? 20}%</span>
            </div>

            {/* EXAMEN FINAL */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-700 dark:text-sky-400 text-xs">Exam. Final:</span>
              <span className="font-bold text-sky-800 dark:text-sky-300 text-xs">{courseWeights?.finalPercent ?? 0}%</span>
            </div>

            {/* Actions aligned to the right or next in line */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 italic mr-2">Configurables en Gestión Asignaturas</span>
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


        {/* Visor de Planilla Excel */}
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
              const cat = CATEGORIES.find(c => c.type === (t.type === "TASK_SABER" || t.type === "SABER" ? "EXAM" : t.type)) ?? CATEGORIES[4];
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
                      <p className="text-gray-400 mt-0.5">
                        {t.type === "TASK_SABER" || t.type === "SABER" ? "SABER — Tarea" : t.type === "EXAM" ? "SABER — Examen" : `${cat.label}${cat.sublabel ? ` — ${cat.sublabel}` : ""}`}
                      </p>
                      {t.isExternal ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1 inline-block" style={{ background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}>📁 Entrega en clase</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1 inline-block" style={{ background: "#f0f9ff", color: "#0369a1", borderColor: "#b9e6fe" }}>💻 Entrega en plataforma</span>
                      )}
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
                        <button onClick={() => openDuplicateModal(t)} className="p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-purple-600 transition-colors" title="Clonar / Duplicar a otro curso o grupo (con notas limpias)">
                          <Copy size={13} />
                        </button>
                        <button onClick={() => openEditModal(t)} disabled={loadingEdit} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors" title={t.type === "EXAM" ? "Editar examen" : t.type === "TASK" ? "Editar tarea" : "Editar evaluación"}>
                          {loadingEdit ? <Loader2 size={13} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                        </button>
                        <button onClick={() => handleDeleteTask(t.id, t.title)} disabled={deletingId === t.id} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title={t.type === "EXAM" ? "Eliminar examen" : t.type === "TASK" ? "Eliminar tarea" : "Eliminar evaluación"}>
                          {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    {/* Gestionar tarea o examen directamente */}
                    {!t.isExternal && (
                      <button
                        onClick={() => openQuestionsModal(t)}
                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors w-full ${
                          (t.type === "EXAM" || t.type === "FINAL")
                            ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                            : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                        }`}
                        title={(t.type === "EXAM" || t.type === "FINAL") ? "Gestionar preguntas, entregas e intentos" : "Gestionar entregas y prórrogas"}
                      >
                        {(t.type === "EXAM" || t.type === "FINAL") ? "Gestionar Examen" : "Gestionar Entregas"}
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
                  ? (addModal.type === "EXAM" ? "Editar Examen" : addModal.type === "TASK" ? "Editar Tarea" : addModal.type === "SER" ? "Editar Evaluación Actitudinal" : "Editar Evaluación")
                  : (addModal.type === "EXAM" ? "Nuevo Examen" : addModal.type === "TASK" ? "Nueva Tarea" : addModal.type === "SER" ? "Nueva Evaluación Actitudinal" : "Nueva Evaluación")}
              </h3>
              <button onClick={() => { setAddModal(null); setEditTaskId(null); setShowReusePicker(false); }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>

            {!editTaskId && addModal.type !== "SER" && (
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-750">
                <button
                  type="button"
                  onClick={() => setShowReusePicker(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    !showReusePicker
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  ✨ Crear Desde Cero
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReusePicker(true);
                    fetchReusableTasks(addModal.type);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    showReusePicker
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <Copy size={13} />
                  📋 Clonar / Reutilizar Existente
                </button>
              </div>
            )}

            {showReusePicker && !editTaskId ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-xl text-xs text-orange-800 dark:text-orange-300">
                  💡 <strong>Clonación Limpia:</strong> Se copiarán todas las preguntas, opciones, adjuntos e instrucciones de la actividad seleccionada a esta asignatura (<strong>{selectedCourse?.name}</strong>), pero las calificaciones empezarán 100% limpias (0 entregas/notas). ¡Nunca se mezclarán con el otro grupo!
                </div>

                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Selecciona la actividad a clonar *
                  </label>
                  {loadingReusableTasks ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-muted">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                      Cargando actividades disponibles...
                    </div>
                  ) : reusableTasks.length === 0 ? (
                    <div className="p-4 border rounded-xl text-xs text-muted text-center">
                      No tienes otras actividades creadas de tipo {addModal.type} para clonar.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border rounded-xl divide-y divide-gray-100 dark:divide-gray-800 bg-slate-50 dark:bg-slate-800/30">
                      {reusableTasks.map((t: any) => {
                        const isSelected = selectedReuseTaskId === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedReuseTaskId(t.id);
                              if (!newTaskName) setNewTaskName(t.title);
                            }}
                            className={`p-3 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                              isSelected
                                ? "bg-orange-100/70 dark:bg-orange-950/40 border-l-4 border-orange-500"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-gray-900 dark:text-gray-100">{t.title}</p>
                              <p className="text-[11px] text-muted mt-0.5">
                                Asignatura origen: <strong>{t.course?.name || "Sin curso"}</strong> • {t.period || "Periodo 1"}
                                {t._count?.questions > 0 && ` • 📝 ${t._count.questions} preguntas`}
                              </p>
                            </div>
                            <input
                              type="radio"
                              name="reuseTask"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedReuseTaskId(t.id);
                                if (!newTaskName) setNewTaskName(t.title);
                              }}
                              className="mt-1 text-orange-500 focus:ring-orange-500 cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Título para la nueva copia (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Dejar igual o personalizar título..."
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border rounded-lg"
                  />
                </div>

                {/* Course Groups Assignment Checkboxes */}
                {groups.length > 0 && (
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Asignar a Grupos en este Curso *
                    </label>
                    <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/20 border rounded-lg">
                      {groups.map(g => {
                        const label = g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name;
                        const isChecked = newTaskGroupIds.includes(g.id);
                        return (
                          <label key={g.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
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

                <div className="input-group">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nueva Fecha y Hora de Vencimiento *
                  </label>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border rounded-lg"
                  />
                  <p className="text-[10px] text-muted mt-0.5">Por defecto se configura para mañana a las 23:59 para evitar que quede vencida.</p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800 mt-2">
                  <button
                    type="button"
                    onClick={() => { setAddModal(null); setShowReusePicker(false); }}
                    className="btn btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCloneFromPicker}
                    disabled={!selectedReuseTaskId || addingTask}
                    className="btn btn-primary text-xs font-bold flex items-center gap-2"
                  >
                    {addingTask ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                    Clonar Actividad (Limpia)
                  </button>
                </div>
              </div>
            ) : (
              <>
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

              {/* Subtipo de Dimensión Saber (Tarea vs Examen) */}
              {addModal.type === "EXAM" && (
                <div className="input-group">
                  <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1.5">
                    Modalidad en El Saber (Cognitivo) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSaberSubtype("TASK_SABER")}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        selectedSaberSubtype === "TASK_SABER"
                          ? "border-purple-500 bg-purple-50/90 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-400/50 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="font-extrabold text-xs flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                        📖 Tarea / Taller (Saber)
                      </span>
                      <span className="text-[11px] text-muted leading-tight">
                        Entrega de guías, talleres escritos, consultas o calificación manual.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSaberSubtype("EXAM")}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        selectedSaberSubtype === "EXAM"
                          ? "border-purple-500 bg-purple-50/90 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-400/50 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="font-extrabold text-xs flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                        📝 Examen en Línea (Saber)
                      </span>
                      <span className="text-[11px] text-muted leading-tight">
                        Cuestionario interactivo con preguntas y tiempo límite en plataforma.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2: Título */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {addModal.type === "SER"
                    ? "Nombre de la Evaluación Actitudinal *"
                    : addModal.type === "EXAM"
                    ? (selectedSaberSubtype === "EXAM" ? "Título del Examen (Saber) *" : "Título de la Tarea (Saber) *")
                    : addModal.type === "TASK"
                    ? "Título de la Tarea (Hacer) *"
                    : addModal.type === "FINAL"
                    ? "Título del Examen Final *"
                    : "Título de la Evaluación *"}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder={
                    addModal.type === "SER"
                      ? "Ej. Coevaluación, Autoevaluación"
                      : addModal.type === "EXAM"
                      ? (selectedSaberSubtype === "EXAM" ? "Ej. Examen de Cinética Química" : "Ej. Taller de Comprensión, Guía de Consulta...")
                      : addModal.type === "TASK"
                      ? "Ej. Taller Práctico, Maqueta, Ejercicios"
                      : addModal.type === "FINAL"
                      ? "Ej. Examen Final del Periodo"
                      : "Ej. Asistencia Semana 1"
                  }
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                  required
                />
              </div>

              {/* Row 3: Porcentaje & Fecha */}
              <div className={(addModal?.type === "FINAL" || (addModal?.type === "EXAM" && selectedSaberSubtype === "EXAM")) ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
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
                    {addModal.type === "SER" ? "Fecha Límite (Opcional)" : `Fecha Límite de Entrega ${newTaskIsExternal ? "(Opcional)" : "*"}`}
                  </label>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required={addModal.type === "SER" ? false : !newTaskIsExternal}
                  />
                </div>
                {(addModal?.type === "FINAL" || (addModal?.type === "EXAM" && selectedSaberSubtype === "EXAM")) && (
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

              {/* Row 4 & Checkboxes — hidden for SER */}
              {addModal.type !== "SER" && (
                <>
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
                    <div className="border border-gray-300 dark:border-gray-750 rounded-lg p-3 bg-white dark:bg-gray-900 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
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

                      {newTaskAllowLateSubmission && (
                        <div className="mt-2 pl-7 flex flex-col gap-1 animate-fade-in">
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            Fecha y hora límite de prórroga (Opcional):
                          </label>
                          <input
                            type="datetime-local"
                            value={newTaskLateSubmissionUntil}
                            onChange={e => setNewTaskLateSubmissionUntil(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                          />
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            * Si se deja vacío, la prórroga será sin fecha límite de expiración.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

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

              {/* Asignación a Estudiantes Específicos (Opcional) */}
              <div className="input-group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <span>Asignar a Estudiantes Específicos</span>
                    <span className="text-[10px] font-normal text-muted">(Opcional: asignación individual)</span>
                  </label>
                  {newTaskStudentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNewTaskStudentIds([])}
                      className="text-[11px] font-bold text-red-500 hover:underline"
                    >
                      Limpiar ({newTaskStudentIds.length} seleccionados)
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="input-field mb-2 text-xs py-1.5 px-3 border rounded-lg w-full"
                  placeholder="Buscar estudiante por nombre o grupo..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <div className="border rounded-lg p-2.5 max-h-[140px] overflow-y-auto flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900 border-gray-200 dark:border-gray-800">
                  {newTaskGroupIds.length === 0 ? (
                    <p className="text-[11px] text-muted text-center py-2">
                      Selecciona al menos un grupo arriba para ver y asignar estudiantes.
                    </p>
                  ) : (() => {
                    const filteredStudents = allCourseStudents.filter(s => {
                      const belongsToSelectedGroup = (s.groupId && newTaskGroupIds.includes(s.groupId)) || (s.group?.id && newTaskGroupIds.includes(s.group.id));
                      if (!belongsToSelectedGroup) return false;
                      if (!studentSearch) return true;
                      const q = studentSearch.toLowerCase().trim();
                      return s.name.toLowerCase().includes(q) || (s.groupName && s.groupName.toLowerCase().includes(q));
                    });

                    if (filteredStudents.length === 0) {
                      return (
                        <p className="text-[11px] text-muted text-center py-2">
                          No se encontraron estudiantes {studentSearch ? "con esa búsqueda" : "en los grupos seleccionados"}.
                        </p>
                      );
                    }

                    return filteredStudents.map(s => {
                      const isChecked = newTaskStudentIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:text-primary py-0.5 select-none">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setNewTaskStudentIds(prev =>
                                  isChecked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                );
                              }}
                              className="rounded text-[#f97316] focus:ring-[#f97316] w-3.5 h-3.5"
                            />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{s.name}</span>
                          </div>
                          {s.groupName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                              {s.groupName}
                            </span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {addModal.type === "SER" ? "Descripción (Opcional)" : (addModal.type === "EXAM" && selectedSaberSubtype === "EXAM") ? "Descripción del Examen" : "Descripción / Instrucciones de la Tarea"}
                </label>
                <textarea
                  placeholder={addModal.type === "SER" ? "Ej. Criterios de evaluación actitudinal..." : "Escribe las instrucciones aquí..."}
                  value={newTaskDescription}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                  rows={4}
                />
              </div>

              {/* Task Additions: Enlace Externo & Archivo Adjunto */}
              {(addModal.type === "TASK" || (addModal.type === "EXAM" && selectedSaberSubtype === "TASK_SABER")) && (
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
                      Archivo Adjunto / Guía de Apoyo (Opcional)
                    </label>
                    {existingAttachmentUrl && !newTaskFile && (
                      <div className="flex items-center justify-between p-2.5 mb-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 truncate">
                          📎 Guía adjunta actual
                        </span>
                        <a
                          href={existingAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#f97316] hover:underline font-bold"
                        >
                          Ver archivo
                        </a>
                      </div>
                    )}
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
                        {newTaskFile ? newTaskFile.name : (existingAttachmentUrl ? "Cambiar guía o archivo..." : "Selecciona una guía o archivo")}
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
                className="text-xs font-bold text-white bg-[#f97316] border border-[#ea580c] px-4 py-2 rounded-lg hover:bg-[#ea580c] transition-colors flex items-center justify-center gap-1.5 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingTask ? (
                  <>
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>{editTaskId ? "Guardar Cambios" : (addModal.type === "EXAM" ? (selectedSaberSubtype === "EXAM" ? "Crear Examen" : "Crear Tarea (Saber)") : addModal.type === "TASK" ? "Crear Tarea" : addModal.type === "SER" ? "Crear Evaluación Actitudinal" : "Crear Evaluación")}</span>
                  </>
                )}
              </button>
            </div>
            </>
            )}

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
                  {(questionsModalTask.type === "EXAM" || questionsModalTask.type === "FINAL") ? "Gestión de Examen" : "Gestión de Tarea"}: {questionsModalTask.title}
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
            {(questionsModalTask.type === "EXAM" || questionsModalTask.type === "FINAL") && (
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
              ) : manageTab === "questions" && (questionsModalTask.type === "EXAM" || questionsModalTask.type === "FINAL") ? (
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
                    {(questionsModalTask.type === "EXAM" || questionsModalTask.type === "FINAL") && (
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
                                  {questionsModalTask.type !== "EXAM" && questionsModalTask.type !== "FINAL" && sub?.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="btn btn-secondary text-[11px] px-2 py-1 flex items-center gap-1"
                                      title="Descargar archivo de entrega"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </a>
                                  )}
                                  {(questionsModalTask.type === "EXAM" || questionsModalTask.type === "FINAL") && (
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
      {/* ── Fallback wizard: only shown when auto-detection couldn't find student column ── */}
      {customExcelData && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 animate-fade-in px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in" style={{ color: "var(--text-primary)" }}>

            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h3 className="font-extrabold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileSpreadsheet className="text-orange-500" size={22} /> Necesito un poco de ayuda
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  No pude detectar automáticamente la columna de nombres en <strong>{customExcelData.fileName}</strong>.
                </p>
              </div>
              <button
                onClick={() => setCustomExcelData(null)}
                className="text-gray-400 hover:text-red-500 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">

              {/* Header Row Selector */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/30 flex flex-col gap-2" style={{ borderColor: "var(--border-color)" }}>
                <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="text-base">📋</span> ¿En qué fila están los títulos de las columnas?
                </label>
                <select
                  value={customExcelData.headerIndex}
                  onChange={(e) => handleHeaderRowChange(parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 mt-1"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  {customExcelData.rows.slice(0, 15).map((row, idx) => {
                    const rowPreview = row
                      .filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "")
                      .slice(0, 5)
                      .join(" | ");
                    return (
                      <option key={idx} value={idx}>
                        Fila {idx + 1}: {rowPreview ? (rowPreview.length > 70 ? rowPreview.substring(0, 70) + "..." : rowPreview) : "(Vacía)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Student Column Selector */}
              <div className="p-4 rounded-xl border bg-orange-50 dark:bg-orange-900/20 flex flex-col gap-2" style={{ borderColor: "rgba(251,146,60,0.4)" }}>
                <label className="font-bold text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <span className="text-base">👤</span> ¿Cuál columna tiene los nombres de los estudiantes?
                </label>
                <select
                  value={excelStudentCol}
                  onChange={(e) => setExcelStudentCol(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 mt-1"
                  style={{ borderColor: "rgba(251,146,60,0.5)", color: "var(--text-primary)" }}
                >
                  <option value={-1}>-- Selecciona la columna de nombres --</option>
                  {customExcelData.headers.map((h, idx) => (
                    <option key={idx} value={idx}>{colLetter(idx)}{customExcelData.headerIndex + 1}: {h}</option>
                  ))}
                </select>
                <p className="text-[11px] text-orange-600 dark:text-orange-400">
                  Las evaluaciones se detectan automáticamente por el nombre de las columnas.
                </p>
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
                onClick={computeSyncPreview}
                disabled={excelStudentCol === -1}
                className="btn btn-primary text-xs py-2 px-6 font-bold flex items-center gap-2 transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", borderColor: "#ea580c", opacity: excelStudentCol === -1 ? 0.5 : 1 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Ver preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Sync Confirm Modal (portal → escapes overflow:hidden) ── */}
      {isMounted && syncConfirmOpen && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 to-amber-500" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-950/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-100">¿Confirmar sincronización?</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    Revisa el resumen antes de confirmar:
                  </p>
                </div>
              </div>

              {/* Preview stats */}
              {syncPreview && (
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span>✅</span> Notas nuevas a agregar
                    </span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{syncPreview.toAdd}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>🔒</span> Notas ya existentes (no se tocan)
                    </span>
                    <span className="text-sm font-extrabold text-slate-500">{syncPreview.toSkip}</span>
                  </div>
                  {syncPreview.unmatched > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <span>⚠️</span> Estudiantes sin coincidencia
                      </span>
                      <span className="text-sm font-extrabold text-amber-600">{syncPreview.unmatched}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                <span>💾</span> Recuerda hacer clic en &quot;Guardar&quot; al finalizar.
              </p>

              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => { setSyncConfirmOpen(false); setSyncPreview(null); }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCustomExcelSync}
                  disabled={syncPreview?.toAdd === 0}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-all hover:brightness-110 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {syncPreview?.toAdd === 0 ? "Sin notas nuevas" : `Agregar ${syncPreview?.toAdd} nota${(syncPreview?.toAdd ?? 0) !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Sync Result Modal (portal → escapes overflow:hidden) ── */}
      {isMounted && syncResultMsg && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-green-600" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-100">¡Sincronización completada!</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Resumen de lo que se hizo:</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/20" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">👥 Estudiantes encontrados</span>
                  <span className="text-sm font-extrabold text-gray-700 dark:text-gray-200">{syncResultMsg.matched} / {syncResultMsg.total}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">✅ Notas nuevas agregadas</span>
                  <span className="text-sm font-extrabold text-emerald-600">{syncResultMsg.added}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">🔒 Notas existentes protegidas</span>
                  <span className="text-sm font-extrabold text-slate-500">{syncResultMsg.skipped}</span>
                </div>
                <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 text-xs" style={{ borderColor: "rgba(245,158,11,0.2)", color: "#78350f" }}>
                  💾 Haz clic en <strong>&quot;Guardar&quot;</strong> para confirmar los cambios.
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setSyncResultMsg(null)}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110 shadow-md"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
                >
                  Entendido ✓
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Duplicate / Clone Task Modal ── */}
      {isMounted && duplicateModalTask && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in flex flex-col gap-4 border" style={{ borderColor: "var(--border-color)" }}>
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Copy size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                    Clonar / Duplicar Actividad
                  </h3>
                  <p className="text-xs text-muted">Copia limpia sin arrastrar calificaciones</p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateModalTask(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {duplicateSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                {duplicateSuccess}
              </div>
            )}
            {duplicateError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-xs font-bold animate-fade-in">
                {duplicateError}
              </div>
            )}

            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl text-xs text-purple-900 dark:text-purple-300">
              💡 <strong>Actividad Original:</strong> &quot;{duplicateModalTask.title}&quot; ({duplicateModalTask.type === "EXAM" ? "Examen" : "Tarea"}).
              <br />
              Se copiarán todas sus preguntas, opciones y archivos, pero la planilla de notas empezará <strong>100% limpia (en blanco)</strong>.
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {/* Asignatura Destino */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Asignatura de Destino *
                </label>
                <select
                  value={duplicateTargetCourseId}
                  onChange={e => {
                    const newCId = e.target.value;
                    setDuplicateTargetCourseId(newCId);
                    const targetC = courses.find(c => c.id === newCId);
                    if (targetC && targetC.groups.length > 0) {
                      setDuplicateTargetGroupIds([targetC.groups[0].id]);
                    } else {
                      setDuplicateTargetGroupIds([]);
                    }
                  }}
                  className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Periodo Destino */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Periodo *
                </label>
                <select
                  value={duplicateTargetPeriod}
                  onChange={e => setDuplicateTargetPeriod(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {periods.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Grupos en Asignatura Destino */}
              {(() => {
                const targetCourseObj = courses.find(c => c.id === duplicateTargetCourseId);
                const targetGroups = targetCourseObj?.groups || [];
                return (
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Asignar a Grupos en Destino (Múltiple) *
                    </label>
                    {targetGroups.length === 0 ? (
                      <p className="text-xs text-muted italic">Esta asignatura no tiene grupos asociados.</p>
                    ) : (
                      <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/30 border rounded-lg max-h-36 overflow-y-auto" style={{ borderColor: "var(--border-color)" }}>
                        {targetGroups.map(g => {
                          const label = g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name;
                          const isChecked = duplicateTargetGroupIds.includes(g.id);
                          return (
                            <label key={g.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setDuplicateTargetGroupIds(prev => prev.filter(id => id !== g.id));
                                  } else {
                                    setDuplicateTargetGroupIds(prev => [...prev, g.id]);
                                  }
                                }}
                                className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Título de la copia */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Título para la nueva copia (Opcional)
                </label>
                <input
                  type="text"
                  value={duplicateTitle}
                  onChange={e => setDuplicateTitle(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2 px-3 border rounded-lg"
                  placeholder={duplicateModalTask.title}
                />
              </div>

              {/* Fecha y Hora de Vencimiento */}
              <div className="input-group">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nueva Fecha y Hora de Vencimiento *
                </label>
                <input
                  type="datetime-local"
                  value={duplicateDueDate}
                  onChange={e => setDuplicateDueDate(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2 px-3 border rounded-lg"
                />
                <p className="text-[10px] text-muted mt-0.5">Por defecto configurado para mañana a las 23:59.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t mt-2" style={{ borderColor: "var(--border-color)" }}>
              <button
                onClick={() => setDuplicateModalTask(null)}
                className="btn btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleDuplicateTask}
                disabled={duplicating || !duplicateTargetCourseId || duplicateTargetGroupIds.length === 0}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {duplicating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Clonando...</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Clonar Actividad Limpia</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
