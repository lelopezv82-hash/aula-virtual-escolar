import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { Users, GraduationCap, BookOpen, ClipboardList, PlusCircle, ArrowRight, UserPlus, Clock } from "lucide-react";
import Link from "next/link";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) return null;
  const payload = (await jwtVerify(token, JWT_SECRET)).payload as any;

  // Basic Stats
  const teachersCount = await prisma.user.count({ where: { role: "TEACHER" } });
  const studentsCount = await prisma.user.count({ where: { role: "STUDENT" } });
  const coursesCount = await prisma.course.count();
  const tasksCount = await prisma.task.count();

  // Recent Users created
  const recentUsers = await prisma.user.findMany({
    where: {
      role: { in: ["TEACHER", "STUDENT"] }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  // Grade breakdown
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { grade: true }
  });

  const gradeCounts: Record<string, number> = {};
  students.forEach(s => {
    const g = s.grade || "Sin Grado";
    gradeCounts[g] = (gradeCounts[g] || 0) + 1;
  });

  const gradeStats = Object.entries(gradeCounts).map(([grade, count]) => ({
    grade,
    count,
    percentage: students.length > 0 ? (count / students.length) * 100 : 0
  })).sort((a, b) => a.grade.localeCompare(b.grade));

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="dashboard-header">
        <h1>¡Bienvenido, {payload.name}!</h1>
        <p>Panel de Administración General del Sistema. Administra docentes, estudiantes y configuraciones globales.</p>
      </div>

      {/* 4 Cards Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.1)", color: "indigo", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <GraduationCap size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Total Docentes</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{teachersCount}</div>
          </div>
        </div>

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
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Cursos en el Sistema</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{coursesCount}</div>
          </div>
        </div>

        <div className="card stat-card" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
            <ClipboardList size={28} />
          </div>
          <div className="stat-info">
            <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Tareas Creadas</h3>
            <div className="value" style={{ fontSize: "1.75rem", fontWeight: "bold" }}>{tasksCount}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }} className="flex-col lg:grid">
        {/* Left Column: Recent Registrations & Actions */}
        <div className="card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Usuarios Registrados Recientemente</h2>
            <Link href="/admin/estudiantes" className="text-xs text-blue-600 flex items-center gap-1 font-semibold hover:underline">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          
          {recentUsers.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">No hay usuarios creados en el sistema.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentUsers.map(user => {
                const isTeacher = user.role === "TEACHER";
                return (
                  <div key={user.id} className="flex justify-between items-center p-3 rounded-lg border" style={{
                    background: "var(--bg-primary)",
                    borderColor: "var(--border-color)"
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{
                        width: 38,
                        height: 38,
                        background: isTeacher ? "rgba(99, 102, 241, 0.1)" : "rgba(37, 99, 235, 0.1)",
                        color: isTeacher ? "indigo" : "var(--primary-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        fontWeight: "bold"
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{user.name}</div>
                        <div className="text-xs text-muted">@{user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`badge ${isTeacher ? "badge-success" : "badge-info"}`}>
                        {isTeacher ? "Docente" : "Estudiante"}
                      </span>
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <Clock size={12} /> {new Date(user.createdAt).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Grade Distribution / General Quick Actions */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-bold">Distribución por Grados</h2>
          {gradeStats.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">Registra estudiantes para ver la distribución de grados.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {gradeStats.map(stat => (
                <div key={stat.grade}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold">Grado {stat.grade}</span>
                    <span className="text-muted">{stat.count} estudiantes ({stat.percentage.toFixed(0)}%)</span>
                  </div>
                  <div style={{ background: "var(--bg-primary)", height: "8px", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <div style={{
                      background: "var(--primary-color)",
                      width: `${stat.percentage}%`,
                      height: "100%",
                      borderRadius: "var(--radius-full)",
                      transition: "width 0.8s ease-out"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "0.5rem 0" }} />

          <h3 className="font-bold text-sm">Acciones Rápidas</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link href="/admin/docentes" className="btn btn-secondary w-full text-center flex justify-center items-center gap-2">
              <UserPlus size={16} /> Gestionar Docentes
            </Link>
            <Link href="/admin/estudiantes" className="btn btn-primary w-full text-center flex justify-center items-center gap-2">
              <UserPlus size={16} /> Gestionar Estudiantes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
