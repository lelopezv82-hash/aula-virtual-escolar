"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, Save, Loader2, Check, AlertTriangle,
  FileSpreadsheet, RefreshCw, X, Info
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  type: string;
}

interface Student {
  id: string;
  name: string;
}

interface PlanillaVisorEditorProps {
  courseId: string;
  activePeriod: string;
}

// Normalize string: lowercase, no accents, collapsed spaces
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export default function PlanillaVisorEditor({ courseId, activePeriod }: PlanillaVisorEditorProps) {
  const [rows, setRows] = useState<any[][]>([]);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [mappingInfo, setMappingInfo] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load saved planilla from server ────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [planRes, spreadRes] = await Promise.all([
          fetch(`/api/docente/cursos/${courseId}/planilla?period=${encodeURIComponent(activePeriod)}`),
          fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet?period=${encodeURIComponent(activePeriod)}`)
        ]);
        const planJson = await planRes.json();
        const spreadJson = spreadRes.ok ? await spreadRes.json() : {};

        const rawTasks = spreadJson.tasks || [];
        const rawStudents = spreadJson.students || [];

        setTasks(rawTasks);
        setStudents(rawStudents);

        if (planJson.data?.rows && planJson.data.rows.length > 0) {
          let reconciledRows = planJson.data.rows.map((r: any) => [...r]);

          // Reconciliar si es el formato de la plataforma
          if (reconciledRows[0] && reconciledRows[0][0] === "STUDENT_ID") {
            const savedTaskIds = reconciledRows[0].slice(3);
            const activeTasks = [...rawTasks];

            // 1. Eliminar columnas de tareas que fueron borradas en el Directorio
            const taskIdsToRemove: string[] = [];
            for (let i = savedTaskIds.length - 1; i >= 0; i--) {
              const tid = savedTaskIds[i];
              if (tid && !activeTasks.some(t => t.id === tid)) {
                const colIdx = i + 3;
                reconciledRows = reconciledRows.map((row: any[]) => {
                  const copy = [...row];
                  copy.splice(colIdx, 1);
                  return copy;
                });
                savedTaskIds.splice(i, 1);
              }
            }

            // 2. Agregar columnas de nuevas tareas creadas en el Directorio
            activeTasks.forEach((t: any, index) => {
              if (!savedTaskIds.includes(t.id)) {
                reconciledRows[0].push(t.id);
                const cat = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
                reconciledRows[1].push(`${cat} ${index + 1} - ${t.title}`);

                for (let ri = 2; ri < reconciledRows.length; ri++) {
                  const studentId = reconciledRows[ri][0];
                  const sub = t.submissions?.find((s: any) => s.studentId === studentId);
                  reconciledRows[ri].push((sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade.toFixed(1) : "");
                }
                savedTaskIds.push(t.id);
              } else {
                // Tarea existente: actualizar título por si cambió en el Directorio
                const colIdx = savedTaskIds.indexOf(t.id) + 3;
                const cat = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
                if (reconciledRows[1][colIdx]) {
                  reconciledRows[1][colIdx] = `${cat} ${index + 1} - ${t.title}`;
                }
              }
            });

            // 3. Sincronizar alumnos (agregar nuevos o quitar retirados)
            for (let ri = reconciledRows.length - 1; ri >= 2; ri--) {
              const sid = reconciledRows[ri][0];
              if (sid && !rawStudents.some((s: any) => s.id === sid)) {
                reconciledRows.splice(ri, 1);
              }
            }

            rawStudents.forEach((student: any) => {
              const sid = student.id;
              const idx = reconciledRows.slice(2).findIndex((r: any[]) => r[0] === sid);
              if (idx === -1) {
                const newRow: any[] = [student.id, student.name, student.groupName || ""];
                savedTaskIds.forEach((tid: string) => {
                  const t = activeTasks.find(at => at.id === tid);
                  const sub = t?.submissions?.find((s: any) => s.studentId === sid);
                  newRow.push((sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade.toFixed(1) : "");
                });
                reconciledRows.push(newRow);
              } else {
                const rowIdx = idx + 2;
                reconciledRows[rowIdx][1] = student.name;
                reconciledRows[rowIdx][2] = student.groupName || "";
              }
            });
          }

          setRows(reconciledRows);
          setFileName(planJson.data.fileName || "planilla guardada");
          autoColWidths(reconciledRows);
        } else if (rawStudents.length > 0) {
          // Genera la planilla automáticamente a partir de los datos existentes
          const activeTasks = [...rawTasks];
          let counter = 1;
          const taskNumbers: Record<string, number> = {};
          activeTasks.forEach((t: any) => { taskNumbers[t.id] = counter++; });

          const row1 = ["STUDENT_ID", "STUDENT_NAME", "GROUP", ...activeTasks.map((t: any) => t.id)];
          const row2 = ["ID Estudiante", "Nombre Completo", "Grupo", ...activeTasks.map((t: any) => {
            const cat = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
            return `${cat} ${taskNumbers[t.id]} - ${t.title}`;
          })];

          const generatedRows: any[][] = [row1, row2];
          rawStudents.forEach((student: any) => {
            const row: any[] = [student.id, student.name, student.groupName || ""];
            activeTasks.forEach((t: any) => {
              const sub = t.submissions?.find((s: any) => s.studentId === student.id);
              row.push((sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade.toFixed(1) : "");
            });
            generatedRows.push(row);
          });

          setRows(generatedRows);
          setFileName(`Planilla_${activePeriod}.xlsx`);
          autoColWidths(generatedRows);
        }
      } catch (e) {
        console.error("Error loading planilla:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, activePeriod]);

  const autoColWidths = (r: any[][]) => {
    if (!r || r.length === 0) return;
    const maxCols = Math.max(...r.map(row => (row || []).length));
    const widths = Array.from({ length: maxCols }, (_, ci) => {
      let max = 6;
      for (const row of r) {
        const cell = row?.[ci];
        const len = cell !== null && cell !== undefined ? String(cell).length : 0;
        if (len > max) max = len;
      }
      return Math.min(Math.max(max * 8 + 16, 48), 220);
    });
    setColWidths(widths);
  };

  // ── Parse uploaded Excel file ───────────────────────────────────────────
  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const trimmed = parsed.filter((row, i) => {
          if (i < 3) return true;
          return (row as any[]).some(c => c !== "" && c !== null && c !== undefined);
        });
        setRows(trimmed);
        setFileName(file.name);
        autoColWidths(trimmed);
        setSaveStatus("idle");
      } catch (err) {
        alert("Error al leer el archivo Excel. Asegúrate de que sea un archivo .xlsx o .xls válido.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseExcel(file);
    } else {
      alert("Por favor sube un archivo Excel (.xlsx o .xls)");
    }
  };

  // ── Edit a cell ─────────────────────────────────────────────────────────
  const handleCellChange = (ri: number, ci: number, value: string) => {
    setRows(prev => {
      const next = prev.map(r => [...r]);
      if (!next[ri]) next[ri] = [];
      next[ri][ci] = value;
      return next;
    });
    setSaveStatus("idle");
  };

  // ── Extract grades from planilla rows ───────────────────────────────────
  const extractGrades = (): Array<{ studentId: string; taskId: string; grade: number | null }> => {
    if (rows.length === 0 || tasks.length === 0 || students.length === 0) return [];

    const result: Array<{ studentId: string; taskId: string; grade: number | null }> = [];

    // Formato de plataforma (ID directo)
    if (rows[0] && rows[0][0] === "STUDENT_ID") {
      const taskIds = rows[0].slice(3);
      const studentIdCol = 0;

      for (let ri = 2; ri < rows.length; ri++) {
        const row = rows[ri] || [];
        const studentId = row[studentIdCol];
        if (!studentId || !students.some(s => s.id === studentId)) continue;

        taskIds.forEach((taskId, index) => {
          if (!taskId) return;
          const colIndex = index + 3;
          const gradeVal = row[colIndex];

          let grade: number | null = null;
          if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
            const n = parseFloat(String(gradeVal).replace(",", "."));
            if (!isNaN(n) && n >= 1.0 && n <= 5.0) {
              grade = parseFloat(n.toFixed(1));
            }
          }
          result.push({ studentId, taskId, grade });
        });
      }
      setMappingInfo("Formato de la plataforma detectado (mapeo directo por IDs)");
      return result;
    }

    // Formato de plantilla institucional (coincidencia de nombres)
    const saberTasks = tasks.filter(t => t.type === "EXAM");
    const hacerTasks = tasks.filter(t => t.type === "TASK");
    const serTasks = tasks.filter(t => t.type === "SER");

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r] || [];
      const rowStr = row.map(c => norm(String(c || ""))).join(" ");
      if (rowStr.includes("nombre") || rowStr.includes("saber") || rowStr.includes("hacer")) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) return [];

    const headerRow = rows[headerRowIdx] || [];
    let nameCol = -1;
    let saberStart = -1, hacerStart = -1, serStart = -1;

    for (let ci = 0; ci < headerRow.length; ci++) {
      const h = norm(String(headerRow[ci] || ""));
      if (nameCol === -1 && (h.includes("nombre") || h.includes("estudiante"))) nameCol = ci;
      if (saberStart === -1 && h.includes("saber")) saberStart = ci;
      if (hacerStart === -1 && h.includes("hacer")) hacerStart = ci;
      if (serStart === -1 && (h === "ser" || h.startsWith("ser "))) serStart = ci;
    }

    if (nameCol === -1) return [];

    if (headerRowIdx > 0) {
      const prevRow = rows[headerRowIdx - 1] || [];
      for (let ci = 0; ci < prevRow.length; ci++) {
        const h = norm(String(prevRow[ci] || ""));
        if (saberStart === -1 && h.includes("saber")) saberStart = ci;
        if (hacerStart === -1 && h.includes("hacer")) hacerStart = ci;
        if (serStart === -1 && (h === "ser" || h.startsWith("ser "))) serStart = ci;
      }
    }

    const info: string[] = [];
    if (saberStart !== -1) info.push(`Saber: col ${saberStart + 1}`);
    if (hacerStart !== -1) info.push(`Hacer: col ${hacerStart + 1}`);
    if (serStart !== -1) info.push(`Ser: col ${serStart + 1}`);
    setMappingInfo(info.join(" | ") || "No se detectaron columnas de notas");

    for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
      const row = rows[ri] || [];
      const cellName = norm(String(row[nameCol] || ""));
      if (!cellName) continue;

      const student = students.find(s => {
        const sn = norm(s.name);
        return sn === cellName || sn.includes(cellName) || cellName.includes(sn);
      });
      if (!student) continue;

      const readGrade = (col: number): number | null => {
        const v = row[col];
        if (v === "" || v === null || v === undefined) return null;
        const n = parseFloat(String(v).replace(",", "."));
        return !isNaN(n) && n >= 1.0 && n <= 5.0 ? parseFloat(n.toFixed(1)) : null;
      };

      if (saberStart !== -1) {
        saberTasks.forEach((t, j) => {
          result.push({ studentId: student.id, taskId: t.id, grade: readGrade(saberStart + j) });
        });
      }
      if (hacerStart !== -1) {
        hacerTasks.forEach((t, j) => {
          result.push({ studentId: student.id, taskId: t.id, grade: readGrade(hacerStart + j) });
        });
      }
      if (serStart !== -1) {
        serTasks.forEach((t, j) => {
          result.push({ studentId: student.id, taskId: t.id, grade: readGrade(serStart + j) });
        });
      }
    }

    return result;
  };

  // ── Save planilla + sync grades ─────────────────────────────────────────
  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    setSaveStatus("idle");

    const gradeSubmissions = extractGrades();

    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/planilla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: activePeriod,
          rows,
          fileName,
          gradeSubmissions
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSaveStatus("success");
        setSaveMsg(`✓ Planilla guardada. ${json.saved} notas actualizadas, ${json.cleared} eliminadas.`);
        setTimeout(() => setSaveStatus("idle"), 5000);
      } else {
        setSaveStatus("error");
        setSaveMsg(json.error || "Error al guardar");
      }
    } catch {
      setSaveStatus("error");
      setSaveMsg("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // ── Download current rows as .xlsx ──────────────────────────────────────
  const handleDownload = () => {
    if (rows.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planilla");
    const outName = fileName
      ? fileName.replace(/\.(xlsx|xls)$/i, "") + "_editada.xlsx"
      : `Planilla_${activePeriod}.xlsx`;
    XLSX.writeFile(wb, outName);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-[#f98012]" size={36} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">

        {/* Upload button */}
        <label className="flex items-center gap-2 cursor-pointer bg-[#f98012] hover:bg-[#e06d09] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">
          <Upload size={15} />
          {rows.length > 0 ? "Reemplazar planilla" : "Subir planilla (.xlsx)"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>

        {rows.length > 0 && (
          <>
            {/* Download */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-gray-200"
            >
              <Download size={15} />
              Descargar .xlsx
            </button>

            {/* Save & sync grades */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm ml-auto"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Guardando..." : "Guardar y sincronizar notas"}
            </button>
          </>
        )}
      </div>

      {/* ── Status messages ── */}
      {saveStatus === "success" && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-semibold animate-scale-in">
          <Check size={16} />
          {saveMsg}
        </div>
      )}
      {saveStatus === "error" && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm font-semibold animate-scale-in">
          <AlertTriangle size={16} />
          {saveMsg}
        </div>
      )}

      {/* ── Mapping info ── */}
      {mappingInfo && rows.length > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-2 text-xs font-semibold">
          <Info size={13} />
          Columnas detectadas: {mappingInfo}
        </div>
      )}

      {/* ── Offline workflow tip (always visible) ── */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs">
        <span className="text-2xl leading-none">💡</span>
        <div className="flex flex-col gap-1 text-amber-800">
          <p className="font-bold text-sm">¿Sin internet? No hay problema</p>
          <p>
            <strong>1.</strong> Descarga tu planilla con el botón <strong>"Descargar .xlsx"</strong> y edítala normalmente en Excel en tu computador — sin necesidad de internet.
          </p>
          <p>
            <strong>2.</strong> Cuando vuelvas a tener internet, regresa aquí, haz clic en <strong>"Reemplazar planilla"</strong>, sube el archivo que editaste y presiona <strong>"Guardar y sincronizar notas"</strong>.
          </p>
          <p className="text-amber-600 font-semibold">✓ Los cambios que hiciste sin internet quedarán registrados en la plataforma.</p>
        </div>
      </div>

      {/* ── Drop zone (when no file) ── */}
      {rows.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl py-24 cursor-pointer transition-all
            ${dragging
              ? "border-[#f98012] bg-orange-50 scale-[1.01]"
              : "border-gray-300 hover:border-[#f98012] hover:bg-orange-50/40 bg-gray-50"
            }`}
        >
          <div className="p-5 rounded-full bg-orange-100">
            <FileSpreadsheet size={40} className="text-[#f98012]" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-700">
              {dragging ? "Suelta el archivo aquí" : "Arrastra tu planilla Excel aquí"}
            </p>
            <p className="text-sm text-gray-400 mt-1">o haz clic para buscar el archivo</p>
            <p className="text-xs text-gray-300 mt-2">Formatos soportados: .xlsx, .xls</p>
          </div>
        </div>
      ) : (
        /* ── Spreadsheet grid ── */
        <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          {/* File name bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
            <FileSpreadsheet size={13} className="text-green-600" />
            <span>{fileName}</span>
            <span className="ml-auto text-gray-300">{rows.length} filas × {Math.max(...rows.map(r => r.length))} columnas</span>
          </div>

          <div className="overflow-auto max-h-[70vh]">
            <table className="border-collapse text-xs" style={{ minWidth: "100%" }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {/* Row number header */}
                  <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-gray-400 font-bold text-center w-8 min-w-[2rem]">
                    #
                  </th>
                  {/* Column letter headers */}
                  {Array.from({ length: Math.max(...rows.map(r => (r || []).length)) }, (_, ci) => (
                    <th
                      key={ci}
                      className="border border-gray-200 bg-gray-100 px-2 py-1 text-gray-500 font-bold text-center select-none"
                      style={{ minWidth: `${colWidths[ci] || 80}px` }}
                    >
                      {String.fromCharCode(65 + (ci % 26))}
                      {ci >= 26 ? String.fromCharCode(65 + Math.floor(ci / 26) - 1) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const cells = Array.isArray(row) ? row : [];
                  const maxCols = Math.max(...rows.map(r => (r || []).length));
                  // Detect if this is a header-like row
                  const isHeader = cells.some(c => {
                    const v = norm(String(c || ""));
                    return v.includes("saber") || v.includes("hacer") || v === "ser" || v.includes("nombre");
                  });

                  return (
                    <tr
                      key={ri}
                      className={isHeader
                        ? "bg-orange-50 sticky top-[29px] z-[5]"
                        : ri % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                      }
                    >
                      {/* Row number */}
                      <td className="border border-gray-200 px-2 py-0.5 text-gray-300 font-semibold text-center select-none bg-gray-50">
                        {ri + 1}
                      </td>
                      {Array.from({ length: maxCols }, (_, ci) => {
                        const val = cells[ci];
                        const strVal = val !== null && val !== undefined ? String(val) : "";
                        const isNum = strVal !== "" && !isNaN(parseFloat(strVal));
                        const numVal = isNum ? parseFloat(strVal) : null;
                        const isLowGrade = isNum && numVal !== null && numVal >= 1 && numVal <= 5 && numVal < 3.0;

                        return (
                          <td
                            key={ci}
                            className={`border border-gray-200 p-0 ${isLowGrade ? "bg-red-50/60" : ""}`}
                          >
                            <input
                              type="text"
                              value={strVal}
                              onChange={e => handleCellChange(ri, ci, e.target.value)}
                              className={`w-full h-full px-2 py-1 bg-transparent outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:ring-inset transition-colors
                                ${isHeader ? "font-bold text-gray-700" : "text-gray-800"}
                                ${isNum ? "text-right font-mono" : ""}
                                ${isLowGrade ? "text-red-600 font-bold" : ""}
                              `}
                              style={{ minWidth: `${colWidths[ci] || 80}px` }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Instructions ── */}
      {rows.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex flex-col gap-1.5">
          <p className="font-bold flex items-center gap-1"><Info size={12} /> ¿Cómo funciona?</p>
          <p>1. <strong>Edita</strong> cualquier celda directamente haciendo clic en ella dentro de la plataforma.</p>
          <p>2. Presiona <strong>"Guardar y sincronizar notas"</strong> — la plataforma detecta automáticamente las columnas SABER / HACER / SER y actualiza las calificaciones en el sistema.</p>
          <p>3. Usa <strong>"Descargar .xlsx"</strong> para bajar la versión actualizada a tu computador y seguir editando sin internet.</p>
          <p>4. Cuando vuelvas con internet, usa <strong>"Reemplazar planilla"</strong> para subir los cambios que hiciste localmente.</p>
          <p>5. La próxima vez que entres, la planilla estará guardada tal como la dejaste — no necesitas volver a subirla.</p>
        </div>
      )}
    </div>
  );
}
