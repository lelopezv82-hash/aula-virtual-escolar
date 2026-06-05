"use client";

import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import TaskActions from "./TaskActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import GDriveVisibilityToggle from "@/components/GDriveVisibilityToggle";

interface Task {
  id: string;
  title: string;
  dueDate: string | Date;
  theme?: string | null;
  period?: string | null;
  weight?: number | null;
  attachmentUrl?: string | null;
  active?: boolean;
  publishAt?: string | null;
  gdriveEmail?: string | null;
}

interface Course {
  id: string;
  name: string;
  period1Active?: boolean;
  period2Active?: boolean;
  period3Active?: boolean;
  period4Active?: boolean;
  tasks: Task[];
}

interface Period {
  id: string;
  name: string;
  active: boolean;
}

export default function TareasDocenteClient({ courses, periods }: { courses: Course[], periods: Period[] }) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const hasFiltersApplied = selectedTheme !== "" || selectedPeriod !== "";

  const toggleTaskActive = async (task: Task) => {
    const newVal = task.active !== false ? false : true;
    try {
      await fetch(`/api/docente/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newVal })
      });
      router.refresh();
    } catch {
      console.error("Failed to toggle task status");
    }
  };

  // Extract all unique non-null themes and periods across all tasks in all courses
  const allTasks = courses.flatMap(c => c.tasks);
  const uniqueThemes = Array.from(new Set(allTasks.map(t => t.theme).filter(Boolean))) as string[];
  const uniquePeriods = Array.from(new Set(allTasks.map(t => t.period).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <GDriveVisibilityToggle />
      </div>
      {/* Global Filter Toolbar */}
      {allTasks.length > 0 && (uniqueThemes.length > 0 || uniquePeriods.length > 0) && (
        <div className="card p-4 flex flex-wrap gap-4 items-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <span className="font-semibold text-sm text-muted">Filtrar Tareas:</span>
          {uniqueThemes.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted font-medium">Tema:</label>
              <select 
                className="input-field py-1 px-3 text-xs h-auto" 
                value={selectedTheme} 
                onChange={e => setSelectedTheme(e.target.value)}
                style={{ width: "160px" }}
              >
                <option value="">Todos los temas</option>
                {uniqueThemes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {uniquePeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted font-medium">Periodo:</label>
              <select 
                className="input-field py-1 px-3 text-xs h-auto" 
                value={selectedPeriod} 
                onChange={e => setSelectedPeriod(e.target.value)}
                style={{ width: "160px" }}
              >
                <option value="">Todos los periodos</option>
                {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Courses List */}
      <div className="flex flex-col gap-6">
        {courses.map(course => {
          // Filter tasks of the course client-side
          const filteredTasks = course.tasks.filter(task => {
            const matchTheme = !selectedTheme || task.theme === selectedTheme;
            const matchPeriod = !selectedPeriod || task.period === selectedPeriod;
            return matchTheme && matchPeriod;
          });

          // Only render the course card if it has tasks or if no filters are applied
          if (hasFiltersApplied && filteredTasks.length === 0) return null;

          return (
            <div key={course.id} className="card w-full">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ClipboardList className="text-blue-600" />
                {course.name}
              </h2>
              
              <div className="flex flex-col gap-5">
                {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4", "Otros"].map(periodName => {
                  const periodTasks = filteredTasks.filter(t => {
                    if (periodName === "Otros") {
                      return !t.period || !["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].includes(t.period);
                    }
                    return t.period === periodName;
                  });

                  if (periodName === "Otros" && periodTasks.length === 0) return null;

                  const isPeriodActive = periodName === "Otros" || (() => {
                    const p = periods.find(p => p.name.toLowerCase() === periodName.toLowerCase());
                    return p ? p.active : true;
                  })();

                  return (
                    <div key={periodName} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', opacity: isPeriodActive ? 1 : 0.6 }}>
                      <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isPeriodActive ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                          {periodName}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isPeriodActive && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">Oculto para Alumnos</span>}
                          {periodName !== "Otros" && (
                            <Link href={`/docente/tareas/nueva?courseId=${course.id}&periodo=${encodeURIComponent(periodName)}`} className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1">
                              <Plus size={12} /> Crear Tarea
                            </Link>
                          )}
                        </div>
                      </h4>
                      
                      {periodTasks.length === 0 ? (
                        <p className="text-muted text-xs italic p-2">No hay tareas creadas en este periodo.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th className="py-2 px-4 font-medium text-xs">Título</th>
                                <th className="py-2 px-4 font-medium text-xs">Grado</th>
                                <th className="py-2 px-4 font-medium text-xs">Grupo</th>
                                <th className="py-2 px-4 font-medium text-xs">Tema</th>
                                <th className="py-2 px-4 font-medium text-xs">Porcentaje</th>
                                <th className="py-2 px-4 font-medium text-xs">Fecha Límite</th>
                                <th className="py-2.5 px-4 font-bold text-center text-xs">Estado</th>
                                <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodTasks.map(task => (
                                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                  <td className="py-3 px-4 font-semibold text-sm text-slate-800">
                                    <div className="flex flex-col gap-0.5">
                                      <span>{task.title}</span>
                                      {task.gdriveEmail && (
                                        <GDriveEmailDisplay email={task.gdriveEmail} />
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{(task as any).groups?.[0]?.grade?.name || "Sin Grado"}</td>
                                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{(task as any).groups?.map((g: any) => g.name).join(", ") || "Sin Grupo"}</td>
                                  <td className="py-3 px-4">
                                    {task.theme ? (
                                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                                        {task.theme}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted italic">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                      {task.weight !== undefined && task.weight !== null ? task.weight : 0}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-muted text-sm">
                                    {new Date(task.dueDate).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskActive(task)}
                                        className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
                                        style={{
                                          width: "42px",
                                          height: "22px",
                                          borderRadius: "9999px",
                                          background: task.active !== false ? "var(--success, #10b981)" : "#cbd5e1",
                                          border: "none",
                                          padding: 0,
                                          outline: "none"
                                        }}
                                        title={task.active !== false ? "Visible para alumnos (Click para ocultar)" : "Oculto para alumnos (Click para mostrar)"}
                                      >
                                        <span
                                          className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                                          style={{
                                            width: "18px",
                                            height: "18px",
                                            transform: task.active !== false ? "translateX(22px)" : "translateX(2px)",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                          }}
                                        />
                                      </button>
                                      {task.active !== false && task.publishAt && new Date(task.publishAt) > new Date() && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50" title={`Se publicará el ${new Date(task.publishAt).toLocaleString()}`}>
                                          Programada
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <TaskActions taskId={task.id} attachmentUrl={task.attachmentUrl} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Global Empty State if all courses are hidden by filters */}
        {hasFiltersApplied && courses.length > 0 && courses.every(c => c.tasks.filter(t => (!selectedTheme || t.theme === selectedTheme) && (!selectedPeriod || t.period === selectedPeriod)).length === 0) && (
          <div className="card text-center py-10 text-muted">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
            <p>No se encontraron tareas que coincidan con los filtros de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
