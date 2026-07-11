"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Users, FileText, ClipboardList, Star, Award,
  ChevronDown, ChevronUp, AlertCircle, FileDown
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PlanillaExcelEditor from "./PlanillaExcelEditor";
import dynamic from "next/dynamic";
const PlanillaVisorEditor = dynamic(() => import("./PlanillaVisorEditor"), { ssr: false });

interface PeriodGrades {
  saber: number | null;
  hacer: number | null;
  ser: number | null;
  final: number | null;
}

interface StudentRow {
  id: string;
  name: string;
  groupName: string;
  periods: Record<string, PeriodGrades>;
}

interface GradesData {
  course: { id: string; name: string };
  periods: string[];
  students: StudentRow[];
  saberPercent?: number;
  hacerPercent?: number;
  serPercent?: number;
}

function PeriodSummaryCard({
  saber, hacer, ser, final,
  saberPct, hacerPct, serPct,
}: {
  saber: number | null; hacer: number | null; ser: number | null; final: number | null;
  saberPct: number; hacerPct: number; serPct: number;
}) {
  const saberW = saber !== null ? saber * saberPct / 100 : null;
  const hacerW = hacer !== null ? hacer * hacerPct / 100 : null;
  const serW   = ser   !== null ? ser   * serPct   / 100 : null;

  const finalColor = final !== null ? (final >= 3.0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)";
  const finalBg    = final !== null ? (final >= 3.0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.09)") : "var(--bg-secondary)";
  const finalBorder = final !== null ? (final >= 3.0 ? "2px solid var(--success)" : "2px solid var(--danger)") : "2px solid var(--border-color)";

  const componentEntry = (
    weighted: number | null,
    raw: number | null,
    pct: number,
    label: string,
    color: string,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "80px" }}>
      <div style={{ fontSize: "1.35rem", fontWeight: 900, color, lineHeight: 1 }}>
        {weighted !== null ? weighted.toFixed(2) : <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>—</span>}
      </div>
      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap" }}>
        {raw !== null ? `${raw.toFixed(1)} × ${pct}%` : "Sin calificar"}
      </div>
      <div style={{ fontSize: "0.65rem", color, fontWeight: 600, marginTop: "3px" }}>{label}</div>
    </div>
  );

  const hasAny = saberW !== null || hacerW !== null || serW !== null;

  if (!hasAny && final === null) {
    return <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.82rem" }}>Sin calificar</span>;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      flexWrap: "wrap", justifyContent: "center",
    }}>
      {componentEntry(saberW, saber, saberPct, "Saber (Cognitivo)", "#8b5cf6")}
      <span style={{ color: "var(--text-muted)", fontWeight: 300, fontSize: "1.1rem" }}>+</span>
      {componentEntry(hacerW, hacer, hacerPct, "Hacer (Procedimental)", "var(--primary-color)")}
      <span style={{ color: "var(--text-muted)", fontWeight: 300, fontSize: "1.1rem" }}>+</span>
      {componentEntry(serW, ser, serPct, "Ser (Actitudinal)", "#f59e0b")}
      <span style={{ color: "var(--text-muted)", fontWeight: 300, fontSize: "1.1rem" }}>=</span>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        background: finalBg, border: finalBorder,
        borderRadius: "0.7rem", padding: "0.35rem 0.7rem", minWidth: "60px",
      }}>
        <div style={{ fontSize: "1.35rem", fontWeight: 900, color: finalColor, lineHeight: 1 }}>
          {final !== null ? final.toFixed(1) : "—"}
        </div>
        <div style={{ fontSize: "0.6rem", color: finalColor, fontWeight: 700, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Nota Final</div>
      </div>
    </div>
  );
}

export default function CalificacionesConsolidadoPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [data, setData] = useState<GradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePeriod, setActivePeriod] = useState<string>("");
  const [sortField, setSortField] = useState<"name" | "saber" | "hacer" | "ser" | "final">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<"consolidado" | "planilla" | "mi-planilla">("mi-planilla");

  const exportToExcel = () => {
    if (!data || !activePeriod) return;
    const sp = data.saberPercent ?? 30;
    const hp = data.hacerPercent ?? 50;
    const ep = data.serPercent   ?? 20;

    const worksheetData = sortedStudents.map(student => {
      const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
      return {
        "Estudiante": student.name,
        "Grupo": student.groupName,
        [`Saber Cognitivo\n(bruto)`]: pg.saber !== null ? pg.saber : "—",
        [`Saber Ponderado\n(×${sp}%)`]: pg.saber !== null ? (pg.saber * sp / 100).toFixed(2) : "—",
        [`Hacer Procedimental\n(bruto)`]: pg.hacer !== null ? pg.hacer : "—",
        [`Hacer Ponderado\n(×${hp}%)`]: pg.hacer !== null ? (pg.hacer * hp / 100).toFixed(2) : "—",
        [`Ser Actitudinal\n(bruto)`]: pg.ser !== null ? pg.ser : "—",
        [`Ser Ponderado\n(×${ep}%)`]: pg.ser !== null ? (pg.ser * ep / 100).toFixed(2) : "—",
        "Nota Final": pg.final !== null ? pg.final.toFixed(2) : "—",
        "Fórmula": pg.saber !== null || pg.hacer !== null || pg.ser !== null
          ? [
              pg.saber !== null ? `${(pg.saber * sp / 100).toFixed(2)} (Cog×${sp}%)` : "",
              pg.hacer !== null ? `${(pg.hacer * hp / 100).toFixed(2)} (Proc×${hp}%)` : "",
              pg.ser   !== null ? `${(pg.ser   * ep / 100).toFixed(2)} (Act×${ep}%)` : "",
            ].filter(Boolean).join(" + ")
          : "—",
      };
    });

    // Promedio general row
    const avgRow: Record<string, string|number> = { "Estudiante": "PROMEDIO GENERAL", "Grupo": "" };
    (["saber","hacer","ser","final"] as const).forEach(field => {
      const vals = data.students.map(s => s.periods[activePeriod]?.[field]).filter((v): v is number => v !== null);
      const a = vals.length > 0 ? vals.reduce((x,y)=>x+y,0)/vals.length : null;
      if (field === "saber") {
        avgRow[`Saber Cognitivo\n(bruto)`]     = a !== null ? a.toFixed(1) : "—";
        avgRow[`Saber Ponderado\n(×${sp}%)`]  = a !== null ? (a * sp / 100).toFixed(2) : "—";
      } else if (field === "hacer") {
        avgRow[`Hacer Procedimental\n(bruto)`]  = a !== null ? a.toFixed(1) : "—";
        avgRow[`Hacer Ponderado\n(×${hp}%)`]   = a !== null ? (a * hp / 100).toFixed(2) : "—";
      } else if (field === "ser") {
        avgRow[`Ser Actitudinal\n(bruto)`]      = a !== null ? a.toFixed(1) : "—";
        avgRow[`Ser Ponderado\n(×${ep}%)`]     = a !== null ? (a * ep / 100).toFixed(2) : "—";
      } else {
        avgRow["Nota Final"] = a !== null ? a.toFixed(2) : "—";
      }
    });
    avgRow["Fórmula"] = `Nota = Cog×${sp}% + Proc×${hp}% + Act×${ep}%`;
    worksheetData.push(avgRow as any);
    
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activePeriod);
    XLSX.writeFile(wb, `Consolidado_${data.course.name.replace(/\s+/g, '_')}_${activePeriod}.xlsx`);
  };

  const exportToPDF = () => {
    if (!data || !activePeriod) return;
    const sp = data.saberPercent ?? 30;
    const hp = data.hacerPercent ?? 50;
    const ep = data.serPercent   ?? 20;

    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFontSize(17);
    doc.text("Consolidado de Calificaciones", 14, 18);
    doc.setFontSize(10);
    doc.text(`Curso: ${data.course.name}`, 14, 26);
    doc.text(`Periodo: ${activePeriod}`, 14, 31);
    doc.text(`Ponderación:  Cognitivo ${sp}%  |  Procedimental ${hp}%  |  Actitudinal ${ep}%`, 14, 36);
    doc.text(`Fecha de exportación: ${new Date().toLocaleDateString()}`, 14, 41);

    const tableColumn = [
      "Estudiante", "Grupo",
      `Cognitivo\n(bruto)`, `Cognitivo\n(×${sp}%)`,
      `Procedimental\n(bruto)`, `Procedimental\n(×${hp}%)`,
      `Actitudinal\n(bruto)`, `Actitudinal\n(×${ep}%)`,
      "Nota\nFinal"
    ];

    const buildRow = (
      name: string, group: string,
      saber: number|null, hacer: number|null, ser: number|null, final: number|null
    ) => [
      name, group,
      saber !== null ? saber.toFixed(1) : "—",
      saber !== null ? (saber * sp / 100).toFixed(2) : "—",
      hacer !== null ? hacer.toFixed(1) : "—",
      hacer !== null ? (hacer * hp / 100).toFixed(2) : "—",
      ser   !== null ? ser.toFixed(1)   : "—",
      ser   !== null ? (ser   * ep / 100).toFixed(2) : "—",
      final !== null ? final.toFixed(2) : "—",
    ];

    const tableRows = sortedStudents.map(student => {
      const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
      return buildRow(student.name, student.groupName, pg.saber, pg.hacer, pg.ser, pg.final);
    });

    // Promedio general row
    const avg = (field: "saber"|"hacer"|"ser"|"final") => {
      const vals = data.students.map(s => s.periods[activePeriod]?.[field]).filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    };
    tableRows.push(buildRow("PROMEDIO GENERAL", "", avg("saber"), avg("hacer"), avg("ser"), avg("final")));
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 47,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5, halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "left", cellWidth: 48 },
        1: { halign: "left", cellWidth: 22 },
        3: { fontStyle: "bold", textColor: [139, 92, 246] },   // Saber ponderado
        5: { fontStyle: "bold", textColor: [249, 128, 18] },   // Hacer ponderado
        7: { fontStyle: "bold", textColor: [245, 158, 11] },   // Ser ponderado
        8: { fontStyle: "bold", fontSize: 9 },                  // Nota Final
      },
      headStyles: { fillColor: [249, 128, 18], fontSize: 8, halign: "center", valign: "middle" },
      didParseCell: (cellData) => {
        if (cellData.row.index === tableRows.length - 1) {
          cellData.cell.styles.fontStyle = "bold";
          cellData.cell.styles.fillColor = [255, 243, 220];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 47;
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `* Nota Final = Cognitivo×${sp}% + Procedimental×${hp}% + Actitudinal×${ep}%`,
      14, finalY + 7
    );
    
    doc.save(`Consolidado_${data.course.name.replace(/\s+/g, '_')}_${activePeriod}.pdf`);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/grades`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        if (json.periods.length > 0) setActivePeriod(json.periods[0]);
      } else {
        setError(json.error || "Error al cargar datos");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(true); }
  };

  const sortedStudents = data ? [...data.students].sort((a, b) => {
    const pg = (s: StudentRow) => s.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
    let va: any, vb: any;
    if (sortField === "name") { va = a.name; vb = b.name; }
    else { va = pg(a)[sortField] ?? -1; vb = pg(b)[sortField] ?? -1; }
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  }) : [];

  const periodStats = data && activePeriod ? (() => {
    const vals = data.students.map(s => s.periods[activePeriod]?.final).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const passing = vals.filter(v => v >= 3.0).length;
    const failing = vals.filter(v => v < 3.0).length;
    return { avg, passing, failing, total: vals.length };
  })() : null;

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
      : <ChevronDown size={13} style={{ opacity: 0.3 }} />;

  if (loading) return (
    <div className="flex justify-center items-center py-32">
      <Loader2 className="animate-spin text-[#f98012]" size={44} />
    </div>
  );

  if (error) return (
    <div className="card text-center py-16 text-muted">
      <AlertCircle size={44} className="mx-auto mb-4 opacity-40" />
      <p>{error}</p>
    </div>
  );

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
        <button
          onClick={() => router.push("/docente/cursos")}
          className="p-2 rounded-xl hover:bg-orange-50 text-muted hover:text-[#f98012] transition-colors"
          title="Volver a Asignaturas"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Consolidado de Calificaciones</h1>
          <p className="text-muted text-sm mt-0.5 capitalize">{data.course.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted mr-2">
            <Users size={16} />
            <span><strong>{data.students.length}</strong> estudiantes</span>
          </div>
          <button
            onClick={exportToExcel}
            className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            style={{ height: "auto" }}
            title="Exportar a Excel"
          >
            <FileDown size={14} />
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            style={{ height: "auto" }}
            title="Exportar a PDF"
          >
            <FileDown size={14} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {data.periods.length === 0 && (
        <div className="card text-center py-12 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No hay períodos activos. Activa un período desde Gestión de Períodos.</p>
        </div>
      )}

      {data.periods.length > 0 && (
        <>
          {/* Tab Switcher & Period Tabs */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Period Tabs */}
            <div className="flex gap-2 flex-wrap">
              {data.periods.map(p => (
                <button
                  key={p}
                  onClick={() => setActivePeriod(p)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={
                    activePeriod === p
                      ? { background: "var(--primary-color)", color: "#fff", boxShadow: "0 4px 12px rgba(249,128,18,0.3)" }
                      : { background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }
                  }
                >
                  {p}
                </button>
              ))}
            </div>

            {/* View Switcher Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("mi-planilla")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "mi-planilla"
                    ? "bg-white dark:bg-gray-750 text-gray-800 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                }`}
              >
                📄 Mi Planilla Excel
              </button>
              <button
                onClick={() => setActiveTab("consolidado")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "consolidado"
                    ? "bg-white dark:bg-gray-750 text-gray-800 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                }`}
              >
                📋 Resumen por Periodo
              </button>
            </div>
          </div>

          {activeTab === "mi-planilla" ? (
            <PlanillaVisorEditor courseId={courseId} activePeriod={activePeriod} />
          ) : (
            <>
              {/* Stats row */}
              {periodStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Promedio General", value: periodStats.avg.toFixed(2), color: periodStats.avg >= 3 ? "var(--success)" : "var(--danger)", icon: <Award size={18} /> },
                { label: "Total Estudiantes", value: periodStats.total, color: "var(--primary-color)", icon: <Users size={18} /> },
                { label: "Aprobados", value: periodStats.passing, color: "var(--success)", icon: <FileText size={18} /> },
                { label: "Reprobados", value: periodStats.failing, color: "var(--danger)", icon: <AlertCircle size={18} /> },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="card flex items-center gap-3 p-4"
                  style={{ borderLeft: `4px solid ${stat.color}` }}
                >
                  <div style={{ color: stat.color }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, marginTop: "0.15rem" }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grade Table */}
          {data.students.length === 0 ? (
            <div className="card text-center py-12 text-muted">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p>No hay estudiantes inscritos en esta asignatura.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Average summary card */}
              {periodStats && (() => {
                const saberPct = data.saberPercent ?? 30;
                const hacerPct = data.hacerPercent ?? 50;
                const serPct   = data.serPercent   ?? 20;
                const avgSaber = (() => { const v = data.students.map(s => s.periods[activePeriod]?.saber).filter((x): x is number => x !== null); return v.length > 0 ? v.reduce((a,b)=>a+b,0)/v.length : null; })();
                const avgHacer = (() => { const v = data.students.map(s => s.periods[activePeriod]?.hacer).filter((x): x is number => x !== null); return v.length > 0 ? v.reduce((a,b)=>a+b,0)/v.length : null; })();
                const avgSer   = (() => { const v = data.students.map(s => s.periods[activePeriod]?.ser).filter((x): x is number => x !== null); return v.length > 0 ? v.reduce((a,b)=>a+b,0)/v.length : null; })();
                const avgFinal = (() => { const v = data.students.map(s => s.periods[activePeriod]?.final).filter((x): x is number => x !== null); return v.length > 0 ? v.reduce((a,b)=>a+b,0)/v.length : null; })();
                return (
                  <div className="card" style={{ borderLeft: "4px solid var(--primary-color)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>Promedio General del Grupo — {activePeriod}</div>
                    <PeriodSummaryCard
                      saber={avgSaber} hacer={avgHacer} ser={avgSer} final={avgFinal}
                      saberPct={saberPct} hacerPct={hacerPct} serPct={serPct}
                    />
                  </div>
                );
              })()}

              {/* Sort bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <span>Ordenar por:</span>
                {(["name", "saber", "hacer", "ser", "final"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => toggleSort(f)}
                    style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "0.4rem",
                      border: "1px solid var(--border-color)",
                      background: sortField === f ? "var(--primary-color)" : "var(--bg-secondary)",
                      color: sortField === f ? "#fff" : "var(--text-secondary)",
                      fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.2rem",
                    }}
                  >
                    {f === "name" ? "Nombre" : f === "saber" ? "Saber" : f === "hacer" ? "Hacer" : f === "ser" ? "Ser" : "Nota Final"}
                    <SortIcon field={f} />
                  </button>
                ))}
              </div>

              {/* Student cards */}
              {sortedStudents.map((student, idx) => {
                const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
                const saberPct = data.saberPercent ?? 30;
                const hacerPct = data.hacerPercent ?? 50;
                const serPct   = data.serPercent   ?? 20;

                const finalColor = pg.final !== null ? (pg.final >= 3.0 ? "var(--success)" : "var(--danger)") : "var(--border-color)";

                return (
                  <div
                    key={student.id}
                    className="card"
                    style={{ borderLeft: `4px solid ${finalColor}`, padding: "1rem 1.25rem" }}
                  >
                    {/* Student name header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%",
                        background: "linear-gradient(135deg, #f98012, #e06d09)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: 800, fontSize: "0.9rem", flexShrink: 0,
                      }}>
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{student.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{student.groupName}</div>
                      </div>
                    </div>

                    {/* Period summary */}
                    <PeriodSummaryCard
                      saber={pg.saber} hacer={pg.hacer} ser={pg.ser} final={pg.final}
                      saberPct={saberPct} hacerPct={hacerPct} serPct={serPct}
                    />

                    {/* Formula footnote */}
                    {(pg.saber !== null || pg.hacer !== null || pg.ser !== null) && pg.final !== null && (
                      <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginTop: "0.6rem", fontStyle: "italic" }}>
                        * Nota final = {pg.saber !== null ? `${(pg.saber * saberPct / 100).toFixed(2)} (Cognitivo×${saberPct}%)` : ""}{pg.hacer !== null ? ` + ${(pg.hacer * hacerPct / 100).toFixed(2)} (Procedimental×${hacerPct}%)` : ""}{pg.ser !== null ? ` + ${(pg.ser * serPct / 100).toFixed(2)} (Actitudinal×${serPct}%)` : ""}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </>
      )}
    </div>
  );
}
