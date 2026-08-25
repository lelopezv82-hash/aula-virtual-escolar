"use client";

import { useState, useMemo } from "react";
import { Users, BookOpen, ClipboardList, TrendingUp, Filter, GraduationCap, ArrowRight, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import EntregasRecientes from "./EntregasRecientes";

export interface CourseGroupItem {
  courseId: string;
  courseName: string;
  groupId: string;
  groupName: string;
  gradeId: string;
  gradeName: string;
  studentIds: string[];
  studentsCount: number;
  tasksCount: number;
  pendingCount: number;
  gradedCount: number;
  averageGrade: number | null;
}

export interface TaskStatItem {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  gradeName: string;
  groupName: string;
  submitted: number;
  total: number;
  rate: number;
}

export interface SubItem {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  taskTitle: string;
  courseName: string;
  grade: number | null;
  status: string;
  updatedAt: string;
  feedback: string | null;
  fileUrl: string | null;
  submittedAt: string | null;
  isExam: boolean;
  isGoogleForm: boolean;
  answers?: any;
}

interface Props {
  teacherName: string;
  courseGroups: CourseGroupItem[];
  allTasks: TaskStatItem[];
  recentSubmissions: SubItem[];
  uniqueGrades: { id: string; name: string }[];
  uniqueCourses: { id: string; name: string }[];
}

export default function DocenteDashboardClient({
  teacherName,
  courseGroups,
  allTasks,
  recentSubmissions,
  uniqueGrades,
  uniqueCourses,
}: Props) {
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedCourse, setSelectedCourse] = useState<string>("ALL");

  // Filter course-group items based on selected grade and course
  const filteredGroups = useMemo(() => {
    return courseGroups.filter((cg) => {
      const matchGrade = selectedGrade === "ALL" || cg.gradeName === selectedGrade || cg.gradeId === selectedGrade;
      const matchCourse = selectedCourse === "ALL" || cg.courseId === selectedCourse;
      return matchGrade && matchCourse;
    });
  }, [courseGroups, selectedGrade, selectedCourse]);

  // Aggregate stats dynamically based on active filter
  const stats = useMemo(() => {
    const studentSet = new Set<string>();
    const courseSet = new Set<string>();
    let totalTasks = 0;
    let totalPending = 0;

    filteredGroups.forEach((cg) => {
      cg.studentIds.forEach((id) => studentSet.add(id));
      courseSet.add(cg.courseId);
      totalTasks += cg.tasksCount;
      totalPending += cg.pendingCount;
    });

    return {
      studentsCount: studentSet.size,
      coursesCount: courseSet.size,
      tasksCount: totalTasks,
      pendingReviewsCount: totalPending,
    };
  }, [filteredGroups]);

  // Group filtered items by Grade -> Course -> Sorted Groups
  const groupsByGrade = useMemo(() => {
    const gradeMap = new Map<string, Map<string, {
      courseId: string;
      courseName: string;
      gradeId: string;
      gradeName: string;
      groups: CourseGroupItem[];
      totalStudents: number;
      totalTasks: number;
      totalPending: number;
    }>>();

    // Sort naturally by grade, course, and group
    const sorted = [...filteredGroups].sort((a, b) => {
      const gCmp = a.gradeName.localeCompare(b.gradeName, undefined, { numeric: true, sensitivity: "base" });
      if (gCmp !== 0) return gCmp;
      const cCmp = a.courseName.localeCompare(b.courseName, undefined, { sensitivity: "base" });
      if (cCmp !== 0) return cCmp;
      return a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: "base" });
    });

    sorted.forEach((cg) => {
      const gradeLabel = `GRADO ${cg.gradeName.toUpperCase()}`;
      if (!gradeMap.has(gradeLabel)) {
        gradeMap.set(gradeLabel, new Map());
      }
      const courseMap = gradeMap.get(gradeLabel)!;
      if (!courseMap.has(cg.courseId)) {
        courseMap.set(cg.courseId, {
          courseId: cg.courseId,
          courseName: cg.courseName,
          gradeId: cg.gradeId,
          gradeName: cg.gradeName,
          groups: [],
          totalStudents: 0,
          totalTasks: cg.tasksCount,
          totalPending: 0,
        });
      }
      const courseEntry = courseMap.get(cg.courseId)!;
      courseEntry.groups.push(cg);
      courseEntry.totalStudents += cg.studentsCount;
      courseEntry.totalTasks = Math.max(courseEntry.totalTasks, cg.tasksCount);
      courseEntry.totalPending += cg.pendingCount;
    });

    return Array.from(gradeMap.entries()).map(([gradeLabel, courseMap]) => ({
      gradeLabel,
      courses: Array.from(courseMap.values())
    }));
  }, [filteredGroups]);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">¡Hola, {teacherName}!</h1>
          <p className="text-sm text-muted" style={{ color: "var(--text-secondary)" }}>
            Resumen de actividad académica desglosado por <strong className="text-primary" style={{ color: "var(--primary-color)" }}>Grado</strong> y <strong className="text-primary" style={{ color: "var(--primary-color)" }}>Curso</strong>.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted" />
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="ALL">Todos los Grados</option>
              {uniqueGrades.map((g) => (
                <option key={g.id} value={g.name}>
                  Grado {g.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <option value="ALL">Todas las Asignaturas</option>
            {uniqueCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-color)" }}>
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.studentsCount}</div>
            <div className="stat-label">Total Estudiantes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)" }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.coursesCount}</div>
            <div className="stat-label">Asignaturas Activas</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)" }}>
            <ClipboardList size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.tasksCount}</div>
            <div className="stat-label">Tareas Asignadas</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.pendingReviewsCount}</div>
            <div className="stat-label">Entregas por Calificar</div>
          </div>
        </div>
      </div>

      {/* Course Groups Breakdown by Grade */}
      <div className="card flex flex-col gap-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" style={{ color: "var(--primary-color)" }} />
            <h2 className="text-lg font-bold">Resumen por Grado y Asignatura</h2>
          </div>
          <Link href="/docente/cursos" className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline" style={{ color: "var(--primary-color)" }}>
            Gestionar Asignaturas <ArrowRight size={14} />
          </Link>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <BookOpen size={40} className="text-muted opacity-40" />
            <p className="text-muted text-sm max-w-lg leading-relaxed">
              {courseGroups.length === 0
                ? "Para comenzar a usar tu Aula Virtual, primero debes crear el Grado y Grupo (Paso 1) y luego crear la Asignatura vinculándola al grupo correspondiente (Paso 2)."
                : "No se encontraron asignaturas para la combinación de Grado y Asignatura seleccionada en el filtro."}
            </p>
            {courseGroups.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <Link href="/docente/grados?nuevo=true" className="btn btn-secondary text-xs font-semibold py-2 px-4 flex items-center gap-1.5 border">
                  🎓 Paso 1: Crear Grado y Grupo
                </Link>
                <Link href="/docente/cursos?nuevo=true" className="btn btn-primary text-xs font-semibold py-2 px-4 flex items-center gap-1.5">
                  📚 Paso 2: Crear Asignatura
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groupsByGrade.map(({ gradeLabel, courses }) => (
              <div key={gradeLabel} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm font-bold border-b pb-2" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <span className="badge badge-primary" style={{ background: "rgba(37, 99, 235, 0.15)", color: "var(--primary-color)", padding: "0.3rem 0.75rem", fontSize: "0.8rem", fontWeight: "700" }}>
                    {gradeLabel}
                  </span>
                  <span className="text-xs text-muted">
                    ({courses.length} {courses.length === 1 ? "asignatura" : "asignaturas"} · {courses.reduce((acc, c) => acc + c.groups.length, 0)} grupos)
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {courses.map((course) => (
                    <div
                      key={course.courseId}
                      className="p-5 rounded-2xl border flex flex-col gap-4 shadow-sm"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
                    >
                      {/* Course Header Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl text-primary flex items-center justify-center" style={{ background: "rgba(249, 115, 22, 0.1)", color: "var(--primary-color)" }}>
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                              {course.courseName}
                            </h3>
                            <p className="text-xs text-muted">
                              Grado {course.gradeName} · {course.groups.length} {course.groups.length === 1 ? "grupo asignado" : "grupos asignados"}
                            </p>
                          </div>
                        </div>

                        {/* Overall stats pill */}
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="px-3 py-1 rounded-lg border font-semibold text-slate-700 dark:text-slate-300" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                            👥 <strong>{course.totalStudents}</strong> estudiantes
                          </span>
                          <span className="px-3 py-1 rounded-lg border font-semibold text-slate-700 dark:text-slate-300" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                            📝 <strong>{course.totalTasks}</strong> tareas
                          </span>
                          {course.totalTasks === 0 ? (
                            <span className="px-3 py-1 rounded-lg font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Sin tareas asignadas
                            </span>
                          ) : course.totalPending > 0 ? (
                            <span className="px-3 py-1 rounded-lg font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              ⏳ <strong>{course.totalPending}</strong> por calificar
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-lg font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                              ✓ Al día
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Groups Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.85rem" }}>
                        {course.groups.map((cg) => {
                          const dotColor = cg.tasksCount === 0
                            ? "var(--text-muted)"
                            : cg.pendingCount > 0
                            ? "var(--warning)"
                            : cg.gradedCount > 0
                            ? "var(--success)"
                            : "var(--primary-color)";

                          return (
                            <div
                              key={cg.groupId}
                              className="p-3.5 rounded-xl border flex flex-col justify-between gap-3 hover:shadow-md transition-all"
                              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ background: dotColor }}></span>
                                  Grupo {cg.groupName}
                                </span>
                                <span className="text-xs text-muted font-medium">
                                  {cg.studentsCount} est.
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
                                <span>
                                  {cg.tasksCount === 0 ? (
                                    <span className="text-slate-400 dark:text-slate-500">Sin tareas</span>
                                  ) : cg.pendingCount > 0 ? (
                                    <strong className="text-amber-600 dark:text-amber-400">⏳ {cg.pendingCount} por calificar</strong>
                                  ) : cg.gradedCount > 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">✓ Calificado</span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500">Sin entregas</span>
                                  )}
                                </span>
                                <span>
                                  {cg.tasksCount} {cg.tasksCount === 1 ? "tarea" : "tareas"}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <Link
                                  href={`/docente/grados?manageGroupId=${cg.groupId}`}
                                  className="btn btn-secondary text-[11px] font-semibold py-1.5 px-2 justify-center"
                                >
                                  👥 Estudiantes
                                </Link>
                                <Link
                                  href={`/docente/planillas?courseId=${cg.courseId}&groupId=${cg.groupId}`}
                                  className="btn btn-primary text-[11px] font-bold py-1.5 px-2 justify-center !text-white hover:!text-white"
                                >
                                  📊 Planilla
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Charts & Activity Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="flex-col lg:grid">
        {/* Left Column: Submission Rate */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Tasas de Entrega de Tareas Recientes</h2>
          {allTasks.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">Crea tareas para empezar a recopilar estadísticas de entregas.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {allTasks.map((stat) => (
                <div key={stat.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold truncate max-w-[200px]" title={stat.title}>
                      {stat.title}
                    </span>
                    <span className="text-muted">
                      {stat.submitted} / {stat.total} ({stat.rate.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ background: "var(--bg-primary)", height: "12px", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <div
                      style={{
                        background: "var(--primary-color)",
                        width: `${stat.rate}%`,
                        height: "100%",
                        borderRadius: "var(--radius-full)",
                        transition: "width 0.8s ease-out",
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {stat.courseName} • Grado {stat.gradeName} ({stat.groupName})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Live Recent Submissions */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Entregas y Actividad Reciente</h2>
          <EntregasRecientes submissions={recentSubmissions} />
        </div>
      </div>
    </div>
  );
}
