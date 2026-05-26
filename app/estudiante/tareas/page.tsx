import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareasEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  // En un sistema completo, solo buscaría tareas de los cursos en los que está matriculado
  // Aquí traemos todas las tareas para el MVP y vemos si ya tiene submission
  const tasks = await prisma.task.findMany({
    include: {
      course: true,
      submissions: {
        where: { studentId }
      }
    },
    orderBy: { dueDate: "asc" }
  });

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Tareas</h1>
        <p>Revisa y envía tus asignaciones pendientes.</p>
      </div>

      <div className="flex flex-col gap-4">
        {tasks.length === 0 ? (
          <div className="card text-center py-8 text-muted">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
            <p>No tienes tareas asignadas en este momento.</p>
          </div>
        ) : (
          tasks.map(task => {
            const submission = task.submissions[0];
            const isLate = new Date() > new Date(task.dueDate);
            const isSubmitted = submission && submission.status !== "PENDING";
            const isGraded = submission && submission.status === "GRADED";

            return (
              <div key={task.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderLeft: isSubmitted ? '4px solid var(--success)' : isLate ? '4px solid var(--danger)' : '4px solid var(--primary-color)' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {task.course.name}
                    </span>
                    {isGraded && (
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle size={12} /> Calificada: {submission.grade}
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info">Entregada</span>
                    )}
                    {!isSubmitted && isLate && (
                      <span className="badge badge-danger">Atrasada</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-primary">{task.title}</h3>
                  <p className="text-sm text-muted line-clamp-2 mt-1">{task.description}</p>
                </div>

                <div className="flex flex-col md:items-end gap-2 min-w-[200px]">
                  <div className="text-sm text-muted flex items-center gap-1">
                    <Clock size={16} /> 
                    Vence: {new Date(task.dueDate).toLocaleString()}
                  </div>
                  
                  <Link href={`/estudiante/tareas/${task.id}`} className={`btn w-full md:w-auto ${isSubmitted ? 'btn-secondary' : 'btn-primary'}`}>
                    {isSubmitted ? 'Ver Entrega' : 'Subir Tarea'}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
