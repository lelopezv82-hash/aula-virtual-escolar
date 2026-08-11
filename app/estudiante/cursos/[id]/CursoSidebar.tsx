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
      {/* Top row: Back button & Course title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <Link
            href="/estudiante"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Volver a Asignaturas
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 capitalize leading-tight">
            {courseName}
          </h1>
        </div>

        {periods.length > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold w-fit">
            <span>📅</span> {periods.join(" · ")}
          </div>
        )}
      </div>

      {/* Horizontal Tab Bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800 pb-0 pt-1">
        {showRecursos && (
          <Link
            href={`${base}/recursos`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              isRecursosActive
                ? "border-[#f98012] text-[#f98012] bg-orange-50/50 dark:bg-orange-950/20 rounded-t-lg"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <BookOpen size={16} />
            Recursos y Materiales
          </Link>
        )}

        {showActividades && (
          <Link
            href={base}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              isHomeActive
                ? "border-[#f98012] text-[#f98012] bg-orange-50/50 dark:bg-orange-950/20 rounded-t-lg"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Home size={16} />
            Actividades en plataforma
          </Link>
        )}

        {showCalificaciones && (
          <Link
            href={`${base}/calificaciones`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              isCalifActive
                ? "border-[#f98012] text-[#f98012] bg-orange-50/50 dark:bg-orange-950/20 rounded-t-lg"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Award size={16} />
            Calificaciones
          </Link>
        )}
      </div>
    </div>
  );
}
