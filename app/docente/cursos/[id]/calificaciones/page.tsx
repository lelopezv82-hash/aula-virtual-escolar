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

function GradeCell({ value, size = "normal" }: { value: number | null; size?: "normal" | "large" }) {
  if (value === null) {
    return (
      <span style={{ color: "var(--text-muted)", fontSize: size === "large" ? "1rem" : "0.82rem", fontStyle: "italic" }}>
        —
      </span>
    );
  }
  const pass = value >= 3.0;
  const color = pass ? "var(--success)" : "var(--danger)";
  const bg = pass ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)";
  return (
    <span
      style={{
        display: "inline-block",
        fontWeight: 800,
        fontSize: size === "large" ? "1.15rem" : "0.9rem",
        color,
        background: bg,
        borderRadius: "0.4rem",
        padding: size === "large" ? "0.2rem 0.6rem" : "0.1rem 0.4rem",
        minWidth: size === "large" ? "52px" : "40px",
        textAlign: "center",
      }}
    >
      {value.toFixed(1)}
    </span>
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

  const exportToExcel = () => {
    if (!data || !activePeriod) return;
    const worksheetData = sortedStudents.map(student => {
      const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
      return {
        "Estudiante": student.name,
        "Grupo": student.groupName,
        "Saber (Exámenes)": pg.saber !== null ? pg.saber : "—",
        "Hacer (Tareas)": pg.hacer !== null ? pg.hacer : "—",
        "Ser (Nota del Ser)": pg.ser !== null ? pg.ser : "—",
        "Nota Final": pg.final !== null ? pg.final : "—"
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activePeriod);
    XLSX.writeFile(wb, `Consolidado_${data.course.name.replace(/\s+/g, '_')}_${activePeriod}.xlsx`);
  };

  const exportToPDF = () => {
    if (!data || !activePeriod) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Consolidado de Calificaciones", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Curso: ${data.course.name}`, 14, 28);
    doc.text(`Periodo: ${activePeriod}`, 14, 34);
    doc.text(`Fecha de exportacion: ${new Date().toLocaleDateString()}`, 14, 40);
    
    const tableColumn = ["Estudiante", "Grupo", "Saber (Examenes)", "Hacer (Tareas)", "Ser (Nota del Ser)", "Nota Final"];
    const tableRows = sortedStudents.map(student => {
      const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
      return [
        student.name,
        student.groupName,
        pg.saber !== null ? pg.saber.toFixed(1) : "—",
        pg.hacer !== null ? pg.hacer.toFixed(1) : "—",
        pg.ser !== null ? pg.ser.toFixed(1) : "—",
        pg.final !== null ? pg.final.toFixed(1) : "—"
      ];
    });
    
    if (periodStats) {
      const statsRow = [
        "PROMEDIO GENERAL",
        "",
        (() => {
          const vals = data.students.map(s => s.periods[activePeriod]?.saber).filter((v): v is number => v !== null);
          return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
        })(),
        (() => {
          const vals = data.students.map(s => s.periods[activePeriod]?.hacer).filter((v): v is number => v !== null);
          return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
        })(),
        (() => {
          const vals = data.students.map(s => s.periods[activePeriod]?.ser).filter((v): v is number => v !== null);
          return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
        })(),
        (() => {
          const vals = data.students.map(s => s.periods[activePeriod]?.final).filter((v): v is number => v !== null);
          return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
        })()
      ];
      tableRows.push(statsRow);
    }
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'striped',
      headStyles: { fillColor: [249, 128, 18] },
      didParseCell: (cellData) => {
        if (cellData.row.index === tableRows.length - 1) {
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });
    
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
            <div className="card p-0 overflow-hidden">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-color)" }}>
                      {/* Student name */}
                      <th
                        style={{ padding: "0.9rem 1.2rem", textAlign: "left", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
                        onClick={() => toggleSort("name")}
                      >
                        <div className="flex items-center gap-1.5">
                          <Users size={14} style={{ color: "var(--text-muted)" }} />
                          Estudiante <SortIcon field="name" />
                        </div>
                      </th>

                      {/* Saber */}
                      <th
                        style={{ padding: "0.9rem 1rem", textAlign: "center", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", color: "#8b5cf6" }}
                        onClick={() => toggleSort("saber")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <FileText size={13} />
                          Saber ({data.saberPercent ?? 30}%) <SortIcon field="saber" />
                        </div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--text-muted)", marginTop: "0.1rem" }}>Exámenes</div>
                      </th>

                      {/* Hacer */}
                      <th
                        style={{ padding: "0.9rem 1rem", textAlign: "center", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", color: "var(--primary-color)" }}
                        onClick={() => toggleSort("hacer")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <ClipboardList size={13} />
                          Hacer ({data.hacerPercent ?? 50}%) <SortIcon field="hacer" />
                        </div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--text-muted)", marginTop: "0.1rem" }}>Tareas</div>
                      </th>

                      {/* Ser */}
                      <th
                        style={{ padding: "0.9rem 1rem", textAlign: "center", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", color: "#f59e0b" }}
                        onClick={() => toggleSort("ser")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Star size={13} />
                          Ser ({data.serPercent ?? 20}%) <SortIcon field="ser" />
                        </div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--text-muted)", marginTop: "0.1rem" }}>Adicional</div>
                      </th>

                      {/* Final */}
                      <th
                        style={{ padding: "0.9rem 1rem", textAlign: "center", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
                        onClick={() => toggleSort("final")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Award size={13} />
                          Nota Final <SortIcon field="final" />
                        </div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--text-muted)", marginTop: "0.1rem" }}>{activePeriod}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((student, idx) => {
                      const pg = student.periods[activePeriod] ?? { saber: null, hacer: null, ser: null, final: null };
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={student.id}
                          style={{
                            background: isEven ? "var(--bg-primary)" : "var(--bg-secondary)",
                            borderBottom: "1px solid var(--border-color)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover, rgba(249,128,18,0.04))")}
                          onMouseLeave={e => (e.currentTarget.style.background = isEven ? "var(--bg-primary)" : "var(--bg-secondary)")}
                        >
                          {/* Name */}
                          <td style={{ padding: "0.85rem 1.2rem" }}>
                            <div className="flex items-center gap-3">
                              <div
                                style={{
                                  width: "34px", height: "34px", borderRadius: "50%",
                                  background: "linear-gradient(135deg, #f98012, #e06d09)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#fff", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0,
                                }}
                              >
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{student.name}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{student.groupName}</div>
                              </div>
                            </div>
                          </td>

                          {/* Saber */}
                          <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                            <GradeCell value={pg.saber} />
                          </td>

                          {/* Hacer */}
                          <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                            <GradeCell value={pg.hacer} />
                          </td>

                          {/* Ser */}
                          <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                            <GradeCell value={pg.ser} />
                          </td>

                          {/* Final */}
                          <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                            <GradeCell value={pg.final} size="large" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Footer average row */}
                  {periodStats && (
                    <tfoot>
                      <tr style={{ background: "var(--bg-secondary)", borderTop: "2px solid var(--border-color)" }}>
                        <td style={{ padding: "0.8rem 1.2rem", fontWeight: 700, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Promedio General
                        </td>
                        {(["saber", "hacer", "ser", "final"] as const).map(field => {
                          const vals = data.students
                            .map(s => s.periods[activePeriod]?.[field])
                            .filter((v): v is number => v !== null);
                          const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                          return (
                            <td key={field} style={{ padding: "0.8rem 1rem", textAlign: "center" }}>
                              <GradeCell value={avg} size={field === "final" ? "large" : "normal"} />
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
