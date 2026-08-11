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

      {/* Distinct Framed Button Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-1">
        {showRecursos && (
          <Link
            href={`${base}/recursos`}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
              isRecursosActive
                ? "bg-[#f98012] border-[#e06d09] text-white shadow-md shadow-orange-500/20"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            <BookOpen size={18} className={isRecursosActive ? "text-white" : "text-orange-500"} />
            <span>Recursos y Materiales</span>
          </Link>
        )}

        {showActividades && (
          <Link
            href={base}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
              isHomeActive
                ? "bg-[#f98012] border-[#e06d09] text-white shadow-md shadow-orange-500/20"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            <Home size={18} className={isHomeActive ? "text-white" : "text-blue-500"} />
            <span>Actividades en plataforma</span>
          </Link>
        )}

        {showCalificaciones && (
          <Link
            href={`${base}/calificaciones`}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
              isCalifActive
                ? "bg-[#f98012] border-[#e06d09] text-white shadow-md shadow-orange-500/20"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            <Award size={18} className={isCalifActive ? "text-white" : "text-emerald-500"} />
            <span>Calificaciones</span>
          </Link>
        )}
      </div>
    </div>
  );
}
