import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatToColombiaString, getTaskDeadlineStatus } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareasEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      active: true,
      type: "TASK",
      OR: [
        { period: null },
        { period: { in: activePeriodNames } }
      ],
      AND: [
        {
          OR: [
            { publishAt: null },
            { publishAt: { lte: now } }
          ]
        }
      ],
      groups: studentGroupId ? {
        some: {
          id: studentGroupId
        }
      } : { none: {} }
    },
    include: {
      course: true,
      submissions: {
        where: { studentId }
      }
    },
    orderBy: { createdAt: "desc" }
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
            const { activeDeadline, hasExtension, isClosed, isLate } = getTaskDeadlineStatus(task, submission);
            const virtualGraded = (!submission && isClosed) || (submission && submission.status === "PENDING" && isClosed);

            const activeStatus = submission && submission.status !== "PENDING"
              ? submission.status
              : virtualGraded ? "GRADED" : (submission?.status || null);
            const activeGrade = submission && submission.status !== "PENDING"
              ? (submission.grade !== null && submission.grade !== undefined ? Math.max(1.0, submission.grade) : null)
              : virtualGraded ? 1.0 : null;

            // Determine reason for minimum grade
            const neverSubmitted = !submission || submission.status === "PENDING";
            const gradeReason = virtualGraded && neverSubmitted ? "No entregó" : null;

            const isSubmitted = activeStatus && activeStatus !== "PENDING";
            const isGraded = activeStatus === "GRADED";

            return (
              <div key={task.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderLeft: isSubmitted ? '4px solid var(--success)' : isLate ? '4px solid var(--danger)' : '4px solid var(--primary-color)' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {task.course.name}
                    </span>
                    {isGraded && (
                      <span className={`badge flex items-center gap-1 ${gradeReason ? 'badge-danger' : 'badge-success'}`}>
                        <CheckCircle size={12} /> Calificada: {activeGrade !== null ? Number(activeGrade).toFixed(1) : ""}
                      </span>
                    )}
                    {isGraded && gradeReason && (
                      <span className="text-xs text-red-500 dark:text-red-400 font-semibold">
                        — {gradeReason}
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
                    Vence: {formatToColombiaString(activeDeadline)} {hasExtension && "(Prórroga)"}
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
