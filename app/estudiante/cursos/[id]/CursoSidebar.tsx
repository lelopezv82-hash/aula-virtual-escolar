"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, Home, Award } from "lucide-react";

interface CursoSidebarProps {
  courseId: string;
  courseName: string;
  periods?: string[];
  hiddenSections?: string[];
}

export default function CursoSidebar({ courseId, courseName, periods = [], hiddenSections = [] }: CursoSidebarProps) {
  const pathname = usePathname();
  const base = `/estudiante/cursos/${courseId}`;

  const isHomeActive = pathname === base;
  const isRecursosActive = pathname.includes("/recursos");
  const isCalifActive = pathname.includes("/calificaciones");

  const showRecursos = !hiddenSections.includes("recursos");
  const showActividades = !hiddenSections.includes("descripcion");
  const showCalificaciones = !hiddenSections.includes("calificaciones");

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      {/* Header Banner: Course Title & Period Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 capitalize tracking-tight leading-tight">
            {courseName}
          </h1>
        </div>

        {periods.length > 0 && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-bold w-fit shadow-xs">
            <span>📅</span> {periods.join(" · ")}
          </div>
        )}
      </div>

      {/* High-Contrast Clear Navigation Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-1">
        {showRecursos && (
          <Link
            href={`${base}/recursos`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.7rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 800,
              textDecoration: "none",
              borderRadius: "12px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease-in-out",
              border: isRecursosActive ? "2px solid #f98012" : "1.5px solid #cbd5e1",
              backgroundColor: isRecursosActive ? "#fff7ed" : "#f8fafc",
              color: isRecursosActive ? "#ea580c" : "#334155",
              boxShadow: isRecursosActive ? "0 2px 8px rgba(249, 128, 18, 0.15)" : "none"
            }}
          >
            <BookOpen size={18} color={isRecursosActive ? "#ea580c" : "#64748b"} />
            <span style={{ color: isRecursosActive ? "#ea580c" : "#334155" }}>Recursos y Materiales</span>
          </Link>
        )}

        {showActividades && (
          <Link
            href={base}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.7rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 800,
              textDecoration: "none",
              borderRadius: "12px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease-in-out",
              border: isHomeActive ? "2px solid #f98012" : "1.5px solid #cbd5e1",
              backgroundColor: isHomeActive ? "#fff7ed" : "#f8fafc",
              color: isHomeActive ? "#ea580c" : "#334155",
              boxShadow: isHomeActive ? "0 2px 8px rgba(249, 128, 18, 0.15)" : "none"
            }}
          >
            <Home size={18} color={isHomeActive ? "#ea580c" : "#64748b"} />
            <span style={{ color: isHomeActive ? "#ea580c" : "#334155" }}>Actividades en plataforma</span>
          </Link>
        )}

        {showCalificaciones && (
          <Link
            href={`${base}/calificaciones`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.7rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 800,
              textDecoration: "none",
              borderRadius: "12px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease-in-out",
              border: isCalifActive ? "2px solid #f98012" : "1.5px solid #cbd5e1",
              backgroundColor: isCalifActive ? "#fff7ed" : "#f8fafc",
              color: isCalifActive ? "#ea580c" : "#334155",
              boxShadow: isCalifActive ? "0 2px 8px rgba(249, 128, 18, 0.15)" : "none"
            }}
          >
            <Award size={18} color={isCalifActive ? "#ea580c" : "#64748b"} />
            <span style={{ color: isCalifActive ? "#ea580c" : "#334155" }}>Calificaciones</span>
          </Link>
        )}
      </div>
    </div>
  );
}
