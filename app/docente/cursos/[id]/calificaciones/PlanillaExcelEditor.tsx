"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Save, Undo2, Info, AlertTriangle, Check, Plus, Trash2, X, Percent } from "lucide-react";

interface Student {
  id: string;
  name: string;
  groupName: string;
}

interface Task {
  id: string;
  title: string;
  type: string; // EXAM | TASK | SER
  submissions: Array<{
    studentId: string;
    status: string;
    grade: number | null;
  }>;
}

interface PlanillaExcelEditorProps {
  courseId: string;
  activePeriod: string;
}

export default function PlanillaExcelEditor({ courseId, activePeriod }: PlanillaExcelEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saberPct, setSaberPct] = useState(30);
  const [hacerPct, setHacerPct] = useState(50);
  const [serPct, setSerPct] = useState(20);
  const [finalPct, setFinalPct] = useState(0);
  const [teacherName, setTeacherName] = useState("");
  const [courseName, setCourseName] = useState("");

  // Inline percentage editor state
  const [pctForm, setPctForm] = useState({ saber: 30, hacer: 50, ser: 20, final: 0 });
  const [savingPct, setSavingPct] = useState(false);
  const [pctSuccess, setPctSuccess] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingType, setAddingType] = useState<"EXAM" | "TASK" | "SER" | "FINAL" | "ATTEND">("EXAM");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Local state for all editable grades
  // Format: { [studentId]: { [taskId]: string (input value) } }
  const [gradesGrid, setGradesGrid] = useState<Record<string, Record<string, string>>>({});
  const [initialGradesGrid, setInitialGradesGrid] = useState<Record<string, Record<string, string>>>({});

  // Fetch spreadsheet data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      setSuccess(false);
      try {
        const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet?period=${encodeURIComponent(activePeriod)}`);
        const json = await res.json();
        if (res.ok) {
          setStudents(json.students || []);
          setTasks(json.tasks || []);
          setSaberPct(json.saberPercent ?? 30);
          setHacerPct(json.hacerPercent ?? 50);
          setSerPct(json.serPercent ?? 20);
          setFinalPct(json.finalPercent ?? 0);
          setPctForm({
            saber: json.saberPercent ?? 30,
            hacer: json.hacerPercent ?? 50,
            ser: json.serPercent ?? 20,
            final: json.finalPercent ?? 0,
          });
          setTeacherName(json.teacherName || "Docente");
          setCourseName(json.course?.name || "Asignatura");

          // Build grid data
          const grid: Record<string, Record<string, string>> = {};
          const rawTasks = json.tasks || [];

          for (const student of json.students || []) {
            grid[student.id] = {};
            // Set task grades
            for (const t of rawTasks) {
              const sub = t.submissions?.find((s: any) => s.studentId === student.id);
              grid[student.id][t.id] = sub && sub.grade !== null ? sub.grade.toFixed(1) : "";
            }
          }

          setGradesGrid(grid);
          setInitialGradesGrid(JSON.parse(JSON.stringify(grid))); // Deep clone
        } else {
          setError(json.error || "Error al cargar la planilla");
        }
      } catch (e) {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [courseId, activePeriod, reloadTrigger]);

  // Separate tasks by type
  const saberTasks = useMemo(() => tasks.filter(t => t.type === "EXAM"), [tasks]);
  const hacerTasks = useMemo(() => tasks.filter(t => t.type === "TASK"), [tasks]);
  const serTasks = useMemo(() => tasks.filter(t => t.type === "SER"), [tasks]);
  const finalTasks = useMemo(() => tasks.filter(t => t.type === "FINAL"), [tasks]);
  const attendTasks = useMemo(() => tasks.filter(t => t.type === "ATTEND"), [tasks]);

  // Map tasks to sequential numbers for the Excel headers
  const taskNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let counter = 1;
    saberTasks.forEach(t => map[t.id] = counter++);
    hacerTasks.forEach(t => map[t.id] = counter++);
    serTasks.forEach(t => map[t.id] = counter++);
    finalTasks.forEach(t => map[t.id] = counter++);
    attendTasks.forEach(t => map[t.id] = counter++);
    return map;
  }, [saberTasks, hacerTasks, serTasks, finalTasks, attendTasks]);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(gradesGrid) !== JSON.stringify(initialGradesGrid);
  }, [gradesGrid, initialGradesGrid]);

  // Handle cell input change
  const handleCellChange = (studentId: string, key: string, value: string) => {
    if (value !== "") {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || parsed < 0 || parsed > 9.9) return; 
    }

    setGradesGrid(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [key]: value
      }
    }));
  };

  // Re-calculate statistics for a student in real-time
  const calculateStudentRow = useCallback((studentId: string) => {
    const studentGrades = gradesGrid[studentId] || {};

    // 1. Saber Average
    const saberValues = saberTasks
      .map(t => parseFloat(studentGrades[t.id]))
      .filter(v => !isNaN(v) && v >= 1.0 && v <= 5.0);
    const saberAvg = saberValues.length > 0 ? saberValues.reduce((a, b) => a + b, 0) / saberValues.length : null;

    // 2. Hacer Average
    const hacerValues = hacerTasks
      .map(t => parseFloat(studentGrades[t.id]))
      .filter(v => !isNaN(v) && v >= 1.0 && v <= 5.0);
    const hacerAvg = hacerValues.length > 0 ? hacerValues.reduce((a, b) => a + b, 0) / hacerValues.length : null;

    // 3. Ser Average
    const serValues = serTasks
      .map(t => parseFloat(studentGrades[t.id]))
      .filter(v => !isNaN(v) && v >= 1.0 && v <= 5.0);
    const ser = serValues.length > 0 ? serValues.reduce((a, b) => a + b, 0) / serValues.length : null;

    // 4. Final exam average
    const finalValues = finalTasks
      .map(t => parseFloat(studentGrades[t.id]))
      .filter(v => !isNaN(v) && v >= 1.0 && v <= 5.0);
    const finalExam = finalValues.length > 0 ? finalValues.reduce((a, b) => a + b, 0) / finalValues.length : null;

    // 5. Weighted final grade
    const finalGrade =
      (saberAvg !== null ? saberAvg * (saberPct / 100) : 0) +
      (hacerAvg !== null ? hacerAvg * (hacerPct / 100) : 0) +
      (ser !== null ? ser * (serPct / 100) : 0) +
      (finalExam !== null ? finalExam * (finalPct / 100) : 0);

    const hasAny = saberAvg !== null || hacerAvg !== null || ser !== null || finalExam !== null;

    // 6. Desempeño
    let desempeno = "";
    let desempenoClass = "";
    const displayGrade = hasAny ? finalGrade : null;
    if (displayGrade !== null) {
      const fg = parseFloat(displayGrade.toFixed(2));
      if (fg < 3.0) {
        desempeno = "BAJO";
        desempenoClass = "text-red-600 bg-red-50 dark:bg-red-950/20";
      } else if (fg <= 3.9) {
        desempeno = "BASICO";
        desempenoClass = "text-green-600 bg-green-50 dark:bg-green-950/20";
      } else if (fg <= 4.5) {
        desempeno = "ALTO";
        desempenoClass = "text-blue-600 bg-blue-50 dark:bg-blue-950/20";
      } else {
        desempeno = "SUPERIOR";
        desempenoClass = "text-purple-600 bg-purple-50 dark:bg-purple-950/20";
      }
    }

    return {
      saberAvg,
      hacerAvg,
      ser,
      finalExam,
      finalGrade: displayGrade,
      desempeno,
      desempenoClass
    };
  }, [gradesGrid, saberTasks, hacerTasks, serTasks, saberPct, hacerPct, serPct]);

  // Discard changes
  const handleDiscard = () => {
    setGradesGrid(JSON.parse(JSON.stringify(initialGradesGrid)));
    setSuccess(false);
  };

  // Save changes to server
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    const submissions: Array<{ studentId: string; taskId: string; grade: number | null }> = [];

    // Compare with initial grid to collect changes
    for (const studentId of Object.keys(gradesGrid)) {
      const current = gradesGrid[studentId];
      const initial = initialGradesGrid[studentId] || {};

      // Tasks
      for (const t of tasks) {
        if (current[t.id] !== initial[t.id]) {
          const val = current[t.id];
          submissions.push({
            studentId,
            taskId: t.id,
            grade: val === "" ? null : parseFloat(val)
          });
        }
      }
    }

    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: activePeriod,
          submissions
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccess(true);
        setInitialGradesGrid(JSON.parse(JSON.stringify(gradesGrid)));
      } else {
        setError(json.error || "Error al guardar calificaciones");
      }
    } catch (e) {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = (type: "EXAM" | "TASK" | "SER" | "FINAL" | "ATTEND") => {
    setAddingType(type);
    setNewTaskTitle("");
    setShowAddModal(true);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle, type: addingType, period: activePeriod })
      });
      if (res.ok) {
        setShowAddModal(false);
        setReloadTrigger(prev => prev + 1); // reload data
      } else {
        alert("Error al crear columna.");
      }
    } catch (e) {
      alert("Error de conexión.");
    }
    setAddingTask(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("⚠️ ¿Estás seguro? Se borrarán TODAS las calificaciones asociadas a esta columna para todos los estudiantes. Esta acción NO se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet/columns?taskId=${taskId}`, { method: "DELETE" });
      if (res.ok) {
        setReloadTrigger(prev => prev + 1); // reload data
      } else {
        alert("Error eliminando columna.");
      }
    } catch (e) {
      alert("Error de conexión.");
    }
  };

  // Save percentage weights
  const pctTotal = pctForm.saber + pctForm.hacer + pctForm.ser + pctForm.final;
  const pctChanged = pctForm.saber !== saberPct || pctForm.hacer !== hacerPct || pctForm.ser !== serPct || pctForm.final !== finalPct;

  const handleSavePct = async () => {
    if (pctTotal !== 100) return;
    setSavingPct(true);
    setPctSuccess(false);
    try {
      const res = await fetch("/api/docente/cursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: courseId,
          saberPercent: pctForm.saber,
          hacerPercent: pctForm.hacer,
          serPercent: pctForm.ser,
          finalPercent: pctForm.final,
        })
      });
      if (res.ok) {
        setSaberPct(pctForm.saber);
        setHacerPct(pctForm.hacer);
        setSerPct(pctForm.ser);
        setFinalPct(pctForm.final);
        setPctSuccess(true);
        setTimeout(() => setPctSuccess(false), 3000);
      }
    } catch (e) {
      // silent fail
    }
    setSavingPct(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-[#f98012]" size={36} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Save bar */}
      {hasChanges && (
        <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-xl p-4 animate-scale-in">
          <div className="flex items-center gap-2 text-orange-800 text-sm font-semibold">
            <AlertTriangle size={18} className="text-[#f98012]" />
            Planilla editada. Tienes cambios sin guardar.
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Undo2 size={14} />
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Guardar Calificaciones
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm font-bold animate-scale-in">
          <Check size={18} />
          Calificaciones guardadas correctamente.
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 animate-fade-in px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                Agregar Columna — {addingType === "EXAM" ? "Saber (Cognitivo)" : addingType === "TASK" ? "Hacer (Procedimental)" : addingType === "SER" ? "Ser (Actitudinal)" : addingType === "FINAL" ? "Examen Final" : "Asistencia"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Título de la Evaluación</label>
              <input
                type="text"
                placeholder={addingType === "SER" ? "Ej. Autoevaluación" : "Ej. Evaluación Final"}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="input"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Se creará automáticamente para el periodo <b>{activePeriod}</b> con fecha de entrega para hoy.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()} className="btn btn-primary min-w-[100px]">
                {addingTask ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Crear Columna"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Header Info Box */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm">
        <div>
          <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">Docente</span>
          <span className="font-semibold text-gray-800">{teacherName}</span>
        </div>
        <div>
          <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">Asignatura</span>
          <span className="font-semibold text-gray-800">{courseName}</span>
        </div>
        <div>
          <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">Año Lectivo</span>
          <span className="font-semibold text-gray-800">{new Date().getFullYear()}</span>
        </div>
        <div>
          <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">Periodo</span>
          <span className="font-semibold text-gray-800">{activePeriod}</span>
        </div>
      </div>

      {/* Inline Percentage Editor */}
      <div className={`border rounded-xl p-4 text-xs ${
        pctTotal === 100
          ? "bg-white border-gray-200"
          : "bg-red-50 border-red-300"
      }`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-gray-500 font-bold">
            <Percent size={14} />
            <span className="text-[11px] uppercase tracking-wider">Pesos de Evaluación</span>
          </div>

          {[
            { key: "saber" as const, label: "Saber", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
            { key: "hacer" as const, label: "Hacer", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
            { key: "ser" as const, label: "Ser", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
            { key: "final" as const, label: "Exam. Final", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
          ].map(({ key, label, color, bg, border }) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`font-bold ${color}`}>{label}</span>
              <div className={`flex items-center gap-0.5 ${bg} border ${border} rounded-lg px-1.5 py-0.5`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pctForm[key]}
                  onChange={e => {
                    setPctForm(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }));
                    setPctSuccess(false);
                  }}
                  className={`w-10 text-center font-black bg-transparent border-none outline-none ${color} text-sm`}
                />
                <span className={`${color} font-bold`}>%</span>
              </div>
            </div>
          ))}

          <div className={`font-black text-sm px-2 py-0.5 rounded-lg ${
            pctTotal === 100 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-100"
          }`}>
            Total: {pctTotal}%{pctTotal !== 100 && " ⚠️"}
          </div>

          {pctChanged && pctTotal === 100 && (
            <button
              onClick={handleSavePct}
              disabled={savingPct}
              className="btn btn-primary py-1 px-3 text-xs flex items-center gap-1.5 ml-auto"
            >
              {savingPct ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar Pesos
            </button>
          )}

          {pctSuccess && (
            <span className="flex items-center gap-1 text-green-700 font-bold ml-auto">
              <Check size={13} /> Guardado
            </span>
          )}
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              {/* Row 1: Categories */}
              <tr className="bg-gray-100 border-b border-gray-200 text-center font-bold text-gray-700">
                <th rowSpan={2} className="p-3 border-r border-gray-200 w-10 text-center">No.</th>
                <th rowSpan={2} className="p-3 border-r border-gray-200 text-left min-w-[200px]">Nombre Completo</th>
                
                {/* Saber Category Header */}
                <th colSpan={Math.max(1, saberTasks.length)} className="p-2 border-r border-gray-200 bg-purple-50 text-purple-800 uppercase tracking-wide">
                  <div className="flex items-center justify-center gap-1.5">
                    Saber ({saberPct}%)
                    <button onClick={() => openAddModal("EXAM")} className="p-1 hover:bg-purple-200 bg-purple-100 rounded text-purple-700 transition-colors" title="Agregar examen">
                      <Plus size={14} />
                    </button>
                  </div>
                </th>

                {/* Hacer Category Header */}
                <th colSpan={Math.max(1, hacerTasks.length)} className="p-2 border-r border-gray-200 bg-orange-50 text-orange-800 uppercase tracking-wide">
                  <div className="flex items-center justify-center gap-1.5">
                    Hacer ({hacerPct}%)
                    <button onClick={() => openAddModal("TASK")} className="p-1 hover:bg-orange-200 bg-orange-100 rounded text-orange-700 transition-colors" title="Agregar tarea">
                      <Plus size={14} />
                    </button>
                  </div>
                </th>

                {/* Ser Category Header */}
                <th colSpan={Math.max(1, serTasks.length)} className="p-2 border-r border-gray-200 bg-yellow-50 text-yellow-800 uppercase tracking-wide">
                  <div className="flex items-center justify-center gap-1.5">
                    Ser ({serPct}%)
                    <button onClick={() => openAddModal("SER")} className="p-1 hover:bg-yellow-200 bg-yellow-100 rounded text-yellow-700 transition-colors" title="Agregar evaluación">
                      <Plus size={14} />
                    </button>
                  </div>
                </th>

                {/* Final Exam Header - always visible */}
                <th colSpan={Math.max(1, finalTasks.length)} className="p-2 border-r border-gray-200 bg-sky-50 text-sky-800 uppercase tracking-wide">
                  <div className="flex items-center justify-center gap-1.5">
                    {finalPct > 0 ? `Examen Final (${finalPct}%)` : "Examen Final"}
                    <button onClick={() => openAddModal("FINAL")} className="p-1 hover:bg-sky-200 bg-sky-100 rounded text-sky-700 transition-colors" title="Agregar examen final">
                      <Plus size={14} />
                    </button>
                  </div>
                </th>

                {/* Asistencia Header - always visible */}
                <th colSpan={Math.max(1, attendTasks.length)} className="p-2 border-r border-gray-200 bg-green-50 text-green-800 uppercase tracking-wide">
                  <div className="flex items-center justify-center gap-1.5">
                    Asistencia
                    <button onClick={() => openAddModal("ATTEND")} className="p-1 hover:bg-green-200 bg-green-100 rounded text-green-700 transition-colors" title="Agregar columna de asistencia">
                      <Plus size={14} />
                    </button>
                  </div>
                </th>

                {/* Averages DEF Header */}
                <th colSpan={finalPct > 0 ? 4 : 3} className="p-2 border-r border-gray-200 bg-blue-50 text-blue-800 uppercase tracking-wide">
                  Def (Ponderada)
                </th>

                <th rowSpan={2} className="p-3 border-r border-gray-200 bg-gray-100 text-center font-bold">Def (Final)</th>
                <th rowSpan={2} className="p-3 text-center font-bold">Desempeño</th>
              </tr>

              {/* Row 2: Sub-headers / Numbers */}
              <tr className="bg-gray-50 border-b border-gray-200 text-center font-bold text-gray-500">
                {/* Saber numbering */}
                {saberTasks.length === 0 ? (
                  <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                ) : (
                  saberTasks.map(t => (
                    <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-purple-100" title={t.title}>
                      {taskNumbers[t.id]}
                    </th>
                  ))
                )}

                {/* Hacer numbering */}
                {hacerTasks.length === 0 ? (
                  <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                ) : (
                  hacerTasks.map(t => (
                    <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-orange-100" title={t.title}>
                      {taskNumbers[t.id]}
                    </th>
                  ))
                )}

                {/* Ser numbering */}
                {serTasks.length === 0 ? (
                  <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                ) : (
                  serTasks.map(t => (
                    <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-yellow-100" title={t.title}>
                      {taskNumbers[t.id]}
                    </th>
                  ))
                )}

                {/* Final numbering - always visible */}
                {finalTasks.length === 0 ? (
                  <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                ) : (
                  finalTasks.map(t => (
                    <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-sky-100" title={t.title}>
                      {taskNumbers[t.id]}
                    </th>
                  ))
                )}

                {/* Attend numbering */}
                {attendTasks.length === 0 ? (
                  <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                ) : (
                  attendTasks.map(t => (
                    <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-green-100" title={t.title}>
                      {taskNumbers[t.id]}
                    </th>
                  ))
                )}

                {/* Def saber/hacer/ser (weighted) */}
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-16">Saber×{saberPct}%</th>
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-16">Hacer×{hacerPct}%</th>
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-16">Ser×{serPct}%</th>
                {finalPct > 0 && <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-16">Final×{finalPct}%</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={2 + Math.max(1, saberTasks.length) + Math.max(1, hacerTasks.length) + Math.max(1, serTasks.length) + Math.max(1, finalTasks.length) + Math.max(1, attendTasks.length) + (finalPct > 0 ? 4 : 3) + 2} className="p-8 text-center text-gray-400 font-medium italic">
                    No hay estudiantes matriculados en esta asignatura.
                  </td>
                </tr>
              ) : (
                students.map((student, idx) => {
                  const grades = gradesGrid[student.id] || {};
                  const initial = initialGradesGrid[student.id] || {};
                  const stats = calculateStudentRow(student.id);

                  return (
                    <tr 
                      key={student.id} 
                      className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                    >
                      {/* No. */}
                      <td className="p-2 border-r border-gray-200 text-center font-medium text-gray-400">
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td className="p-2 border-r border-gray-200 font-semibold text-gray-800">
                        <div>{student.name}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{student.groupName}</div>
                      </td>

                      {/* Saber input cells */}
                      {saberTasks.length === 0 ? (
                        <td className="p-1 border-r border-gray-200 bg-gray-50/50"></td>
                      ) : (
                        saberTasks.map(t => {
                          const val = grades[t.id] ?? "";
                          const isChanged = val !== (initial[t.id] ?? "");
                          const isLow = val !== "" && parseFloat(val) < 3.0;

                          return (
                            <td 
                              key={t.id} 
                              className={`p-1 border-r border-gray-200 text-center ${
                                isChanged ? "bg-amber-50" : isLow ? "bg-red-50/30" : ""
                              }`}
                            >
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="5.0"
                                placeholder="—"
                                value={val}
                                onChange={e => handleCellChange(student.id, t.id, e.target.value)}
                                className={`w-10 text-center font-bold rounded border py-1 focus:outline-none transition-colors ${
                                  isChanged 
                                    ? "border-amber-400 focus:border-amber-500 text-amber-700 bg-amber-50" 
                                    : isLow 
                                      ? "border-red-200 focus:border-red-400 text-red-600 bg-red-50/50" 
                                      : "border-gray-200 focus:border-[#f98012] text-gray-800"
                                }`}
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Hacer input cells */}
                      {hacerTasks.length === 0 ? (
                        <td className="p-1 border-r border-gray-200 bg-gray-50/50"></td>
                      ) : (
                        hacerTasks.map(t => {
                          const val = grades[t.id] ?? "";
                          const isChanged = val !== (initial[t.id] ?? "");
                          const isLow = val !== "" && parseFloat(val) < 3.0;

                          return (
                            <td 
                              key={t.id} 
                              className={`p-1 border-r border-gray-200 text-center ${
                                isChanged ? "bg-amber-50" : isLow ? "bg-red-50/30" : ""
                              }`}
                            >
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="5.0"
                                placeholder="—"
                                value={val}
                                onChange={e => handleCellChange(student.id, t.id, e.target.value)}
                                className={`w-10 text-center font-bold rounded border py-1 focus:outline-none transition-colors ${
                                  isChanged 
                                    ? "border-amber-400 focus:border-amber-500 text-amber-700 bg-amber-50" 
                                    : isLow 
                                      ? "border-red-200 focus:border-red-400 text-red-600 bg-red-50/50" 
                                      : "border-gray-200 focus:border-[#f98012] text-gray-800"
                                }`}
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Ser input cells */}
                      {serTasks.length === 0 ? (
                        <td className="p-1 border-r border-gray-200 bg-gray-50/50"></td>
                      ) : (
                        serTasks.map(t => {
                          const val = grades[t.id] ?? "";
                          const isChanged = val !== (initial[t.id] ?? "");
                          const isLow = val !== "" && parseFloat(val) < 3.0;

                          return (
                            <td 
                              key={t.id} 
                              className={`p-1 border-r border-gray-200 text-center ${
                                isChanged ? "bg-amber-50" : isLow ? "bg-red-50/30" : ""
                              }`}
                            >
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="5.0"
                                placeholder="—"
                                value={val}
                                onChange={e => handleCellChange(student.id, t.id, e.target.value)}
                                className={`w-10 text-center font-bold rounded border py-1 focus:outline-none transition-colors ${
                                  isChanged 
                                    ? "border-amber-400 focus:border-amber-500 text-amber-700 bg-amber-50" 
                                    : isLow 
                                      ? "border-red-200 focus:border-red-400 text-red-600 bg-red-50/50" 
                                      : "border-gray-200 focus:border-[#f98012] text-gray-800"
                                }`}
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Final Exam input cells - always visible */}
                      {finalTasks.length === 0 ? (
                        <td className="p-1 border-r border-gray-200 bg-gray-50/50"></td>
                      ) : (
                        finalTasks.map(t => {
                          const val = grades[t.id] ?? "";
                          const isChanged = val !== (initial[t.id] ?? "");
                          const isLow = val !== "" && parseFloat(val) < 3.0;

                          return (
                            <td 
                              key={t.id} 
                              className={`p-1 border-r border-gray-200 text-center ${
                                isChanged ? "bg-amber-50" : isLow ? "bg-red-50/30" : ""
                              }`}
                            >
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="5.0"
                                placeholder="—"
                                value={val}
                                onChange={e => handleCellChange(student.id, t.id, e.target.value)}
                                className={`w-10 text-center font-bold rounded border py-1 focus:outline-none transition-colors ${
                                  isChanged 
                                    ? "border-amber-400 focus:border-amber-500 text-sky-700 bg-sky-50" 
                                    : isLow 
                                      ? "border-red-200 focus:border-red-400 text-red-600 bg-red-50/50" 
                                      : "border-sky-200 focus:border-sky-400 text-sky-800"
                                }`}
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Asistencia input cells */}
                      {attendTasks.length === 0 ? (
                        <td className="p-1 border-r border-gray-200 bg-gray-50/50"></td>
                      ) : (
                        attendTasks.map(t => {
                          const val = grades[t.id] ?? "";
                          const isChanged = val !== (initial[t.id] ?? "");

                          return (
                            <td 
                              key={t.id} 
                              className={`p-1 border-r border-gray-200 text-center ${
                                isChanged ? "bg-amber-50" : ""
                              }`}
                            >
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                placeholder="—"
                                value={val}
                                onChange={e => handleCellChange(student.id, t.id, e.target.value)}
                                className={`w-10 text-center font-bold rounded border py-1 focus:outline-none transition-colors ${
                                  isChanged 
                                    ? "border-amber-400 focus:border-amber-500 text-amber-700 bg-amber-50" 
                                    : "border-green-200 focus:border-green-400 text-green-800"
                                }`}
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Component Defs - WEIGHTED */}
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-purple-700 bg-blue-50/10">
                        {stats.saberAvg !== null ? (stats.saberAvg * saberPct / 100).toFixed(2) : "—"}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-orange-700 bg-blue-50/10">
                        {stats.hacerAvg !== null ? (stats.hacerAvg * hacerPct / 100).toFixed(2) : "—"}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-yellow-700 bg-blue-50/10">
                        {stats.ser !== null ? (stats.ser * serPct / 100).toFixed(2) : "—"}
                      </td>
                      {finalPct > 0 && (
                        <td className="p-2 border-r border-gray-200 text-center font-semibold text-sky-700 bg-blue-50/10">
                          {stats.finalExam !== null ? (stats.finalExam * finalPct / 100).toFixed(2) : "—"}
                        </td>
                      )}

                      {/* Final Def */}
                      <td className={`p-2 border-r border-gray-200 text-center font-extrabold text-sm ${
                        stats.finalGrade !== null && stats.finalGrade < 3.0 ? "text-red-600 bg-red-50/20" : "text-green-600 bg-green-50/20"
                      }`}>
                        {stats.finalGrade !== null ? stats.finalGrade.toFixed(2) : "—"}
                      </td>

                      {/* Desempeño */}
                      <td className="p-2 text-center font-bold">
                        {stats.desempeno ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] ${stats.desempenoClass}`}>
                            {stats.desempeno}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend / Task Directory Details */}
      <div className="card p-5 border border-gray-200 bg-gray-50 rounded-xl mt-4">
        <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
          <Info size={16} className="text-gray-400" />
          Directorio de Evaluaciones
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {tasks.map(t => (
            <div key={t.id} className="flex gap-2 items-start justify-between p-2 bg-white rounded border border-gray-200 shadow-sm group">
              <div className="flex gap-2 items-start">
                <span className={`px-2 py-0.5 rounded font-black ${
                  t.type === "EXAM" ? "bg-purple-100 text-purple-800" : 
                  t.type === "TASK" ? "bg-orange-100 text-orange-800" :
                  t.type === "SER" ? "bg-yellow-100 text-yellow-800" :
                  t.type === "FINAL" ? "bg-sky-100 text-sky-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {taskNumbers[t.id]}
                </span>
                <div>
                  <p className="font-bold text-gray-800 truncate max-w-[180px]" title={t.title}>{t.title}</p>
                  <p className="text-gray-400 font-semibold">{
                    t.type === "EXAM" ? "Saber (Cognitivo)" : 
                    t.type === "TASK" ? "Hacer (Procedimental)" :
                    t.type === "SER" ? "Ser (Actitudinal)" :
                    t.type === "FINAL" ? "Examen Final" :
                    "Asistencia"
                  }</p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTask(t.id)}
                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Eliminar columna"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
