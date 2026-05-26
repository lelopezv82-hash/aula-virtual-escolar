import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { Bell, BookOpen, ClipboardList, Star } from "lucide-react";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function NotificacionesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  // Build notifications from recent activity
  const recentTasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { course: true }
  });

  const recentResources = await prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { course: true }
  });

  const recentGrades = await prisma.submission.findMany({
    where: { studentId, status: "GRADED" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: { task: { include: { course: true } } }
  });

  // Merge into a single timeline
  type Notification = {
    id: string;
    type: "TASK" | "RESOURCE" | "GRADE";
    title: string;
    subtitle: string;
    date: Date;
    extra?: string;
  };

  const notifications: Notification[] = [];

  recentTasks.forEach(t => {
    notifications.push({
      id: `task-${t.id}`,
      type: "TASK",
      title: `Nueva tarea: ${t.title}`,
      subtitle: t.course.name,
      date: t.createdAt,
      extra: `Vence: ${new Date(t.dueDate).toLocaleDateString()}`
    });
  });

  recentResources.forEach(r => {
    notifications.push({
      id: `res-${r.id}`,
      type: "RESOURCE",
      title: `Nuevo recurso: ${r.title}`,
      subtitle: r.course.name,
      date: r.createdAt,
      extra: r.type
    });
  });

  recentGrades.forEach(s => {
    notifications.push({
      id: `grade-${s.id}`,
      type: "GRADE",
      title: `Tarea calificada: ${s.task.title}`,
      subtitle: s.task.course.name,
      date: s.updatedAt,
      extra: `Nota: ${s.grade?.toFixed(1)}`
    });
  });

  // Sort by date descending
  notifications.sort((a, b) => b.date.getTime() - a.date.getTime());

  const iconMap = {
    TASK: <ClipboardList size={22} />,
    RESOURCE: <BookOpen size={22} />,
    GRADE: <Star size={22} />
  };

  const colorMap = {
    TASK: "var(--primary-color)",
    RESOURCE: "var(--success)",
    GRADE: "var(--warning)"
  };

  const bgMap = {
    TASK: "rgba(37, 99, 235, 0.1)",
    RESOURCE: "rgba(16, 185, 129, 0.1)",
    GRADE: "rgba(245, 158, 11, 0.1)"
  };

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Notificaciones</h1>
        <p>Mantente al día con las novedades de tus cursos.</p>
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <Bell size={48} className="mx-auto mb-4 opacity-40" />
          <p>No hay notificaciones por el momento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map(n => (
            <div key={n.id} className="card flex items-center gap-4"
              style={{ padding: "1rem 1.5rem", borderLeft: `4px solid ${colorMap[n.type]}` }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: "flex",
                alignItems: "center", justifyContent: "center",
                background: bgMap[n.type], color: colorMap[n.type], flexShrink: 0
              }}>
                {iconMap[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{n.title}</p>
                <p className="text-sm text-muted">{n.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                {n.extra && (
                  <span className="badge badge-info text-xs mb-1 block">{n.extra}</span>
                )}
                <p className="text-xs text-muted">
                  {n.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
