"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Save, Undo2, Info, AlertTriangle, Check, Plus, Trash2, X, Percent } from "lucide-react";
import * as XLSX from "xlsx";

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

  // ── Custom Excel Sync Wizard State ──
  const [customExcelData, setCustomExcelData] = useState<{
    rows: any[][];
    headers: string[];
    headerIndex: number;
  } | null>(null);
  const [excelStudentCol, setExcelStudentCol] = useState<string>("");
  const [excelTaskMappings, setExcelTaskMappings] = useState<Record<string, string>>({});

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

  const exportToExcelSync = () => {
    // 1. Prepare headers
    const row1 = ["STUDENT_ID", "STUDENT_NAME", "GROUP"];
    const row2 = ["ID Estudiante", "Nombre Completo", "Grupo"];

    // Get all active tasks
    const activeTasks: Task[] = [];
    saberTasks.forEach(t => { activeTasks.push(t); row1.push(t.id); row2.push(`SABER ${taskNumbers[t.id]} - ${t.title}`); });
    hacerTasks.forEach(t => { activeTasks.push(t); row1.push(t.id); row2.push(`HACER ${taskNumbers[t.id]} - ${t.title}`); });
    serTasks.forEach(t => { activeTasks.push(t); row1.push(t.id); row2.push(`SER ${taskNumbers[t.id]} - ${t.title}`); });
    finalTasks.forEach(t => { activeTasks.push(t); row1.push(t.id); row2.push(`EXAMEN FINAL ${taskNumbers[t.id]} - ${t.title}`); });
    attendTasks.forEach(t => { activeTasks.push(t); row1.push(t.id); row2.push(`ASISTENCIA ${taskNumbers[t.id]} - ${t.title}`); });

    const dataRows = [row1, row2];

    // Add student rows
    students.forEach(student => {
      const row = [student.id, student.name, student.groupName];
      const studentGrades = gradesGrid[student.id] || {};
      activeTasks.forEach(t => {
        row.push(studentGrades[t.id] || "");
      });
      dataRows.push(row);
    });

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    
    // Hide the first row
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
    XLSX.writeFile(wb, `Sincro_Planilla_${courseName}_${activePeriod}.xlsx`);
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

        const metadataRow = rows[0];
        if (metadataRow && metadataRow[0] === "STUDENT_ID" && metadataRow[1] === "STUDENT_NAME") {
          // Process synchronizable template (original logic)
          const taskIds = metadataRow.slice(3);
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

        const excelHeaders = rows[headerIndex].map((h, idx) => h ? String(h).trim() : `Columna ${idx + 1}`);
        
        const studentCol = excelHeaders.find(h => {
          const nh = h.toLowerCase();
          return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
        }) || excelHeaders[0] || "";

        const mappings: Record<string, string> = {};
        const allPlatformTasks = [...saberTasks, ...hacerTasks, ...serTasks, ...finalTasks, ...attendTasks];
        allPlatformTasks.forEach(t => {
          const category = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
          const platformLabel = `${category} ${taskNumbers[t.id]}`;
          const normLabel = platformLabel.toLowerCase();
          const normTitle = t.title.toLowerCase();
          const numStr = String(taskNumbers[t.id]);

          const matchedCol = excelHeaders.find(h => {
            const nh = h.toLowerCase();
            return nh === normLabel || nh.includes(normLabel) || nh.includes(normTitle) || normTitle.includes(nh) || nh === numStr || nh === `nota ${numStr}` || nh === `nota_${numStr}`;
          }) || "";

          mappings[t.id] = matchedCol;
        });

        setCustomExcelData({ rows, headers: excelHeaders, headerIndex });
        setExcelStudentCol(studentCol);
        setExcelTaskMappings(mappings);

      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al procesar el archivo Excel. Asegúrate de usar la planilla correcta.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleHeaderRowChange = (newIndex: number) => {
    if (!customExcelData) return;
    const { rows } = customExcelData;
    const excelHeaders = rows[newIndex].map((h, idx) => h ? String(h).trim() : `Columna ${idx + 1}`);
    
    const studentCol = excelHeaders.find(h => {
      const nh = h.toLowerCase();
      return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
    }) || excelHeaders[0] || "";

    const mappings: Record<string, string> = {};
    const allPlatformTasks = [...saberTasks, ...hacerTasks, ...serTasks, ...finalTasks, ...attendTasks];
    allPlatformTasks.forEach(t => {
      const category = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
      const platformLabel = `${category} ${taskNumbers[t.id]}`;
      const normLabel = platformLabel.toLowerCase();
      const normTitle = t.title.toLowerCase();

      const matchedCol = excelHeaders.find(h => {
        const nh = h.toLowerCase();
        return nh === normLabel || nh.includes(normLabel) || nh.includes(normTitle) || normTitle.includes(nh);
      }) || "";

      mappings[t.id] = matchedCol;
    });

    setCustomExcelData({ rows, headers: excelHeaders, headerIndex: newIndex });
    setExcelStudentCol(studentCol);
    setExcelTaskMappings(mappings);
  };

  const confirmCustomExcelSync = () => {
    if (!customExcelData || !excelStudentCol) return;

    const { rows, headers, headerIndex } = customExcelData;
    const studentColIdx = headers.indexOf(excelStudentCol);
    if (studentColIdx === -1) {
      alert("No se encontró la columna de nombres seleccionada.");
      return;
    }

    const updatedGradesGrid = { ...gradesGrid };
    
    const normalizeName = (name: string) => {
      return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ");
    };

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
        if (shared > maxSharedTokens) {
          maxSharedTokens = shared;
          bestStudent = student;
        }
      });

      if (maxSharedTokens >= 2 || (maxSharedTokens >= 1 && excelTokens.length === 1)) {
        return bestStudent;
      }
      return null;
    };

    let matchedCount = 0;

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const excelName = row[studentColIdx];
      if (!excelName) continue;

      const studentMatch = findBestStudentMatch(String(excelName));
      if (!studentMatch) continue;

      matchedCount++;

      if (!updatedGradesGrid[studentMatch.id]) {
        updatedGradesGrid[studentMatch.id] = {};
      }

      Object.keys(excelTaskMappings).forEach(taskId => {
        const excelColHeader = excelTaskMappings[taskId];
        if (!excelColHeader) return;

        const excelColIdx = headers.indexOf(excelColHeader);
        if (excelColIdx === -1) return;

        const gradeVal = row[excelColIdx];
        
        let formattedGrade = "";
        if (gradeVal !== undefined && gradeVal !== null && gradeVal !== "") {
          const num = parseFloat(gradeVal);
          if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
            formattedGrade = num.toFixed(1);
          }
        }
        updatedGradesGrid[studentMatch.id][taskId] = formattedGrade;
      });
    }

    setGradesGrid(updatedGradesGrid);
    setCustomExcelData(null);
    
    alert(`Sincronización finalizada.\n\n- Estudiantes coincidentes: ${matchedCount} de ${students.length}.\n- Revisa las notas resaltadas en amarillo y haz clic en 'Guardar' para confirmarlas.`);
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
      const deletedTask = tasks.find(t => t.id === taskId);
      const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet/columns?taskId=${taskId}`, { method: "DELETE" });
      if (res.ok) {
        if (deletedTask?.type === "FINAL" && finalTasks.length <= 1) {
          // Reset final exam weight to 0% and restore default weights
          await fetch("/api/docente/cursos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: courseId,
              saberPercent: 30,
              hacerPercent: 50,
              serPercent: 20,
              finalPercent: 0,
            })
          });
          setSaberPct(30);
          setHacerPct(50);
          setSerPct(20);
          setFinalPct(0);
          setPctForm({ saber: 30, hacer: 50, ser: 20, final: 0 });
        }
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

  const showFinal = finalPct > 0 || finalTasks.length > 0;
  const showAttend = attendTasks.length > 0;

  return (
    <>
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
                Se creará automáticamente para el periodo <b>{activePeriod}</b>
                {addingType !== "FINAL" && addingType !== "ATTEND" && " con fecha de entrega para hoy"}.
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

          {!showFinal && (
            <button
              onClick={async () => {
                setAddingTask(true);
                try {
                  // 1. Create Final Exam task
                  const colRes = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet/columns`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "Examen Final", type: "FINAL", period: activePeriod })
                  });
                  
                  if (colRes.ok) {
                    // 2. Adjust weights: Saber=25%, Hacer=40%, Ser=15%, Final=20%
                    await fetch("/api/docente/cursos", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: courseId,
                        saberPercent: 25,
                        hacerPercent: 40,
                        serPercent: 15,
                        finalPercent: 20,
                      })
                    });
                    
                    setSaberPct(25);
                    setHacerPct(40);
                    setSerPct(15);
                    setFinalPct(20);
                    setPctForm({ saber: 25, hacer: 40, ser: 15, final: 20 });
                    setReloadTrigger(prev => prev + 1);
                  }
                } catch (e) {}
                setAddingTask(false);
              }}
              disabled={addingTask}
              className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 ml-auto"
              style={{ borderColor: "#0ea5e9", color: "#0ea5e9" }}
            >
              {addingTask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Activar Examen Final
            </button>
          )}

          {!showAttend && (
            <button
              onClick={async () => {
                setAddingTask(true);
                try {
                  const res = await fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet/columns`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "Asistencia", type: "ATTEND", period: activePeriod })
                  });
                  if (res.ok) {
                    setReloadTrigger(prev => prev + 1);
                  }
                } catch (e) {}
                setAddingTask(false);
              }}
              disabled={addingTask}
              className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 ml-2"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              {addingTask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Activar Asistencia
            </button>
          )}

          {/* Excel Sync Controls */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-1 ml-auto">
            <button 
              onClick={exportToExcelSync} 
              type="button"
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-900 px-2.5 py-1.5 rounded-md flex items-center gap-1"
              title="Descargar planilla limpia con códigos ocultos para calificar en Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 animate-pulse"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Descargar Sincro
            </button>
            <label 
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-900 px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              title="Cargar archivo Excel para sincronizar las notas con la plataforma"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Cargar Sincro
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

          {pctSuccess && (
            <span className="flex items-center gap-1 text-green-700 font-bold ml-2">
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

                {/* Final Exam Header - conditional */}
                {showFinal && (
                  <th colSpan={Math.max(1, finalTasks.length)} className="p-2 border-r border-gray-200 bg-sky-50 text-sky-800 uppercase tracking-wide">
                    <div className="flex items-center justify-center gap-1.5">
                      {finalPct > 0 ? `Examen Final (${finalPct}%)` : "Examen Final"}
                      <button onClick={() => openAddModal("FINAL")} className="p-1 hover:bg-sky-200 bg-sky-100 rounded text-sky-700 transition-colors" title="Agregar examen final">
                        <Plus size={14} />
                      </button>
                    </div>
                  </th>
                )}

                {/* Asistencia Header - conditional */}
                {showAttend && (
                  <th colSpan={Math.max(1, attendTasks.length)} className="p-2 border-r border-gray-200 bg-green-50 text-green-800 uppercase tracking-wide">
                    <div className="flex items-center justify-center gap-1.5">
                      Asistencia
                      <button onClick={() => openAddModal("ATTEND")} className="p-1 hover:bg-green-200 bg-green-100 rounded text-green-700 transition-colors" title="Agregar columna de asistencia">
                        <Plus size={14} />
                      </button>
                    </div>
                  </th>
                )}

                {/* Averages DEF Header */}
                <th colSpan={showFinal ? 4 : 3} className="p-2 border-r border-gray-200 bg-blue-50 text-blue-800 uppercase tracking-wide">
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

                {/* Final numbering - conditional */}
                {showFinal && (
                  finalTasks.length === 0 ? (
                    <th className="p-2 border-r border-gray-200 text-gray-400 font-normal italic">-</th>
                  ) : (
                    finalTasks.map(t => (
                      <th key={t.id} className="p-2 border-r border-gray-200 w-12 hover:bg-sky-100" title={t.title}>
                        {taskNumbers[t.id]}
                      </th>
                    ))
                  )
                )}

                {/* Attend numbering - conditional */}
                {showAttend && (
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
                {showFinal && <th className="p-2 border-r border-gray-200 bg-blue-50/50 w-16">Final×{finalPct}%</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={2 + Math.max(1, saberTasks.length) + Math.max(1, hacerTasks.length) + Math.max(1, serTasks.length) + (showFinal ? Math.max(1, finalTasks.length) : 0) + (showAttend ? attendTasks.length : 0) + (showFinal ? 4 : 3) + 2} className="p-8 text-center text-gray-400 font-medium italic">
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

                      {/* Final Exam input cells - conditional */}
                      {showFinal && (
                        finalTasks.length === 0 ? (
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
                        )
                      )}

                      {/* Asistencia input cells - conditional */}
                      {showAttend && (
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
                      {showFinal && (
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

      {/* ── Custom Excel Sync Mapping Modal ── */}
      {customExcelData && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-extrabold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  📤 Importar desde Excel Local
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Indica cuál columna tiene los nombres y asocia cada actividad de la plataforma con la columna de tu Excel.
                </p>
              </div>
              <button
                onClick={() => setCustomExcelData(null)}
                className="text-gray-400 hover:text-red-500 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">

              {/* Header Row Selector */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                <label className="font-extrabold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  📌 ¿En qué fila están los encabezados (nombres de las columnas)?
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Si tu Excel tiene filas de título o vacías al inicio, selecciona la fila que tiene los nombres de las columnas (ej: Nombres, Notas, Tareas).
                </p>
                <select
                  value={customExcelData.headerIndex}
                  onChange={(e) => handleHeaderRowChange(parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1 border-slate-200 dark:border-slate-700"
                  style={{ color: "var(--text-primary)" }}
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

              {/* Step 1: Student name column */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                <label className="font-extrabold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  1. Columna de Nombres de Estudiantes
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  ¿Cuál columna de tu Excel contiene los nombres completos de los alumnos?
                </p>
                <select
                  value={excelStudentCol}
                  onChange={(e) => setExcelStudentCol(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1 border-slate-200 dark:border-slate-700"
                  style={{ color: "var(--text-primary)" }}
                >
                  <option value="">-- Selecciona una columna --</option>
                  {customExcelData.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Task Mappings */}
              <div className="flex flex-col gap-2">
                <label className="font-extrabold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  2. Asociar Actividades
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  Para cada actividad de la plataforma, selecciona la columna correspondiente de tu Excel. Deja en blanco las que no quieras importar.
                </p>

                <div className="border rounded-xl overflow-hidden border-gray-200 dark:border-gray-700">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300">
                        <th className="p-3">Actividad en la Plataforma</th>
                        <th className="p-3">Columna en tu Excel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {[...saberTasks, ...hacerTasks, ...serTasks, ...finalTasks, ...attendTasks].map(t => {
                        const category = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "FINAL" : "ASISTENCIA";
                        const bgClass = t.type === "EXAM" ? "bg-purple-100 text-purple-800" : t.type === "TASK" ? "bg-orange-100 text-orange-800" : t.type === "SER" ? "bg-yellow-100 text-yellow-800" : t.type === "FINAL" ? "bg-sky-100 text-sky-800" : "bg-green-100 text-green-800";
                        return (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                            <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black mr-2 uppercase ${bgClass}`}>
                                {category} {taskNumbers[t.id]}
                              </span>
                              {t.title}
                            </td>
                            <td className="p-2 w-64">
                              <select
                                value={excelTaskMappings[t.id] || ""}
                                onChange={(e) => setExcelTaskMappings(prev => ({ ...prev, [t.id]: e.target.value }))}
                                className="w-full p-2 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold border-gray-200 dark:border-gray-700"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <option value="">-- No importar --</option>
                                {customExcelData.headers.map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <button
                type="button"
                onClick={() => setCustomExcelData(null)}
                className="btn btn-secondary text-xs py-2 px-4"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCustomExcelSync}
                disabled={!excelStudentCol}
                className="btn btn-primary text-xs py-2 px-6 font-bold"
                style={{ background: "#f97316", borderColor: "#ea580c" }}
              >
                Sincronizar Calificaciones
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
