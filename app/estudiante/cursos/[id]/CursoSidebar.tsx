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
      {/* Header Banner: Back button, Course Title & Period Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <Link
            href="/estudiante"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 mb-1.5 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Volver a Asignaturas
          </Link>
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

      {/* Clean Horizontal Tab Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "2px solid var(--border-color, #e2e8f0)",
          paddingBottom: "0px",
          overflowX: "auto"
        }}
      >
        {showRecursos && (
          <Link
            href={`${base}/recursos`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              textDecoration: "none",
              color: isRecursosActive ? "#f98012" : "#4b5563",
              borderBottom: isRecursosActive ? "3px solid #f98012" : "3px solid transparent",
              backgroundColor: isRecursosActive ? "rgba(249, 128, 18, 0.08)" : "transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s ease",
              marginBottom: "-2px",
              whiteSpace: "nowrap"
            }}
          >
            <BookOpen size={18} color={isRecursosActive ? "#f98012" : "#4b5563"} />
            Recursos y Materiales
          </Link>
        )}

        {showActividades && (
          <Link
            href={base}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              textDecoration: "none",
              color: isHomeActive ? "#f98012" : "#4b5563",
              borderBottom: isHomeActive ? "3px solid #f98012" : "3px solid transparent",
              backgroundColor: isHomeActive ? "rgba(249, 128, 18, 0.08)" : "transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s ease",
              marginBottom: "-2px",
              whiteSpace: "nowrap"
            }}
          >
            <Home size={18} color={isHomeActive ? "#f98012" : "#4b5563"} />
            Actividades en plataforma
          </Link>
        )}

        {showCalificaciones && (
          <Link
            href={`${base}/calificaciones`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              textDecoration: "none",
              color: isCalifActive ? "#f98012" : "#4b5563",
              borderBottom: isCalifActive ? "3px solid #f98012" : "3px solid transparent",
              backgroundColor: isCalifActive ? "rgba(249, 128, 18, 0.08)" : "transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s ease",
              marginBottom: "-2px",
              whiteSpace: "nowrap"
            }}
          >
            <Award size={18} color={isCalifActive ? "#f98012" : "#4b5563"} />
            Calificaciones
          </Link>
        )}
      </div>
    </div>
  );
}
