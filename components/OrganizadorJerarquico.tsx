"use client";

import { useState } from "react";
import { 
  ChevronDown, ChevronRight, BookOpen, Layers, Users, ClipboardList, 
  FileText, ExternalLink, CheckCircle, Clock, Search
} from "lucide-react";
import Link from "next/link";

interface Student {
  id: string;
  name: string;
  submission?: {
    id: string;
    status: string;
    grade: number | null;
    fileUrl: string | null;
    submittedAt: string | null;
  };
}

interface GroupedTask {
  id: string;
  title: string;
  dueDate: string;
  weight: number;
  active: boolean;
  students: Student[];
}

interface GroupedResource {
  id: string;
  title: string;
  type: string;
  url: string;
  active: boolean;
  theme?: string | null;
}

interface GroupedData {
  [courseName: string]: {
    courseId: string;
    grades: {
      [gradeName: string]: {
        groups: {
          [groupName: string]: {
            groupId: string;
            tasks: GroupedTask[];
            resources: GroupedResource[];
          };
        };
      };
    };
  };
}

interface OrganizadorJerarquicoProps {
  courses: any[];
  selectedPeriod: string;
}

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default function OrganizadorJerarquico({ courses, selectedPeriod }: OrganizadorJerarquicoProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Helper to toggle nodes
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Build the hierarchical tree
  const buildHierarchy = (coursesList: any[], period: string): GroupedData => {
    const hierarchy: GroupedData = {};

    coursesList.forEach(course => {
      // Filter tasks and resources by period
      const periodTasks = course.tasks.filter((t: any) => t.period === period);
      const periodResources = course.resources.filter((r: any) => r.period === period);

      if (periodTasks.length === 0 && periodResources.length === 0) return;

      // Filter by search term if applicable
      const filteredTasks = periodTasks.filter((t: any) => {
        if (!searchTerm) return true;
        const matchesTitle = t.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStudent = t.groups?.some((g: any) => 
          g.students?.some((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        return matchesTitle || matchesStudent;
      });

      const filteredResources = periodResources.filter((r: any) => {
        if (!searchTerm) return true;
        return r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
               (r.theme && r.theme.toLowerCase().includes(searchTerm.toLowerCase()));
      });

      if (filteredTasks.length === 0 && filteredResources.length === 0) return;

      if (!hierarchy[course.name]) {
        hierarchy[course.name] = { courseId: course.id, grades: {} };
      }

      // Process Resources
      filteredResources.forEach((res: any) => {
        // Fallback to course's groups if no groups assigned to this resource
        const targetGroups = res.groups && res.groups.length > 0 
          ? res.groups 
          : course.groups && course.groups.length > 0 
            ? course.groups 
            : [{ id: "general", name: "General", grade: { name: "General" } }];

        targetGroups.forEach((g: any) => {
          const gradeName = g.grade?.name || "Sin Grado";
          const groupName = g.name;

          if (!hierarchy[course.name].grades[gradeName]) {
            hierarchy[course.name].grades[gradeName] = { groups: {} };
          }

          if (!hierarchy[course.name].grades[gradeName].groups[groupName]) {
            hierarchy[course.name].grades[gradeName].groups[groupName] = {
              groupId: g.id,
              tasks: [],
              resources: []
            };
          }

          const groupObj = hierarchy[course.name].grades[gradeName].groups[groupName];
          if (!groupObj.resources.some(r => r.id === res.id)) {
            groupObj.resources.push({
              id: res.id,
              title: res.title,
              type: res.type,
              url: res.url,
              active: res.active !== false,
              theme: res.theme
            });
          }
        });
      });

      // Process Tasks
      filteredTasks.forEach((task: any) => {
        // Fallback to course's groups if no groups assigned to this task
        const targetGroups = task.groups && task.groups.length > 0 
          ? task.groups 
          : course.groups && course.groups.length > 0 
            ? course.groups 
            : [{ id: "general", name: "General", grade: { name: "General" } }];

        targetGroups.forEach((g: any) => {
          const gradeName = g.grade?.name || "Sin Grado";
          const groupName = g.name;

          if (!hierarchy[course.name].grades[gradeName]) {
            hierarchy[course.name].grades[gradeName] = { groups: {} };
          }

          if (!hierarchy[course.name].grades[gradeName].groups[groupName]) {
            hierarchy[course.name].grades[gradeName].groups[groupName] = {
              groupId: g.id,
              tasks: [],
              resources: []
            };
          }

          const groupObj = hierarchy[course.name].grades[gradeName].groups[groupName];

          // Map students
          let taskStudents = (g.students || []).map((stud: any) => {
            const submission = task.submissions?.find((s: any) => s.studentId === stud.id);
            return {
              id: stud.id,
              name: stud.name,
              submission: submission ? {
                id: submission.id,
                status: submission.status,
                grade: submission.grade,
                fileUrl: submission.fileUrl,
                submittedAt: submission.submittedAt
              } : undefined
            };
          });

          // If search term matches student name, filter students shown under this task
          if (searchTerm) {
            taskStudents = taskStudents.filter((s: any) => 
              s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }

          taskStudents.sort((a: any, b: any) => a.name.localeCompare(b.name));

          if (!groupObj.tasks.some(t => t.id === task.id)) {
            groupObj.tasks.push({
              id: task.id,
              title: task.title,
              dueDate: task.dueDate,
              weight: task.weight || 0,
              active: task.active !== false,
              students: taskStudents
            });
          }
        });
      });
    });

    return hierarchy;
  };

  const hierarchy = buildHierarchy(courses, selectedPeriod);
  const courseNames = Object.keys(hierarchy).sort();

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full text-base">
      {/* Search and Header */}
      <div className="card p-5 flex flex-wrap gap-5 items-center justify-between" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
            <ClipboardList size={24} />
          </div>
          <div>
            <h3 className="font-bold text-base md:text-lg">Organizador Académico Jerárquico</h3>
            <p className="text-xs md:text-sm text-muted">Vista estructurada por periodo, asignatura, grado y curso.</p>
          </div>
        </div>
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-3 flex items-center text-muted">
            <Search size={18} />
          </span>
          <input
            type="text"
            className="input-field py-2 pl-10 pr-4 text-sm w-full"
            placeholder="Buscar por estudiante, tarea, tema..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {courseNames.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={56} className="mx-auto mb-4 opacity-35" />
          <p className="font-semibold text-base">No se encontraron tareas ni recursos organizados en este periodo.</p>
          <p className="text-sm mt-1">Verifica si aplicaste filtros de búsqueda o si hay contenido creado en el {selectedPeriod.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {courseNames.map(courseName => {
            const courseObj = hierarchy[courseName];
            const courseNodeId = `course-${courseName}`;
            const isCourseExpanded = expandedNodes[courseNodeId] !== false; // Expand by default

            const gradeNames = Object.keys(courseObj.grades).sort();

            return (
              <div key={courseName} className="card w-full p-0 overflow-hidden" style={{ border: "1px solid var(--border-color)", background: "var(--bg-primary)", borderRadius: "12px" }}>
                {/* Level 1: Course / Asignatura Header */}
                <div 
                  onClick={() => toggleNode(courseNodeId)}
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 border-b transition-colors"
                  style={{ borderColor: "var(--border-color)", background: "rgba(37, 99, 235, 0.04)" }}
                >
                  <div className="flex items-center gap-3.5">
                    {isCourseExpanded ? <ChevronDown size={22} className="text-slate-600" /> : <ChevronRight size={22} className="text-slate-600" />}
                    <BookOpen className="text-blue-600" size={22} />
                    <span className="font-extrabold text-base md:text-lg uppercase tracking-wider text-slate-800 dark:text-slate-100">Asignatura: {courseName}</span>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                    {gradeNames.length} {gradeNames.length === 1 ? "Grado" : "Grados"}
                  </span>
                </div>

                {/* Level 2: Grades inside Course */}
                {isCourseExpanded && (
                  <div className="p-4 flex flex-col gap-4">
                    {gradeNames.map(gradeName => {
                      const gradeObj = courseObj.grades[gradeName];
                      const gradeNodeId = `${courseNodeId}-grade-${gradeName}`;
                      const isGradeExpanded = expandedNodes[gradeNodeId] !== false; // Expand by default

                      const groupNames = Object.keys(gradeObj.groups).sort();

                      return (
                        <div key={gradeName} className="ml-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                          {/* Grade Header */}
                          <div 
                            onClick={() => toggleNode(gradeNodeId)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 border-b bg-slate-50/50 dark:bg-slate-900/10 transition-colors"
                            style={{ borderColor: "var(--border-color)" }}
                          >
                            <div className="flex items-center gap-3">
                              {isGradeExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                              <Layers className="text-indigo-500" size={20} />
                              <span className="font-bold text-sm md:text-base text-slate-700 dark:text-slate-200">Grado: {gradeName}</span>
                            </div>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                              {groupNames.length} {groupNames.length === 1 ? "Curso" : "Cursos"}
                            </span>
                          </div>

                          {/* Level 3: Groups (Cursos) inside Grade */}
                          {isGradeExpanded && (
                            <div className="p-3 flex flex-col gap-3 bg-white dark:bg-slate-950">
                              {groupNames.map(groupName => {
                                const groupObj = gradeObj.groups[groupName];
                                const groupNodeId = `${gradeNodeId}-group-${groupName}`;
                                const isGroupExpanded = expandedNodes[groupNodeId] !== false; // Expand by default

                                return (
                                  <div key={groupName} className="ml-4 rounded-xl border overflow-hidden bg-slate-50/30 dark:bg-slate-900/5" style={{ borderColor: "var(--border-color)" }}>
                                    {/* Group Header */}
                                    <div 
                                      onClick={() => toggleNode(groupNodeId)}
                                      className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 border-b transition-colors"
                                      style={{ borderColor: "var(--border-color)" }}
                                    >
                                      <div className="flex items-center gap-3">
                                        {isGroupExpanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                                        <Users className="text-emerald-500" size={18} />
                                        <span className="font-extrabold text-xs md:text-sm text-slate-600">Curso / Grupo: {groupName}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        {groupObj.tasks.length > 0 && (
                                          <span className="text-xs bg-green-50 text-green-700 border border-green-200/50 px-2 py-0.5 rounded font-bold">
                                            {groupObj.tasks.length} {groupObj.tasks.length === 1 ? "Tarea" : "Tareas"}
                                          </span>
                                        )}
                                        {groupObj.resources.length > 0 && (
                                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200/50 px-2 py-0.5 rounded font-bold">
                                            {groupObj.resources.length} {groupObj.resources.length === 1 ? "Material" : "Materiales"}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Level 4: Tareas and Materiales list */}
                                    {isGroupExpanded && (
                                      <div className="p-4 flex flex-col gap-5">
                                        
                                        {/* Class Tasks Section */}
                                        {groupObj.tasks.length > 0 && (
                                          <div className="flex flex-col gap-3">
                                            <h5 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5 mb-1.5" style={{ borderColor: "var(--border-color)" }}>
                                              <ClipboardList size={16} className="text-green-500" />
                                              Tareas para Calificar
                                            </h5>
                                            <div className="flex flex-col gap-3.5">
                                              {groupObj.tasks.map(task => {
                                                const taskNodeId = `${groupNodeId}-task-${task.id}`;
                                                const isTaskExpanded = expandedNodes[taskNodeId] === true; // Collapse by default
                                                
                                                const gradedCount = task.students.filter(s => s.submission?.status === "GRADED").length;
                                                const submittedCount = task.students.filter(s => s.submission?.status === "SUBMITTED").length;
                                                const pendingCount = task.students.length - gradedCount - submittedCount;

                                                return (
                                                  <div key={task.id} className="border rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs" style={{ borderColor: "var(--border-color)" }}>
                                                    {/* Task Item Row */}
                                                    <div 
                                                      className="flex flex-wrap items-center justify-between p-3.5 gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10"
                                                      onClick={() => toggleNode(taskNodeId)}
                                                    >
                                                      <div className="flex items-center gap-2.5 min-w-0">
                                                        {isTaskExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981" }}>
                                                          Peso: {task.weight}%
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-4">
                                                        <span className="text-xs text-muted font-medium">Vence: {new Date(task.dueDate).toLocaleDateString()}</span>
                                                        
                                                        {/* Status counters */}
                                                        <div className="flex items-center gap-2 text-xs font-bold">
                                                          <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200/20">{gradedCount} Calif.</span>
                                                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/20">{submittedCount} Entr.</span>
                                                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/20">{pendingCount} Pend.</span>
                                                        </div>

                                                        <Link href={`/docente/tareas/${task.id}`} className="text-xs font-bold text-blue-600 hover:underline">
                                                          Calificar Todo
                                                        </Link>
                                                      </div>
                                                    </div>

                                                    {/* Level 5: Students list under Task (Optimized, smaller rows layout to avoid clutter) */}
                                                    {isTaskExpanded && (
                                                      <div className="border-t bg-slate-50/40 dark:bg-slate-900/10 p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)" }}>
                                                        {task.students.length === 0 ? (
                                                          <p className="text-xs text-muted italic p-2 text-center">No hay estudiantes en este curso.</p>
                                                        ) : (
                                                          task.students.map(student => {
                                                            const sub = student.submission;
                                                            const isSubmitted = sub && sub.status !== "PENDING";
                                                            const isGraded = sub && sub.status === "GRADED";

                                                            return (
                                                              <div key={student.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-905 border border-slate-100 hover:bg-slate-50 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{student.name}</span>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-3">
                                                                  {isGraded ? (
                                                                    <>
                                                                      <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                        <CheckCircle size={10} /> Calificada
                                                                      </span>
                                                                      <span className="text-xs font-extrabold text-green-600">{sub.grade?.toFixed(1)} / 5.0</span>
                                                                    </>
                                                                  ) : isSubmitted ? (
                                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                      <Clock size={10} /> Entregada
                                                                    </span>
                                                                  ) : (
                                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                      <Clock size={10} /> Pendiente
                                                                    </span>
                                                                  )}

                                                                  <div className="flex items-center gap-1.5 ml-2 border-l pl-3" style={{ borderColor: "var(--border-color)" }}>
                                                                    {sub?.fileUrl && (
                                                                      <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1">
                                                                        <ExternalLink size={12} /> Archivo
                                                                      </a>
                                                                    )}
                                                                    {isSubmitted ? (
                                                                      <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="text-[11px] font-bold text-blue-600 hover:underline">
                                                                        Calificar
                                                                      </Link>
                                                                    ) : (
                                                                      <span className="text-[10px] text-muted italic">Sin entrega</span>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            );
                                                          })
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {/* Class Materials Section (Larger layout rows) */}
                                        {groupObj.resources.length > 0 && (
                                          <div className="flex flex-col gap-3">
                                            <h5 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5 mb-1.5" style={{ borderColor: "var(--border-color)" }}>
                                              <FileText size={16} className="text-blue-500" />
                                              Materiales de Clase
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {groupObj.resources.map(res => (
                                                <div 
                                                  key={res.id} 
                                                  className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 hover:shadow-sm transition-all"
                                                  style={{ borderColor: "var(--border-color)" }}
                                                >
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <span style={{ fontSize: "1.5rem" }} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">{TYPE_ICONS[res.type] || "📁"}</span>
                                                    <div className="min-w-0">
                                                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate" title={res.title}>{res.title}</p>
                                                      {res.theme && <span className="text-xs text-muted block truncate font-medium">Tema: {res.theme}</span>}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <a 
                                                      href={res.url} 
                                                      target="_blank" 
                                                      rel="noreferrer" 
                                                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                                                      title="Ver archivo"
                                                    >
                                                      <ExternalLink size={16} />
                                                    </a>
                                                    {!res.active && (
                                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-extrabold uppercase">Oculto</span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
