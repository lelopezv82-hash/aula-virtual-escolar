"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, FileSpreadsheet, FileText, Loader2,
  Save, Undo2, AlertTriangle, Check, Info,
  Plus, Trash2, X, Pencil, CheckCircle, AlertCircle, Clock
} from "lucide-react";
import Link from "next/link";
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
  { type: "EXAM",   label: "SABER",       sublabel: "Exámenes",    pctKey: "saberPercent",  color: { header: "bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300", cell: "bg-purple-50/20 dark:bg-purple-900/5", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", dot: "#a855f7", btn: "hover:bg-purple-200 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" } },
  { type: "TASK",   label: "HACER",       sublabel: "Tareas",      pctKey: "hacerPercent",  color: { header: "bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300", cell: "bg-orange-50/20 dark:bg-orange-900/5", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300", dot: "#d97706", btn: "hover:bg-orange-200 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" } },
  { type: "SER",    label: "SER",         sublabel: "Actitudinal", pctKey: "serPercent",    color: { header: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300", cell: "bg-yellow-50/20 dark:bg-yellow-900/5", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300", dot: "#b45309", btn: "hover:bg-yellow-200 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" } },
  { type: "FINAL",  label: "EXAMEN FINAL", sublabel: "",           pctKey: "finalPercent",  color: { header: "bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300", cell: "bg-sky-50/20 dark:bg-sky-900/5", badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300", dot: "#0ea5e9", btn: "hover:bg-sky-200 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" } },
  { type: "ATTEND", label: "ASISTENCIA",  sublabel: "",            pctKey: "",              color: { header: "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300", cell: "bg-green-50/20 dark:bg-green-900/5", badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", dot: "#10b981", btn: "hover:bg-green-200 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" } },
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

  const handleAddTask = async () => {
    if (!newTaskName.trim() || !addModal) return;
    setAddingTask(true);
    try {
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

      const res = await fetch("/api/docente/tareas", {
        method: "POST",
        body: fd
      });
      if (res.ok) {
        setAddModal(null);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error ?? "Error al crear la evaluación.");
      }
    } catch {
      alert("Error de conexión.");
    }
    setAddingTask(false);
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

  // ── Export ──
  const exportToExcel = () => {
    const t = document.getElementById("planillas-table");
    if (!t) return;
    const wb = XLSX.utils.table_to_book(t, { sheet: "Planilla" });
    XLSX.writeFile(wb, `Planilla_${selectedCourse?.name}_${selectedPeriod}.xlsx`);
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
    const pct = cat.type === "EXAM" ? pctForm.saber
      : cat.type === "TASK"  ? pctForm.hacer
      : cat.type === "SER"   ? pctForm.ser
      : cat.type === "FINAL" ? pctForm.final
      : null;
    return (
      <th
        key={cat.type}
        colSpan={Math.max(1, catTasks.length) + 1 /* +1 for add-button slot */}
        className={`border border-gray-200 dark:border-gray-700 p-2 uppercase tracking-wide font-bold text-xs ${cat.color.header}`}
      >
        <div className="flex items-center justify-center gap-2">
          <span>{cat.label}{pct != null ? ` (${pct}%)` : ""}</span>
          <button
            onClick={() => openAddModal(cat.type as CatType)}
            className={`p-1 rounded transition-colors ${cat.color.btn}`}
            title={`Agregar columna de ${cat.label}`}
          >
            <Plus size={13} />
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
          ? <th key={`${cat.type}-empty`} className="border border-gray-200 dark:border-gray-700 p-1 font-normal italic text-gray-400 w-12">—</th>
          : catTasks.map(t => (
              <th key={t.id} title={t.title} className="border border-gray-200 dark:border-gray-700 p-1 w-12 cursor-help text-center group relative">
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
        {/* Empty "add" slot for visual alignment */}
        <th className="border border-gray-200 dark:border-gray-700 w-4 p-0" />
      </>
    );
  };

  const renderStudentCatCells = (studentId: string, cat: typeof CATEGORIES[number]) => {
    const catTasks = byType(cat.type);
    const g        = gradesGrid[studentId] ?? {};
    return (
      <>
        {catTasks.length === 0
          ? <td key={`${cat.type}-empty`} className={`p-1 border border-gray-100 dark:border-gray-700 ${cat.color.cell}`}></td>
          : catTasks.map(t => {
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
                  }`}
                >
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={val}
                    placeholder="—"
                    onChange={e => handleCell(studentId, t.id, e.target.value)}
                    className={`w-12 text-center font-bold rounded border px-1 py-0.5 bg-white dark:bg-gray-800 text-xs outline-none focus:ring-1 focus:ring-orange-400 transition-colors ${
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
        {/* Empty slot aligned with add-btn header */}
        <td className="border border-gray-100 dark:border-gray-700 w-4 p-0" />
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted">
            {students.length} estudiantes
          </span>
          <button onClick={exportToExcel} className="btn btn-secondary flex items-center gap-1.5 text-sm">
            <FileSpreadsheet size={15} /> Excel
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
      <div className="card rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>

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
          <div className="overflow-x-auto">
            <table id="planillas-table" className="w-full border-collapse text-xs text-center">
              <thead>
                {/* Row 1: Category headers */}
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2 w-8">No.</th>
                  <th rowSpan={2} className="border border-gray-200 dark:border-gray-700 p-2 text-left min-w-[200px]">Nombre Completo</th>
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
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10 w-16">Saber×{sp}%</th>
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10 w-16">Hacer×{hp}%</th>
                  <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10 w-16">Ser×{ep}%</th>
                  {showFinal && <th className="border border-gray-200 dark:border-gray-700 p-1 bg-blue-50/50 dark:bg-blue-900/10 w-16">Final×{fp}%</th>}
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

                        {/* Final */}
                        <td className="p-2 border border-gray-200 dark:border-gray-700 font-extrabold text-sm text-center" style={{ color: gradeColor(stats.total) }}>
                          {stats.total !== null ? stats.total.toFixed(2) : "—"}
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
              return (
                <div key={t.id} className="flex gap-2 items-start justify-between p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm group">
                  <div className="flex gap-2 items-start flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded font-black flex-shrink-0 ${cat.color.badge}`}>
                      {taskNumbers[t.id]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 dark:text-gray-200 leading-tight max-w-[160px] truncate" title={t.title}>{t.title}</p>
                      <p className="text-gray-400 mt-0.5">{cat.label}{cat.sublabel ? ` — ${cat.sublabel}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Grade button — always visible for all tasks */}
                    <button
                      onClick={() => openGradingModal(t)}
                      className="text-gray-400 hover:text-[#f98012] transition-colors p-1"
                      title="Calificar estudiantes"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(t.id, t.title)}
                      disabled={deletingId === t.id}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                      title="Eliminar esta evaluación"
                    >
                      {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
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
              <h3 className="font-bold text-xl text-gray-900 dark:text-gray-155">
                {addModal.type === "EXAM" ? "Nuevo Examen" : "Nueva Evaluación"}
              </h3>
              <button onClick={() => setAddModal(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
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
              <div className="grid grid-cols-3 gap-4">
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
                    Fecha Límite de Entrega *
                  </label>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="input-field w-full text-xs font-semibold py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f97316]"
                    required
                  />
                </div>
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

              {/* Tip Banner (Only visible for platform exams) */}
              {addModal.type === "EXAM" && !newTaskIsExternal && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 text-[#c2410c] dark:text-orange-400 rounded-lg p-3 text-xs leading-normal flex items-start gap-2">
                  <span className="text-sm">💡</span>
                  <p>
                    <strong>Examen en la Plataforma:</strong> Este examen se creará directamente aquí. Una vez creado, haz clic en <span className="font-bold">Ver/Calificar</span> en la lista de exámenes para ingresar las preguntas y opciones de respuesta.
                  </p>
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setAddModal(null)} className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleAddTask}
                disabled={addingTask || !newTaskName.trim() || newTaskGroupIds.length === 0}
                className="text-xs font-bold text-white bg-[#f97316] border border-[#ea580c] px-4 py-2 rounded-lg hover:bg-[#ea580c] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingTask ? <Loader2 size={16} className="animate-spin mx-auto" /> : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>{addModal.type === "EXAM" ? "Crear Examen" : "Crear Tarea"}</span>
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
    </div>
  );
}
