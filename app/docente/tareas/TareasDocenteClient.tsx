"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import TaskActions from "./TaskActions";

interface Task {
  id: string;
  title: string;
  dueDate: string | Date;
  theme?: string | null;
  period?: string | null;
  weight?: number | null;
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

export default function TareasDocenteClient({ courses }: { courses: Course[] }) {
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const hasFiltersApplied = selectedTheme !== "" || selectedPeriod !== "";

  // Extract all unique non-null themes and periods across all tasks in all courses
  const allTasks = courses.flatMap(c => c.tasks);
  const uniqueThemes = Array.from(new Set(allTasks.map(t => t.theme).filter(Boolean))) as string[];
  const uniquePeriods = Array.from(new Set(allTasks.map(t => t.period).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-6">
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
              
              {course.tasks.length === 0 ? (
                <p className="text-muted">No hay tareas asignadas en este curso.</p>
              ) : filteredTasks.length === 0 ? (
                <p className="text-muted text-sm italic">Ninguna tarea coincide con los filtros aplicados en este curso.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4", "Otros"].map(periodName => {
                    const periodTasks = filteredTasks.filter(t => {
                      if (periodName === "Otros") {
                        return !t.period || !["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].includes(t.period);
                      }
                      return t.period === periodName;
                    });

                    if (periodTasks.length === 0) return null;

                    const isPeriodActive = periodName === "Otros" || (() => {
                      if (periodName === "Periodo 1") return course.period1Active !== false;
                      if (periodName === "Periodo 2") return course.period2Active !== false;
                      if (periodName === "Periodo 3") return course.period3Active !== false;
                      if (periodName === "Periodo 4") return course.period4Active !== false;
                      return true;
                    })();

                    return (
                      <div key={periodName} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', opacity: isPeriodActive ? 1 : 0.6 }}>
                        <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isPeriodActive ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                            {periodName}
                          </span>
                          {!isPeriodActive && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">Oculto para Alumnos</span>}
                        </h4>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th className="py-2 px-4 font-medium text-xs">Título</th>
                                <th className="py-2 px-4 font-medium text-xs">Tema</th>
                                <th className="py-2 px-4 font-medium text-xs">Porcentaje</th>
                                <th className="py-2 px-4 font-medium text-xs">Fecha Límite</th>
                                <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodTasks.map(task => (
                                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                  <td className="py-3 px-4 font-medium text-sm">{task.title}</td>
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
                                  <td className="py-3 px-4 text-right">
                                    <TaskActions taskId={task.id} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
