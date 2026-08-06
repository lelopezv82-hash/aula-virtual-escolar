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

  // Group filtered items by Grade for clean layout
  const groupsByGrade = useMemo(() => {
    const map = new Map<string, CourseGroupItem[]>();
    filteredGroups.forEach((cg) => {
      const label = `Grado ${cg.gradeName}`;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(cg);
    });
    return Array.from(map.entries());
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

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 bg-body p-2 rounded-lg border" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1 text-xs font-semibold px-2" style={{ color: "var(--text-secondary)" }}>
            <Filter size={14} />
            <span>Filtrar:</span>
          </div>

          {/* Grade Filter Dropdown */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="text-xs p-2 rounded-md border font-medium bg-card"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <option value="ALL">🎓 Todos los Grados</option>
            {uniqueGrades.map((g) => (
              <option key={g.id} value={g.name}>
                Grado {g.name}
              </option>
            ))}
          </select>

          {/* Course Filter Dropdown */}
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="text-xs p-2 rounded-md border font-medium bg-card"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <option value="ALL">📚 Todos los Cursos</option>
            {uniqueCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {(selectedGrade !== "ALL" || selectedCourse !== "ALL") && (
            <button
              onClick={() => {
                setSelectedGrade("ALL");
                setSelectedCourse("ALL");
              }}
              className="text-xs text-primary underline px-2 font-medium"
              style={{ color: "var(--primary-color)" }}
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* 4 Cards Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
        {/* Total Estudiantes Card */}
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-color)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <Users size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              Total Estudiantes
            </h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>
              {stats.studentsCount}
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {selectedGrade !== "ALL" || selectedCourse !== "ALL" ? "En selección actual" : "En tus cursos y grados"}
            </span>
          </div>
        </div>

        {/* Cursos Activos Card */}
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <BookOpen size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Cursos Activos</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{stats.coursesCount}</div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Asignaturas registradas</span>
          </div>
        </div>

        {/* Tareas Asignadas Card */}
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <ClipboardList size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Tareas Asignadas</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{stats.tasksCount}</div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Publicadas y activas</span>
          </div>
        </div>

        {/* Entregas por Calificar Card */}
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Entregas por Calificar</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{stats.pendingReviewsCount}</div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Pendientes de revisión</span>
          </div>
        </div>
      </div>

      {/* Main Section: Breakdown by Grade and Course */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <GraduationCap className="text-primary" size={22} style={{ color: "var(--primary-color)" }} />
            <h2 className="text-lg font-bold">Resumen por Grado y Asignatura</h2>
          </div>
          <Link href="/docente/cursos" className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline" style={{ color: "var(--primary-color)" }}>
            Gestionar Asignaturas <ArrowRight size={14} />
          </Link>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <BookOpen size={40} className="text-muted opacity-40" />
            <p className="text-muted text-sm max-w-md">
              {courseGroups.length === 0
                ? "No tienes asignaturas ni grupos de grado asignados actualmente. Crea una asignatura y asígnale un grado/grupo en 'Gestión Asignaturas' para ver el resumen detallado por grado y asignatura."
                : "No se encontraron asignaturas para la combinación de Grado y Asignatura seleccionada en el filtro."}
            </p>
            {courseGroups.length === 0 && (
              <Link href="/docente/cursos?nuevo=true" className="btn btn-primary text-xs font-semibold mt-2">
                + Crear Asignatura / Asignar Grado
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupsByGrade.map(([gradeTitle, items]) => (
              <div key={gradeTitle} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold border-b pb-1.5" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <span className="badge badge-primary" style={{ background: "rgba(37, 99, 235, 0.15)", color: "var(--primary-color)", padding: "0.25rem 0.6rem" }}>
                    {gradeTitle}
                  </span>
                  <span className="text-xs text-muted">({items.length} {items.length === 1 ? "curso/grupo" : "cursos/grupos"})</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                  {items.map((cg) => (
                    <div
                      key={`${cg.courseId}-${cg.groupId}`}
                      className="p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all hover:shadow-md"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-base truncate" title={cg.courseName}>
                            {cg.courseName}
                          </h3>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)" }}>
                            Grupo {cg.groupName}
                          </span>
                        </div>
                        <p className="text-xs text-muted">Grado {cg.gradeName}</p>
                      </div>

                      {/* Mini stats row */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                        <div>
                          <div className="text-xs text-muted font-medium">Estudiantes</div>
                          <div className="font-bold text-sm text-primary" style={{ color: "var(--primary-color)" }}>
                            {cg.studentsCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted font-medium">Tareas</div>
                          <div className="font-bold text-sm">{cg.tasksCount}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted font-medium">Por Calificar</div>
                          <div className="font-bold text-sm" style={{ color: cg.pendingCount > 0 ? "var(--warning)" : "var(--text-secondary)" }}>
                            {cg.pendingCount}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          href={`/docente/estudiantes?groupId=${cg.groupId}`}
                          className="btn btn-secondary text-[11px] flex-1 justify-center py-1.5"
                        >
                          👥 Ver Estudiantes ({cg.studentsCount})
                        </Link>
                        <Link
                          href={`/docente/cursos/${cg.courseId}/calificaciones`}
                          className="btn btn-primary text-[11px] flex-1 justify-center py-1.5"
                        >
                          📊 Calificaciones
                        </Link>
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
