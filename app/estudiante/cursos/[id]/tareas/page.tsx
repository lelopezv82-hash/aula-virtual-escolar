import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatToColombiaString, getTaskDeadlineStatus } from '@/lib/dateUtils';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CursoTareasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { id } = await params;
  const { estado } = await searchParams;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true },
  });
  const studentGroupId = studentRecord?.groupId || null;

  const activePeriodsFromDb = await prisma.period.findMany({ where: { active: true } });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      type: "TASK",
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: { submissions: { where: { studentId } } },
    orderBy: { createdAt: "desc" },
  });

  const filtered = tasks.filter(task => {
    const submission = task.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(task, submission);
    const isSubmitted = submission && submission.status !== "PENDING";
    const isVirtuallyClosed = (!submission && isClosed) || (submission && submission.status === "PENDING" && isClosed);

    if (estado === "entregadas") return isSubmitted;
    // default: pendientes
    return !isSubmitted && !isVirtuallyClosed;
  });

  const showingEntregadas = estado === "entregadas";

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">
        Tareas — {showingEntregadas ? "Entregadas" : "Pendientes"}
      </h2>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <ClipboardList size={44} className="mx-auto mb-4 opacity-40" />
          <p>{showingEntregadas ? "No has entregado ninguna tarea todavía." : "No tienes tareas pendientes en esta asignatura."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(task => {
            const submission = task.submissions[0];
            const isSubmitted = submission && submission.status !== "PENDING";
            const isGraded = submission && submission.status === "GRADED";
            const { activeDeadline, hasExtension, isLate } = getTaskDeadlineStatus(task, submission);

            const leftBorderColor = isGraded
              ? (submission.grade !== null && Number(submission.grade) < 3 ? 'var(--danger)' : 'var(--success)')
              : isLate ? 'var(--danger)' : 'var(--primary-color)';

            return (
              <div
                key={task.id}
                style={{
                  background: "var(--bg-primary)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-color)",
                  borderLeft: `4px solid ${leftBorderColor}`,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {isGraded && (
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle size={12} /> Calificada
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info flex items-center gap-1">
                        <Clock size={12} /> Entregada
                      </span>
                    )}
                    {!isSubmitted && isLate && <span className="badge badge-danger">Atrasada</span>}
                    {task.isExternal && (
                      <span className="badge bg-blue-50 text-blue-700 border border-blue-200" style={{ fontSize: "10px", fontWeight: "bold" }}>
                        Presencial
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base mb-0.5" style={{ color: "var(--primary-color)" }}>{task.title}</h3>
                  <p className="text-sm text-muted truncate">{task.description || "Sin descripción"}</p>
                  <div className="flex items-center gap-1 text-xs text-muted mt-1">
                    <Clock size={12} />
                    <span>Vence: {formatToColombiaString(activeDeadline)} {hasExtension && "(Prórroga)"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  {isGraded && submission && submission.grade !== null && submission.grade !== undefined && (
                    <div style={{ textAlign: "center", minWidth: "60px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: leftBorderColor, lineHeight: 1 }}>
                        {Number(submission.grade).toFixed(1)}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>nota</div>
                    </div>
                  )}
                  <div>
                    <Link href={`/estudiante/tareas/${task.id}`} className={`btn ${isSubmitted || task.isExternal ? 'btn-secondary' : 'btn-primary'}`}>
                      {isSubmitted ? 'Ver Calificación' : task.isExternal ? 'Ver Actividad' : 'Subir Tarea'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
