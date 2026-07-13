"use client";

import {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, Save, Loader2, Check, AlertTriangle,
  FileSpreadsheet, Info, Users,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────── */
interface Task {
  id: string;
  title: string;
  type: string;
  submissions?: { studentId: string; grade: number | null }[];
}

interface Student {
  id: string;
  name: string;
  groupName?: string;
  groupId?: string;
}

interface Group {
  id: string;
  name: string;
}

interface PlanillaVisorEditorProps {
  courseId: string;
  activePeriod: string;
}

/* ─────────────────────────────────────────────────────────────────
   CellInput — local state prevents parent re-renders while typing.
   Only commits value to parent on blur or Enter key.
───────────────────────────────────────────────────────────────── */
interface CellInputProps {
  initialValue: string;
  rowIndex: number;
  colIndex: number;
  isHeader: boolean;
  isNum: boolean;
  isLow: boolean;
  width: number;
  onCommit: (ri: number, ci: number, value: string) => void;
}

const CellInput = memo(function CellInput({
  initialValue, rowIndex, colIndex, isHeader, isNum, isLow, width, onCommit,
}: CellInputProps) {
  const [val, setVal] = useState(initialValue);

  // Sync when parent rebuilds rows (e.g. after save response)
  useEffect(() => { setVal(initialValue); }, [initialValue]);

  const commit = useCallback(() => {
    if (val !== initialValue) onCommit(rowIndex, colIndex, val);
  }, [val, initialValue, rowIndex, colIndex, onCommit]);

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); }
      }}
      className={[
        "w-full h-full px-2 py-1 bg-transparent outline-none",
        "focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:ring-inset transition-colors",
        isHeader ? "font-bold text-gray-700" : "text-gray-800",
        isNum    ? "text-right font-mono"    : "",
        isLow    ? "text-red-600 font-bold"  : "",
      ].join(" ")}
      style={{ minWidth: `${width}px` }}
    />
  );
});

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
const CAT_LABEL: Record<string, string> = {
  EXAM: "SABER", TASK: "HACER", SER: "SER", FINAL: "EXAMEN FINAL",
};

function typeLabel(type: string) { return CAT_LABEL[type] ?? type; }

function buildRows(students: Student[], tasks: Task[]): any[][] {
  let n = 1;
  const nums: Record<string, number> = {};
  tasks.forEach(t => { nums[t.id] = n++; });

  const row0 = ["STUDENT_ID", "STUDENT_NAME", "GROUP", ...tasks.map(t => t.id)];
  const row1 = ["ID", "Nombre Completo", "Grupo", ...tasks.map(t => `${typeLabel(t.type)} ${nums[t.id]} - ${t.title}`)];

  const dataRows = students.map(s => {
    const cells: any[] = [s.id, s.name, s.groupName ?? ""];
    tasks.forEach(t => {
      const sub = t.submissions?.find(x => x.studentId === s.id);
      cells.push(sub?.grade != null ? sub.grade.toFixed(1) : "");
    });
    return cells;
  });

  return [row0, row1, ...dataRows];
}

/** Merge saved rows with current students/tasks — adds new students/tasks,
 *  removes deleted ones, preserves existing grades. */
function syncRows(saved: any[][], students: Student[], tasks: Task[]): any[][] {
  if (!saved?.length || saved[0][0] !== "STUDENT_ID") return saved;

  let n = 1;
  const nums: Record<string, number> = {};
  tasks.forEach(t => { nums[t.id] = n++; });

  const savedIds  = (saved[0] as string[]).slice(3);
  const keptIds   = savedIds.filter(id => tasks.some(t => t.id === id));
  const addedTasks = tasks.filter(t => !savedIds.includes(t.id));

  const row0 = ["STUDENT_ID", "STUDENT_NAME", "GROUP", ...keptIds, ...addedTasks.map(t => t.id)];
  const row1 = [
    "ID", "Nombre Completo", "Grupo",
    ...keptIds.map(id => { const t = tasks.find(t => t.id === id)!; return `${typeLabel(t.type)} ${nums[t.id]} - ${t.title}`; }),
    ...addedTasks.map(t => `${typeLabel(t.type)} ${nums[t.id]} - ${t.title}`),
  ];

  const savedMap = new Map<string, any[]>();
  for (let r = 2; r < saved.length; r++) {
    if (saved[r]?.[0]) savedMap.set(String(saved[r][0]), saved[r]);
  }

  const dataRows = students.map(s => {
    const cells: any[] = [s.id, s.name, s.groupName ?? ""];
    const savedRow = savedMap.get(s.id);

    keptIds.forEach(id => {
      const ci = savedIds.indexOf(id) + 3;
      if (savedRow?.[ci] !== undefined) cells.push(savedRow[ci]);
      else {
        const t = tasks.find(t => t.id === id)!;
        const sub = t.submissions?.find(x => x.studentId === s.id);
        cells.push(sub?.grade != null ? sub.grade.toFixed(1) : "");
      }
    });

    addedTasks.forEach(t => {
      const sub = t.submissions?.find(x => x.studentId === s.id);
      cells.push(sub?.grade != null ? sub.grade.toFixed(1) : "");
    });

    return cells;
  });

  return [row0, row1, ...dataRows];
}

function calcColWidths(rows: any[][]): number[] {
  if (!rows.length) return [];
  const maxCols = Math.max(...rows.map(r => (r ?? []).length));
  return Array.from({ length: maxCols }, (_, ci) => {
    let max = 6;
    for (const row of rows) {
      const len = row?.[ci] != null ? String(row[ci]).length : 0;
      if (len > max) max = len;
    }
    return Math.min(Math.max(max * 8 + 16, 48), 220);
  });
}

function isHeaderRow(cells: any[]): boolean {
  return cells.some(c => {
    const v = String(c ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return v.includes("saber") || v.includes("hacer") || v === "ser" || v.includes("nombre");
  });
}

/* ─────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────── */
export default function PlanillaVisorEditor({ courseId, activePeriod }: PlanillaVisorEditorProps) {
  const [groups,       setGroups]       = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [rows,         setRows]         = useState<any[][]>([]);
  const [colWidths,    setColWidths]    = useState<number[]>([]);
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [students,     setStudents]     = useState<Student[]>([]);
  const [fileName,     setFileName]     = useState("");
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saveStatus,   setSaveStatus]   = useState<"idle"|"success"|"error">("idle");
  const [saveMsg,      setSaveMsg]      = useState("");
  const [dragging,     setDragging]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Load data (period OR group changes) ──────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setRows([]);
      setSaveStatus("idle");
      try {
        const qp = new URLSearchParams({ period: activePeriod, groupId: selectedGroup });
        const [planRes, spreadRes] = await Promise.all([
          fetch(`/api/docente/cursos/${courseId}/planilla?${qp}`),
          fetch(`/api/docente/cursos/${courseId}/grades/spreadsheet?${qp}`),
        ]);
        if (cancelled) return;

        const planJson   = await planRes.json();
        const spreadJson = spreadRes.ok ? await spreadRes.json() : {};

        const rawTasks: Task[]     = spreadJson.tasks    ?? [];
        const rawStudents: Student[] = spreadJson.students ?? [];
        const rawGroups: Group[]   = spreadJson.groups   ?? [];

        if (!cancelled) {
          setTasks(rawTasks);
          setStudents(rawStudents);
          if (rawGroups.length > 0) setGroups(rawGroups);

          let finalRows: any[][];
          if (planJson.data?.rows?.length > 1) {
            finalRows = syncRows(planJson.data.rows, rawStudents, rawTasks);
            setFileName(planJson.data.fileName || "planilla guardada");
          } else if (rawStudents.length > 0) {
            finalRows = buildRows(rawStudents, rawTasks);
            setFileName(`Planilla_${activePeriod}.xlsx`);
          } else {
            finalRows = [];
          }
          setRows(finalRows);
          setColWidths(calcColWidths(finalRows));
        }
      } catch (e) {
        console.error("Error loading planilla:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [courseId, activePeriod, selectedGroup]);

  /* ── Cell commit ──────────────────────────────────────────────── */
  const handleCellCommit = useCallback((ri: number, ci: number, value: string) => {
    setRows(prev => {
      const next = prev.map(r => [...r]);
      if (!next[ri]) next[ri] = [];
      next[ri][ci] = value;
      return next;
    });
    setSaveStatus("idle");
  }, []);

  /* ── Add column ───────────────────────────────────────────────── */
  const addColumn = useCallback((type: "EXAM" | "TASK" | "SER") => {
    setRows(prev => {
      if (prev.length < 2) return prev;
      const next = prev.map(r => [...r]);
      const tempId = `NEW_${type}_${Date.now()}`;

      const existingCount = (next[0] as string[]).slice(3).filter(id => {
        if (id.startsWith(`NEW_${type}_`)) return true;
        return tasks.find(t => t.id === id)?.type === type;
      }).length;

      next[0] = [...next[0], tempId];
      next[1] = [...next[1], `${typeLabel(type)} ${existingCount + 1} - Nueva Actividad`];
      for (let ri = 2; ri < next.length; ri++) next[ri] = [...next[ri], ""];
      return next;
    });
    setSaveStatus("idle");
  }, [tasks]);

  /* ── Parse Excel upload ───────────────────────────────────────── */
  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const trimmed = parsed.filter((row, i) =>
          i < 3 || (row as any[]).some(c => c !== "" && c != null)
        );
        setRows(trimmed);
        setFileName(file.name);
        setColWidths(calcColWidths(trimmed));
        setSaveStatus("idle");
      } catch {
        alert("Error al leer el archivo. Asegúrate de que sea .xlsx o .xls válido.");
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
    if (file && /\.(xlsx|xls)$/i.test(file.name)) parseExcel(file);
    else alert("Por favor sube un archivo Excel (.xlsx o .xls)");
  };

  /* ── Save ─────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!rows.length) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/planilla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: activePeriod, groupId: selectedGroup, rows, fileName }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSaveStatus("success");
        setSaveMsg(`✓ Guardado. ${json.saved} nota(s) actualizadas, ${json.cleared} eliminadas.`);
        if (json.updatedRows) {
          setRows(json.updatedRows);
          setColWidths(calcColWidths(json.updatedRows));
        }
        setTimeout(() => setSaveStatus("idle"), 6000);
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

  /* ── Download ─────────────────────────────────────────────────── */
  const handleDownload = () => {
    if (!rows.length) return;
    // Skip hidden ID row for export; show human-readable titles only
    const exportRows = rows[0]?.[0] === "STUDENT_ID" ? rows.slice(1) : rows;
    const ws = XLSX.utils.aoa_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planilla");
    const groupLabel = selectedGroup === "all" ? "todos" : (groups.find(g => g.id === selectedGroup)?.name ?? selectedGroup);
    XLSX.writeFile(wb, `Planilla_${activePeriod}_${groupLabel}.xlsx`);
  };

  /* ── Derived values ───────────────────────────────────────────── */
  const maxCols = useMemo(
    () => (rows.length ? Math.max(...rows.map(r => (r ?? []).length)) : 0),
    [rows]
  );
  const isPlatformFormat = rows.length > 0 && rows[0]?.[0] === "STUDENT_ID";
  const hasMultipleGroups = groups.length > 1;

  /* ── Render ───────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <Loader2 className="animate-spin text-[#f98012]" size={36} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* ── Group selector ──────────────────────────────────────── */}
      {hasMultipleGroups && (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <Users size={16} className="text-[#f98012] shrink-0" />
          <span className="text-sm font-bold text-gray-700 shrink-0">Grupo:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedGroup("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedGroup === "all"
                  ? "bg-[#f98012] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos los grupos
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedGroup === g.id
                    ? "bg-[#f98012] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">

        <label className="flex items-center gap-2 cursor-pointer bg-[#f98012] hover:bg-[#e06d09] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">
          <Upload size={15} />
          {rows.length > 0 ? "Reemplazar planilla" : "Subir planilla (.xlsx)"}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        </label>

        {rows.length > 0 && (
          <>
            {isPlatformFormat && (
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                <button onClick={() => addColumn("EXAM")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 transition-colors">
                  + Cognitivo (Saber)
                </button>
                <button onClick={() => addColumn("TASK")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 transition-colors">
                  + Procedimental (Hacer)
                </button>
                <button onClick={() => addColumn("SER")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-200 transition-colors">
                  + Actitudinal (Ser)
                </button>
              </div>
            )}

            <button onClick={handleDownload}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 transition-colors">
              <Download size={15} />
              Descargar .xlsx
            </button>

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm ml-auto">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Guardando…" : "Guardar y sincronizar notas"}
            </button>
          </>
        )}
      </div>

      {/* ── Status ──────────────────────────────────────────────── */}
      {saveStatus === "success" && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-semibold">
          <Check size={16} />{saveMsg}
        </div>
      )}
      {saveStatus === "error" && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm font-semibold">
          <AlertTriangle size={16} />{saveMsg}
        </div>
      )}

      {/* ── Tip ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs">
        <span className="text-2xl leading-none">💡</span>
        <div className="flex flex-col gap-1 text-amber-800">
          <p className="font-bold text-sm">¿Sin internet? No hay problema</p>
          <p><strong>1.</strong> Descarga la planilla con <strong>"Descargar .xlsx"</strong> y edítala en Excel sin conexión.</p>
          <p><strong>2.</strong> Con internet, usa <strong>"Reemplazar planilla"</strong>, sube el archivo editado y presiona <strong>"Guardar y sincronizar"</strong>.</p>
        </div>
      </div>

      {/* ── Drop zone (empty state) ──────────────────────────────── */}
      {rows.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl py-24 cursor-pointer transition-all
            ${dragging ? "border-[#f98012] bg-orange-50 scale-[1.01]" : "border-gray-300 hover:border-[#f98012] hover:bg-orange-50/40 bg-gray-50"}`}
        >
          <div className="p-5 rounded-full bg-orange-100">
            <FileSpreadsheet size={40} className="text-[#f98012]" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-700">
              {dragging ? "Suelta el archivo aquí" : "Arrastra tu planilla Excel aquí"}
            </p>
            <p className="text-sm text-gray-400 mt-1">o haz clic para buscar</p>
            <p className="text-xs text-gray-300 mt-2">Formatos: .xlsx, .xls</p>
          </div>
        </div>
      ) : (
        /* ── Spreadsheet grid ─────────────────────────────────── */
        <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
            <FileSpreadsheet size={13} className="text-green-600" />
            <span>{fileName}</span>
            {hasMultipleGroups && selectedGroup !== "all" && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">
                {groups.find(g => g.id === selectedGroup)?.name}
              </span>
            )}
            <span className="ml-auto text-gray-300">{rows.length} filas × {maxCols} columnas</span>
          </div>

          <div className="overflow-auto max-h-[70vh]">
            <table className="border-collapse text-xs" style={{ minWidth: "100%" }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-gray-400 font-bold text-center w-8 min-w-[2rem]">#</th>
                  {Array.from({ length: maxCols }, (_, ci) => (
                    <th key={ci}
                      className="border border-gray-200 bg-gray-100 px-2 py-1 text-gray-500 font-bold text-center select-none"
                      style={{ minWidth: `${colWidths[ci] || 80}px` }}>
                      {ci < 26
                        ? String.fromCharCode(65 + ci)
                        : String.fromCharCode(64 + Math.floor(ci / 26)) + String.fromCharCode(65 + (ci % 26))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const cells = Array.isArray(row) ? row : [];
                  const isHeader = isHeaderRow(cells);

                  return (
                    <tr key={ri} className={
                      isHeader
                        ? "bg-orange-50 sticky top-[29px] z-[5]"
                        : ri % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                    }>
                      <td className="border border-gray-200 px-2 py-0.5 text-gray-300 font-semibold text-center select-none bg-gray-50">
                        {ri + 1}
                      </td>
                      {Array.from({ length: maxCols }, (_, ci) => {
                        const val    = cells[ci];
                        const strVal = val != null ? String(val) : "";
                        const numVal = strVal !== "" ? parseFloat(strVal) : NaN;
                        const isNum  = !isNaN(numVal);
                        const isLow  = isNum && numVal >= 1 && numVal <= 5 && numVal < 3.0;

                        return (
                          <td key={ci} className={`border border-gray-200 p-0 ${isLow ? "bg-red-50/60" : ""}`}>
                            <CellInput
                              initialValue={strVal}
                              rowIndex={ri}
                              colIndex={ci}
                              isHeader={isHeader}
                              isNum={isNum}
                              isLow={isLow}
                              width={colWidths[ci] || 80}
                              onCommit={handleCellCommit}
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

      {/* ── Instructions ────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex flex-col gap-1.5">
          <p className="font-bold flex items-center gap-1"><Info size={12} /> ¿Cómo funciona?</p>
          <p>1. <strong>Edita</strong> cualquier celda haciendo clic. Los cambios se aplican al salir de la celda o presionar Enter.</p>
          <p>2. Presiona <strong>"Guardar y sincronizar notas"</strong> — las notas quedan registradas automáticamente en el sistema.</p>
          {isPlatformFormat && (
            <p>3. Usa <strong>"+ Cognitivo / + Procedimental / + Actitudinal"</strong> para crear nuevas evaluaciones directamente en la planilla.</p>
          )}
          <p>{isPlatformFormat ? "4." : "3."} <strong>"Descargar .xlsx"</strong> exporta la planilla actualizada a tu computador.</p>
          {hasMultipleGroups && (
            <p className="text-blue-600 font-semibold">
              ✓ Cada grupo tiene su propia planilla independiente. Selecciona el grupo arriba para cambiar de planilla.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
