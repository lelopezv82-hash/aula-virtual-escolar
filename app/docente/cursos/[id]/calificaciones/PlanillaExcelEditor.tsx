"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Save, Undo2, Info, AlertTriangle, Check } from "lucide-react";

interface Student {
  id: string;
  name: string;
  groupName: string;
}

interface Task {
  id: string;
  title: string;
  type: string; // EXAM | TASK
  submissions: Array<{
    studentId: string;
    status: string;
    grade: number | null;
  }>;
}

interface AdditionalGrade {
  studentId: string;
  grade: number;
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

  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saberPct, setSaberPct] = useState(30);
  const [hacerPct, setHacerPct] = useState(50);
  const [serPct, setSerPct] = useState(20);
  const [teacherName, setTeacherName] = useState("");
  const [courseName, setCourseName] = useState("");

  // Local state for all editable grades
  // Format: { [studentId]: { [taskId/additionalGradeKey]: string (input value) } }
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
          setTeacherName(json.teacherName || "Docente");
          setCourseName(json.course?.name || "Asignatura");

          // Build grid data
          const grid: Record<string, Record<string, string>> = {};
          const rawTasks = json.tasks || [];
          const rawAddl = json.additionalGrades || [];

          for (const student of json.students || []) {
            grid[student.id] = {};
            // Set task grades
            for (const t of rawTasks) {
              const sub = t.submissions?.find((s: any) => s.studentId === student.id);
              grid[student.id][t.id] = sub && sub.grade !== null ? sub.grade.toFixed(1) : "";
            }
            // Set actitudinal (SER) grade
            const serEntry = rawAddl.find((a: any) => a.studentId === student.id);
            grid[student.id]["ser"] = serEntry ? serEntry.grade.toFixed(1) : "";
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
  }, [courseId, activePeriod]);

  // Separate tasks by type
  const saberTasks = useMemo(() => tasks.filter(t => t.type === "EXAM"), [tasks]);
  const hacerTasks = useMemo(() => tasks.filter(t => t.type === "TASK"), [tasks]);

  // Map tasks to sequential numbers for the Excel headers
  const taskNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let counter = 1;
    saberTasks.forEach(t => {
      map[t.id] = counter++;
    });
    hacerTasks.forEach(t => {
      map[t.id] = counter++;
    });
    map["ser"] = counter; // Last number is SER
    return map;
  }, [saberTasks, hacerTasks]);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(gradesGrid) !== JSON.stringify(initialGradesGrid);
  }, [gradesGrid, initialGradesGrid]);

  // Handle cell input change
  const handleCellChange = (studentId: string, key: string, value: string) => {
    // Basic validation: allow empty string, or numbers between 1 and 5
    if (value !== "") {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || parsed < 0 || parsed > 9.9) return; // Prevent crazy inputs
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
  const calculateStudentRow = (studentId: string) => {
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

    // 3. Ser Value
    const serVal = parseFloat(studentGrades["ser"]);
    const ser = !isNaN(serVal) && serVal >= 1.0 && serVal <= 5.0 ? serVal : null;

    // 4. Final weighted grade
    const components = [saberAvg, hacerAvg, ser].filter((c): c is number => c !== null);
    const finalGrade = components.length > 0
      ? (saberAvg !== null ? saberAvg * (saberPct / 100) : 0) +
        (hacerAvg !== null ? hacerAvg * (hacerPct / 100) : 0) +
        (ser !== null ? ser * (serPct / 100) : 0)
      : null;

    // 5. Desempeño
    let desempeno = "";
    let desempenoClass = "";
    if (finalGrade !== null) {
      const fg = parseFloat(finalGrade.toFixed(2));
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
      finalGrade,
      desempeno,
      desempenoClass
    };
  };

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
    const additionalGrades: Array<{ studentId: string; grade: number | null }> = [];

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

      // Ser (additional grade)
      if (current["ser"] !== initial["ser"]) {
        const val = current["ser"];
        additionalGrades.push({
          studentId,
          grade: val === "" ? null : parseFloat(val)
        });
      }
    }

    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: activePeriod,
          submissions,
          additionalGrades
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
                {saberTasks.length > 0 && (
                  <th colSpan={saberTasks.length} className="p-2 border-r border-gray-200 bg-purple-50 text-purple-800 uppercase tracking-wide">
                    Saber ({saberPct}%)
                  </th>
                )}

                {/* Hacer Category Header */}
                {hacerTasks.length > 0 && (
                  <th colSpan={hacerTasks.length} className="p-2 border-r border-gray-200 bg-orange-50 text-orange-800 uppercase tracking-wide">
                    Hacer ({hacerPct}%)
                  </th>
                )}

                {/* Ser Category Header */}
                <th className="p-2 border-r border-gray-200 bg-yellow-50 text-yellow-800 uppercase tracking-wide">
                  Ser ({serPct}%)
                </th>

                {/* Averages DEF Header */}
                <th colSpan={3} className="p-2 border-r border-gray-200 bg-blue-50 text-blue-800 uppercase tracking-wide">
                  Def (Componentes)
                </th>

                <th rowSpan={2} className="p-3 border-r border-gray-200 bg-gray-100 text-center font-bold">Def (Final)</th>
                <th rowSpan={2} className="p-3 text-center font-bold">Desempeño</th>
              </tr>

              {/* Row 2: Sub-headers / Numbers */}
              <tr className="bg-gray-50 border-b border-gray-200 text-center font-bold text-gray-500">
                {/* Saber numbering */}
                {saberTasks.map(t => (
                  <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-purple-100" title={t.title}>
                    {taskNumbers[t.id]}
                  </th>
                ))}

                {/* Hacer numbering */}
                {hacerTasks.map(t => (
                  <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-orange-100" title={t.title}>
                    {taskNumbers[t.id]}
                  </th>
                ))}

                {/* Ser numbering */}
                <th className="p-2 border-r border-gray-200 w-12 hover:bg-yellow-100" title="Actitud y Comportamiento">
                  {taskNumbers["ser"]}
                </th>

                {/* Def saber/hacer/ser */}
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-14">Saber</th>
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-14">Hacer</th>
                <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-14">Ser</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={2 + tasks.length + 1 + 3 + 2} className="p-8 text-center text-gray-400 font-medium italic">
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
                      {saberTasks.map(t => {
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
                      })}

                      {/* Hacer input cells */}
                      {hacerTasks.map(t => {
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
                      })}

                      {/* Ser input cell */}
                      {(() => {
                        const val = grades["ser"] ?? "";
                        const isChanged = val !== (initial["ser"] ?? "");
                        const isLow = val !== "" && parseFloat(val) < 3.0;

                        return (
                          <td 
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
                              onChange={e => handleCellChange(student.id, "ser", e.target.value)}
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
                      })()}

                      {/* Component Defs */}
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-gray-600 bg-blue-50/10">
                        {stats.saberAvg !== null ? stats.saberAvg.toFixed(1) : "—"}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-gray-600 bg-blue-50/10">
                        {stats.hacerAvg !== null ? stats.hacerAvg.toFixed(1) : "—"}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center font-semibold text-gray-600 bg-blue-50/10">
                        {stats.ser !== null ? stats.ser.toFixed(1) : "—"}
                      </td>

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
      <div className="card p-5 border border-gray-200 bg-gray-50 rounded-xl">
        <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
          <Info size={16} className="text-gray-400" />
          Directorio de Evaluaciones
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {tasks.map(t => (
            <div key={t.id} className="flex gap-2 items-start p-2 bg-white rounded border border-gray-200 shadow-sm">
              <span className={`px-2 py-0.5 rounded font-black ${
                t.type === "EXAM" ? "bg-purple-100 text-purple-800" : "bg-orange-100 text-orange-800"
              }`}>
                {taskNumbers[t.id]}
              </span>
              <div>
                <p className="font-bold text-gray-800 truncate max-w-[200px]" title={t.title}>{t.title}</p>
                <p className="text-gray-400 font-semibold">{t.type === "EXAM" ? "Saber (Cognitivo)" : "Hacer (Procedimental)"}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-start p-2 bg-white rounded border border-gray-200 shadow-sm">
            <span className="px-2 py-0.5 rounded font-black bg-yellow-100 text-yellow-800">
              {taskNumbers["ser"]}
            </span>
            <div>
              <p className="font-bold text-gray-800">Nota del Ser</p>
              <p className="text-gray-400 font-semibold">Ser (Actitudinal)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
