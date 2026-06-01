import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { Users, BookOpen, ClipboardList, TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function DocenteDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) return null;
  const payload = (await jwtVerify(token, JWT_SECRET)).payload as any;
  const teacherId = payload.id as string;

  // 1. Basic Stats
  const studentsCount = await prisma.user.count({ where: { role: "STUDENT" } });
  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: {
      tasks: {
        where: { active: true },
        include: {
          submissions: true
        }
      }
    }
  });
  
  const coursesCount = courses.length;
  
  let tasksCount = 0;
  let pendingReviewsCount = 0;
  courses.forEach(c => {
    tasksCount += c.tasks.length;
    c.tasks.forEach(t => {
      pendingReviewsCount += t.submissions.filter(s => s.status === "SUBMITTED").length;
    });
  });

  // 2. Course Averages for circular charts
  const courseAverages = courses.map(course => {
    let sum = 0;
    let count = 0;
    course.tasks.forEach(t => {
      t.submissions.forEach(s => {
        if (s.status === "GRADED" && s.grade !== null) {
          sum += s.grade;
          count++;
        }
      });
    });
    const avg = count > 0 ? sum / count : null;
    return {
      id: course.id,
      name: course.name,
      average: avg,
      gradedCount: count
    };
  }).filter(c => c.average !== null || c.gradedCount > 0);

  // 3. Task Submission Rates (Recent 4 tasks)
  const allTasks = await prisma.task.findMany({
    where: { course: { teacherId }, active: true },
    include: {
      submissions: true,
      course: true
    },
    orderBy: { createdAt: "desc" },
    take: 4
  });

  const taskStats = allTasks.map(task => {
    const submittedCount = task.submissions.filter(s => s.status !== "PENDING").length;
    const rate = studentsCount > 0 ? (submittedCount / studentsCount) * 100 : 0;
    return {
      id: task.id,
      title: task.title,
      courseName: task.course.name,
      submitted: submittedCount,
      total: studentsCount,
      rate
    };
  });

  // 4. Live Recent Submissions
  const recentSubmissions = await prisma.submission.findMany({
    where: {
      task: { course: { teacherId } },
      status: { in: ["SUBMITTED", "GRADED"] }
    },
    include: {
      student: true,
      task: {
        include: { course: true }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 4
  });

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="dashboard-header">
        <h1>¡Hola, {payload.name}!</h1>
        <p>Resumen de tu actividad académica y estadísticas en tiempo real.</p>
      </div>

      {/* 4 Cards Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-color)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <Users size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Total Estudiantes</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{studentsCount}</div>
          </div>
        </div>

        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <BookOpen size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Cursos Activos</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{coursesCount}</div>
          </div>
        </div>

        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <ClipboardList size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Tareas Asignadas</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{tasksCount}</div>
          </div>
        </div>

        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Entregas por Calificar</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{pendingReviewsCount}</div>
          </div>
        </div>
      </div>

      {/* Main Charts & Activity Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="flex-col lg:grid">
        {/* Left Column: Submission Rate (Bar Chart) */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Tasas de Entrega de Tareas Recientes</h2>
          {taskStats.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">Crea tareas para empezar a recopilar estadísticas de entregas.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {taskStats.map(stat => (
                <div key={stat.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold truncate max-w-[200px]" title={stat.title}>{stat.title}</span>
                    <span className="text-muted">{stat.submitted} / {stat.total} ({stat.rate.toFixed(0)}%)</span>
                  </div>
                  <div style={{ background: "var(--bg-primary)", height: "12px", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <div style={{
                      background: "var(--primary-color)",
                      width: `${stat.rate}%`,
                      height: "100%",
                      borderRadius: "var(--radius-full)",
                      transition: "width 0.8s ease-out"
                    }} />
                  </div>
                  <div className="text-xs text-muted mt-0.5">{stat.courseName}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Course Average Grades (SVG Donut Charts) */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Promedio de Notas por Curso</h2>
          {courseAverages.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">Califica las entregas de tus estudiantes para ver promedios por curso.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", textAlign: "center" }}>
              {courseAverages.map(c => {
                const avg = c.average || 0;
                const percent = (avg / 5) * 100;
                const r = 36;
                const circ = 2 * Math.PI * r;
                const offset = circ - (percent / 100) * circ;
                
                // Color mapping: green if >= 3.5, yellow if >= 3.0, red if lower
                const strokeColor = avg >= 3.5 ? "var(--success)" : avg >= 3.0 ? "var(--warning)" : "var(--danger)";

                return (
                  <div key={c.id} className="flex flex-col items-center p-2 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ position: "relative", width: "90px", height: "90px" }}>
                      <svg width="90" height="90" viewBox="0 0 90 90">
                        {/* Background circle */}
                        <circle cx="45" cy="45" r={r} stroke="var(--border-color)" strokeWidth="6" fill="transparent" />
                        {/* Progress circle */}
                        <circle
                          cx="45"
                          cy="45"
                          r={r}
                          stroke={strokeColor}
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={circ}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          transform="rotate(-90 45 45)"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        />
                      </svg>
                      {/* Inside text */}
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: strokeColor }}>{avg.toFixed(1)}</span>
                        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "-2px" }}>/ 5.0</span>
                      </div>
                    </div>
                    <span className="font-semibold text-xs mt-2 truncate w-full" title={c.name}>{c.name}</span>
                    <span className="text-muted" style={{ fontSize: "0.65rem" }}>{c.gradedCount} tareas calificadas</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="card w-full">
        <h2 className="text-lg font-bold mb-4">Entregas y Actividad Reciente</h2>
        {recentSubmissions.length === 0 ? (
          <div className="p-4 border rounded-md text-center text-muted text-sm" style={{ borderColor: "var(--border-color)" }}>
            Aún no hay entregas de estudiantes para calificar o mostrar.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {recentSubmissions.map(sub => {
              const isGraded = sub.status === "GRADED";
              return (
                <div key={sub.id} className="flex justify-between items-center p-3 rounded-lg border-l-4" style={{
                  background: "var(--bg-primary)",
                  borderColor: isGraded ? "var(--success)" : "var(--info)",
                  borderTop: "1px solid var(--border-color)",
                  borderRight: "1px solid var(--border-color)",
                  borderBottom: "1px solid var(--border-color)"
                }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{sub.student.name}</span>
                      <span className="text-xs text-muted">• {sub.task.course.name}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Entregó la tarea: <strong style={{ color: "var(--text-primary)" }}>{sub.task.title}</strong>
                    </p>
                    <span className="text-[10px] text-muted">{sub.updatedAt ? new Date(sub.updatedAt).toLocaleString("es-CO") : ""}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isGraded ? (
                      <span className="badge badge-success flex items-center gap-1"><CheckCircle size={10} /> Nota: {sub.grade}</span>
                    ) : (
                      <span className="badge badge-info flex items-center gap-1"><Clock size={10} /> Por Calificar</span>
                    )}
                    <Link href={`/docente/tareas/${sub.taskId}`} className="btn btn-secondary text-xs px-2 py-1">
                      Ver Tarea
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
