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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
      {/* Header Banner: Back button, Course Title & Period Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <Link
            href="/estudiante"
            className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 mb-2 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Volver a Asignaturas
          </Link>
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 capitalize tracking-tight leading-tight">
            {courseName}
          </h1>
        </div>

        {periods.length > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300 text-sm font-extrabold w-fit shadow-xs">
            <span className="text-base">📅</span> {periods.join(" · ")}
          </div>
        )}
      </div>

      {/* Prominent & Large Navigation Tabs Bar */}
      <div className="bg-slate-100/90 dark:bg-gray-800/90 p-1.5 rounded-2xl flex items-center gap-2 overflow-x-auto">
        {showRecursos && (
          <Link
            href={`${base}/recursos`}
            className={`flex items-center gap-2.5 px-6 py-3 text-sm sm:text-base font-extrabold rounded-xl transition-all whitespace-nowrap ${
              isRecursosActive
                ? "bg-[#f98012] text-white shadow-md shadow-orange-500/20 scale-[1.02]"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-700/80 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen size={20} />
            Recursos y Materiales
          </Link>
        )}

        {showActividades && (
          <Link
            href={base}
            className={`flex items-center gap-2.5 px-6 py-3 text-sm sm:text-base font-extrabold rounded-xl transition-all whitespace-nowrap ${
              isHomeActive
                ? "bg-[#f98012] text-white shadow-md shadow-orange-500/20 scale-[1.02]"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-700/80 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Home size={20} />
            Actividades en plataforma
          </Link>
        )}

        {showCalificaciones && (
          <Link
            href={`${base}/calificaciones`}
            className={`flex items-center gap-2.5 px-6 py-3 text-sm sm:text-base font-extrabold rounded-xl transition-all whitespace-nowrap ${
              isCalifActive
                ? "bg-[#f98012] text-white shadow-md shadow-orange-500/20 scale-[1.02]"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-gray-700/80 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Award size={20} />
            Calificaciones
          </Link>
        )}
      </div>
    </div>
  );
}
