"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
// @ts-ignore
import autoTable from "jspdf-autotable";

interface Group {
  id: string;
  name: string;
  grade?: { name: string };
}

interface Course {
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
  courses: Course[];
  periods: Period[];
  teacherName: string;
}

interface Student {
  id: string;
  name: string;
  group: { name: string; grade: { name: string } };
}

interface Task {
  id: string;
  title: string;
  theme?: string | null;
  type: string;
  weight: number;
  submissions: { studentId: string; grade: number | null; status: string }[];
}

export default function PlanillasClient({ courses, periods, teacherName }: PlanillasClientProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses.length > 0 ? courses[0].id : "");
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods.length > 0 ? periods[0].name : "Periodo 1");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  // Weights state
  const [weights, setWeights] = useState({
    saber: 25,
    hacer: 40,
    ser: 15,
    examen: 20
  });

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const groups = selectedCourse?.groups || [];

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    } else if (groups.length === 0) {
      setSelectedGroupId("");
    }
  }, [selectedCourseId, groups]);

  useEffect(() => {
    if (selectedCourseId && selectedPeriod && selectedGroupId) {
      fetchData();
    } else {
      setStudents([]);
      setTasks([]);
    }
  }, [selectedCourseId, selectedPeriod, selectedGroupId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docente/planillas?courseId=${selectedCourseId}&period=${selectedPeriod}&groupId=${selectedGroupId}`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Error fetching planillas:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  // Categorize tasks
  const isTheme = (task: Task, keyword: string) => {
    const t = (task.theme || "").toLowerCase();
    const title = task.title.toLowerCase();
    const k = keyword.toLowerCase();
    return t.includes(k) || title.includes(k);
  };

  const saberTasks = tasks.filter(t => isTheme(t, "saber") && !isTheme(t, "examen"));
  const hacerTasks = tasks.filter(t => isTheme(t, "hacer") && !isTheme(t, "examen"));
  const serTasks = tasks.filter(t => isTheme(t, "ser") && !isTheme(t, "examen"));
  const examenTasks = tasks.filter(t => isTheme(t, "examen") || t.type === "EXAM");
  
  // If some tasks didn't match anything, let's just distribute them or show an 'Otras' column if needed
  // For matching the UI exactly, we map grades for each student
  
  const getStudentGradeForTask = (studentId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;
    const sub = task.submissions.find(s => s.studentId === studentId);
    return sub?.grade ?? null;
  };

  const calculateCategoryAverage = (studentId: string, categoryTasks: Task[]) => {
    if (categoryTasks.length === 0) return null;
    let sum = 0;
    let count = 0;
    categoryTasks.forEach(t => {
      const grade = getStudentGradeForTask(studentId, t.id);
      if (grade !== null) {
        sum += grade;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  };

  const getDesempeno = (grade: number) => {
    if (grade >= 4.6) return "SUPERIOR";
    if (grade >= 4.0) return "ALTO";
    if (grade >= 3.0) return "BÁSICO";
    return "BAJO";
  };

  const getColorForGrade = (grade: number | null) => {
    if (grade === null) return "inherit";
    if (grade < 3.0) return "#dc2626"; // red
    if (grade < 4.0) return "#d97706"; // orange/yellow
    return "#16a34a"; // green
  };

  const exportToExcel = () => {
    const table = document.getElementById("planillas-table");
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: "Planilla" });
    XLSX.writeFile(wb, `Planilla_${selectedCourse?.name}_${selectedPeriod}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    doc.text(`Consolidado de Calificaciones - ${selectedCourse?.name}`, 14, 15);
    doc.text(`Docente: ${teacherName} | Periodo: ${selectedPeriod}`, 14, 22);
    autoTable(doc, { 
      html: '#planillas-table', 
      startY: 30,
      styles: { fontSize: 8 }
    });
    doc.save(`Planilla_${selectedCourse?.name}_${selectedPeriod}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/docente" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Consolidado de Calificaciones</h1>
            <p className="text-muted text-sm">{selectedCourse?.name || "Asignatura"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold mr-4 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted">
            <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            {students.length} estudiantes
          </div>
          <button onClick={exportToExcel} className="btn btn-secondary flex items-center gap-2 text-sm bg-white border border-gray-200 shadow-sm" style={{ color: "#374151" }}>
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
          <button onClick={exportToPDF} className="btn btn-primary flex items-center gap-2 text-sm" style={{ background: "#f97316", borderColor: "#ea580c" }}>
            <FileText size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Selectors Card */}
      <div className="card p-4 rounded-xl border flex flex-wrap gap-6 items-end bg-white dark:bg-gray-900 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Asignatura</label>
          <select 
            className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
            style={{ borderColor: "var(--border-color)" }}
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            {courses.length === 0 && <option value="">Sin asignaturas</option>}
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Periodo</label>
          <select 
            className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
            style={{ borderColor: "var(--border-color)" }}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {periods.length === 0 && <option value="">Sin periodos</option>}
            {periods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Grado y Curso (Grupo)</label>
          <select 
            className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
            style={{ borderColor: "var(--border-color)" }}
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            {groups.length === 0 && <option value="">Sin grupos asignados</option>}
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.grade?.name ? `${g.grade.name} - ${g.name}` : g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info Card mimicking the image */}
      <div className="card rounded-2xl border shadow-sm p-0 overflow-hidden bg-white dark:bg-gray-900" style={{ borderColor: "var(--border-color)" }}>
        
        <div className="flex items-center justify-center py-3 bg-orange-100 dark:bg-orange-950/30 border-b" style={{ borderColor: "var(--border-color)" }}>
          <span className="font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 px-4 py-1 rounded-full shadow-sm text-sm">
            {selectedPeriod}
          </span>
        </div>
        
        <div className="text-center py-2 border-b text-xs font-bold text-gray-600 dark:text-gray-400" style={{ borderColor: "var(--border-color)" }}>
          <span className="underline decoration-gray-400 underline-offset-2">Planilla de Notas (Excel)</span> <span className="font-normal">Resumen por Periodo (Tarjetas)</span>
        </div>

        <div className="flex justify-between items-center p-4 border-b text-sm" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase">Docente</div>
            <div className="font-bold">{teacherName}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase">Asignatura</div>
            <div className="font-bold">{selectedCourse?.name || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase">Año Lectivo</div>
            <div className="font-bold">{currentYear}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase">Periodo</div>
            <div className="font-bold">{selectedPeriod}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-xs font-bold text-gray-500 whitespace-nowrap">% PESOS DE EVALUACIÓN</div>
          <div className="flex items-center gap-3 text-sm font-bold flex-1">
            <span style={{ color: "#a855f7" }}>Saber <input type="number" value={weights.saber} onChange={e => setWeights({...weights, saber: parseInt(e.target.value) || 0})} className="w-12 text-center rounded border p-1 bg-white" /> %</span>
            <span style={{ color: "#d97706" }}>Hacer <input type="number" value={weights.hacer} onChange={e => setWeights({...weights, hacer: parseInt(e.target.value) || 0})} className="w-12 text-center rounded border p-1 bg-white" /> %</span>
            <span style={{ color: "#eab308" }}>Ser <input type="number" value={weights.ser} onChange={e => setWeights({...weights, ser: parseInt(e.target.value) || 0})} className="w-12 text-center rounded border p-1 bg-white" /> %</span>
            <span style={{ color: "#3b82f6" }}>Exam. Final <input type="number" value={weights.examen} onChange={e => setWeights({...weights, examen: parseInt(e.target.value) || 0})} className="w-12 text-center rounded border p-1 bg-white" /> %</span>
            <span className="text-green-600">Total: {weights.saber + weights.hacer + weights.ser + weights.examen}%</span>
          </div>
          <button className="text-xs font-bold text-green-600 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-green-100 transition-colors">
            + Activar Asistencia
          </button>
        </div>

        {/* The Spreadsheet */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
          ) : (
            <table id="planillas-table" className="w-full text-center text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80">
                  <th rowSpan={2} className="border p-2 font-bold text-gray-600 dark:text-gray-300 w-8">No.</th>
                  <th rowSpan={2} className="border p-2 font-bold text-gray-600 dark:text-gray-300 text-left w-64">Nombre Completo</th>
                  <th colSpan={Math.max(saberTasks.length, 1)} className="border p-2 font-bold" style={{ color: "#a855f7", backgroundColor: "#f3e8ff" }}>SABER ({weights.saber}%) <span className="text-xs">+</span></th>
                  <th colSpan={Math.max(hacerTasks.length, 1)} className="border p-2 font-bold" style={{ color: "#d97706", backgroundColor: "#fef3c7" }}>HACER ({weights.hacer}%) <span className="text-xs">+</span></th>
                  <th colSpan={Math.max(serTasks.length, 1)} className="border p-2 font-bold" style={{ color: "#b45309", backgroundColor: "#fef3c7" }}>SER ({weights.ser}%) <span className="text-xs">+</span></th>
                  <th colSpan={Math.max(examenTasks.length, 1)} className="border p-2 font-bold" style={{ color: "#1d4ed8", backgroundColor: "#dbeafe" }}>EXAMEN FINAL ({weights.examen}%) <span className="text-xs">+</span></th>
                  <th colSpan={4} className="border p-2 font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/20">DEF (PONDERADA)</th>
                  <th rowSpan={2} className="border p-2 font-bold">Def (Final)</th>
                  <th rowSpan={2} className="border p-2 font-bold">Desempeño</th>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/80 text-xs">
                  {saberTasks.length === 0 ? <th className="border p-1">1</th> : saberTasks.map((t, i) => <th key={t.id} className="border p-1" title={t.title}>{i + 1}</th>)}
                  {hacerTasks.length === 0 ? <th className="border p-1">1</th> : hacerTasks.map((t, i) => <th key={t.id} className="border p-1" title={t.title}>{i + 1}</th>)}
                  {serTasks.length === 0 ? <th className="border p-1">1</th> : serTasks.map((t, i) => <th key={t.id} className="border p-1" title={t.title}>{i + 1}</th>)}
                  {examenTasks.length === 0 ? <th className="border p-1">1</th> : examenTasks.map((t, i) => <th key={t.id} className="border p-1" title={t.title}>{i + 1}</th>)}
                  
                  <th className="border p-1 text-gray-500">Saber×{weights.saber}%</th>
                  <th className="border p-1 text-gray-500">Hacer×{weights.hacer}%</th>
                  <th className="border p-1 text-gray-500">Ser×{weights.ser}%</th>
                  <th className="border p-1 text-gray-500">Final×{weights.examen}%</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-muted">No hay estudiantes en este grupo</td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const saberAvg = calculateCategoryAverage(student.id, saberTasks);
                    const hacerAvg = calculateCategoryAverage(student.id, hacerTasks);
                    const serAvg = calculateCategoryAverage(student.id, serTasks);
                    const examAvg = calculateCategoryAverage(student.id, examenTasks);

                    const saberPond = saberAvg !== null ? saberAvg * (weights.saber / 100) : null;
                    const hacerPond = hacerAvg !== null ? hacerAvg * (weights.hacer / 100) : null;
                    const serPond = serAvg !== null ? serAvg * (weights.ser / 100) : null;
                    const examPond = examAvg !== null ? examAvg * (weights.examen / 100) : null;

                    let finalGrade = 0;
                    let validCategories = 0;
                    if (saberPond !== null) { finalGrade += saberPond; validCategories++; }
                    if (hacerPond !== null) { finalGrade += hacerPond; validCategories++; }
                    if (serPond !== null) { finalGrade += serPond; validCategories++; }
                    if (examPond !== null) { finalGrade += examPond; validCategories++; }

                    // If not all categories have grades, this is a partial final grade. 
                    // Let's just show the raw sum if there's at least one grade.
                    const displayFinal = validCategories > 0 ? finalGrade : null;
                    
                    const desempeno = displayFinal !== null ? getDesempeno(displayFinal) : "—";
                    const desempenoColor = desempeno === "BAJO" ? "#dc2626" : desempeno !== "—" ? "#16a34a" : "inherit";

                    const renderCell = (grade: number | null) => (
                      <span style={{ color: getColorForGrade(grade), fontWeight: 600 }}>
                        {grade !== null ? grade.toFixed(1) : "—"}
                      </span>
                    );

                    const renderPond = (pond: number | null, colorStr: string) => (
                      <span style={{ color: pond !== null ? colorStr : "#9ca3af", fontWeight: pond !== null ? 700 : 400 }}>
                        {pond !== null ? pond.toFixed(2) : "—"}
                      </span>
                    );

                    return (
                      <tr key={student.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30" style={{ borderColor: "var(--border-color)" }}>
                        <td className="p-2 text-gray-400">{index + 1}</td>
                        <td className="p-2 text-left">
                          <div className="font-bold text-gray-800 dark:text-gray-200 leading-tight">{student.name}</div>
                          <div className="text-[10px] text-gray-400">{student.group.grade?.name} - {student.group.name}</div>
                        </td>

                        {/* Saber */}
                        {saberTasks.length === 0 ? <td className="p-2 border-x border-gray-100">
                          <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white text-gray-300">—</div>
                        </td> : saberTasks.map(t => (
                          <td key={t.id} className="p-2 border-x border-gray-100">
                            <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white shadow-sm">{renderCell(getStudentGradeForTask(student.id, t.id))}</div>
                          </td>
                        ))}

                        {/* Hacer */}
                        {hacerTasks.length === 0 ? <td className="p-2 border-x border-gray-100">
                          <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white text-gray-300">—</div>
                        </td> : hacerTasks.map(t => (
                          <td key={t.id} className="p-2 border-x border-gray-100">
                            <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white shadow-sm">{renderCell(getStudentGradeForTask(student.id, t.id))}</div>
                          </td>
                        ))}

                        {/* Ser */}
                        {serTasks.length === 0 ? <td className="p-2 border-x border-gray-100">
                          <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white text-gray-300">—</div>
                        </td> : serTasks.map(t => (
                          <td key={t.id} className="p-2 border-x border-gray-100">
                            <div className="w-8 mx-auto border border-gray-200 rounded py-0.5 bg-white shadow-sm">{renderCell(getStudentGradeForTask(student.id, t.id))}</div>
                          </td>
                        ))}

                        {/* Examen */}
                        {examenTasks.length === 0 ? <td className="p-2 border-x border-gray-100">
                          <div className="w-8 mx-auto border border-blue-200 rounded py-0.5 bg-blue-50 text-blue-300">—</div>
                        </td> : examenTasks.map(t => (
                          <td key={t.id} className="p-2 border-x border-gray-100">
                            <div className="w-8 mx-auto border border-blue-200 rounded py-0.5 bg-blue-50 shadow-sm">{renderCell(getStudentGradeForTask(student.id, t.id))}</div>
                          </td>
                        ))}

                        {/* Ponderadas */}
                        <td className="p-2 border-l border-gray-200 bg-gray-50/50 dark:bg-gray-800/30">
                          {renderPond(saberPond, "#a855f7")}
                        </td>
                        <td className="p-2 bg-gray-50/50 dark:bg-gray-800/30">
                          {renderPond(hacerPond, "#d97706")}
                        </td>
                        <td className="p-2 bg-gray-50/50 dark:bg-gray-800/30">
                          {renderPond(serPond, "#b45309")}
                        </td>
                        <td className="p-2 border-r border-gray-200 bg-gray-50/50 dark:bg-gray-800/30">
                          {renderPond(examPond, "#1d4ed8")}
                        </td>

                        {/* Final */}
                        <td className="p-2 font-bold text-base" style={{ color: getColorForGrade(displayFinal) }}>
                          {displayFinal !== null ? displayFinal.toFixed(2) : "—"}
                        </td>
                        
                        {/* Desempeño */}
                        <td className="p-2 font-bold text-xs uppercase" style={{ color: desempenoColor }}>
                          {desempeno}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
