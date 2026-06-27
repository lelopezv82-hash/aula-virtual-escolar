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

  const pendingTasks = tasks.filter(task => {
    // External tasks have nothing to submit — never shown in Pendientes
    if (task.isExternal) return false;
    const submission = task.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(task, submission);
    const virtualGraded = (!submission && isClosed) || (submission && submission.status === "PENDING" && isClosed);
    const isSubmitted = submission && submission.status !== "PENDING";
    return !isSubmitted && !virtualGraded;
  });

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Tareas</h1>
        <p>Revisa y envía tus asignaciones pendientes.</p>
      </div>

      <div className="flex flex-col gap-4">
        {pendingTasks.length === 0 ? (
          <div className="card text-center py-8 text-muted">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
            <p>No tienes tareas pendientes en este momento.</p>
          </div>
        ) : (
          pendingTasks.map(task => {
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

            const leftBorderColor = isSubmitted
              ? (isGraded && activeGrade !== null && Number(activeGrade) < 3.0 ? 'var(--danger)' : 'var(--success)')
              : isLate ? 'var(--danger)' : 'var(--primary-color)';

            const gradeColor = isGraded
              ? (activeGrade !== null && Number(activeGrade) >= 3 ? 'var(--success)' : 'var(--danger)')
              : 'var(--text-muted)';

            return (
              <div key={task.id}
                style={{
                  background: "var(--bg-primary)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: "var(--radius-lg)",
                  border: `1px solid var(--border-color)`,
                  borderLeft: `4px solid ${leftBorderColor}`,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Left: info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", background: "#f3f4f6", borderRadius: "4px", color: "#4b5563" }}>
                      {task.course.name}
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>En línea</span>
                    {isGraded && (
                      <span className={`badge flex items-center gap-1 ${gradeReason ? 'badge-danger' : 'badge-success'}`}>
                        <CheckCircle size={12} /> Calificada
                      </span>
                    )}
                    {isGraded && gradeReason && (
                      <span className="text-xs text-red-500 dark:text-red-400 font-semibold">
                        — {gradeReason}
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> Entregada</span>
                    )}
                    {!isSubmitted && isLate && (
                      <span className="badge badge-danger">Atrasada</span>
                    )}
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.25rem", color: "var(--primary-color)" }}>{task.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 0.5rem 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <Clock size={12} />
                    <span>Vence: {formatToColombiaString(activeDeadline)} {hasExtension && "(Prórroga)"}</span>
                  </div>
                </div>

                {/* Right: grade + action */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", minWidth: "120px", textAlign: "center" }}>
                  {isGraded && activeGrade !== null ? (
                    <>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                        {Number(activeGrade).toFixed(1)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
                    </>
                  ) : isSubmitted && !isGraded ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Pendiente de revisión
                    </div>
                  ) : null}

                  {!(isClosed && neverSubmitted) && (
                    <Link href={`/estudiante/tareas/${task.id}`} className={`btn w-full md:w-auto ${isSubmitted ? 'btn-secondary' : 'btn-primary'}`}>
                      {isSubmitted ? 'Ver Entrega' : 'Subir Tarea'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
