import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
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
      type: { in: ["TASK", "SER", "ATTEND"] },
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: { submissions: { where: { studentId } } },
    orderBy: { dueDate: "asc" },
  });

  const filtered = tasks.filter(task => {
    const submission = task.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(task, submission);
    const isSubmitted = submission && submission.status !== "PENDING";
    const isVirtuallyClosed = !task.isExternal && ((!submission && isClosed) || (submission && submission.status === "PENDING" && isClosed));

    if (estado === "entregadas") {
      if (task.isExternal) return true;
      return !!isSubmitted;
    }
    if (task.isExternal) return false;
    return !isSubmitted && !isVirtuallyClosed;
  });

  const showingEntregadas = estado === "entregadas";

  return (
    <div>
      <style>{`.moodle-link:hover { text-decoration: underline !important; }`}</style>
      {/* Moodle-style page header */}
      <h2 style={{
        fontSize: "1.5rem",
        fontWeight: 700,
        color: "#333",
        marginBottom: "1.5rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #dee2e6",
      }}>
        Tareas — {showingEntregadas ? "Entregadas" : "Pendientes"}
      </h2>

      {filtered.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          padding: "3rem 2rem",
          textAlign: "center",
          color: "#6c757d",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem" }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p style={{ fontSize: "0.95rem" }}>
            {showingEntregadas ? "No has entregado ninguna tarea todavía." : "No tienes tareas pendientes en esta asignatura."}
          </p>
        </div>
      ) : (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          overflow: "hidden",
        }}>
          {filtered.map((task, idx) => {
            const submission = task.submissions[0];
            const isSubmitted = submission && submission.status !== "PENDING";
            const isGraded = submission && submission.status === "GRADED";
            const isLate = submission?.submittedAt && new Date(submission.submittedAt) > new Date(task.dueDate);
            const { activeDeadline, hasExtension } = getTaskDeadlineStatus(task, submission);

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 1.25rem",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #dee2e6" : "none",
                  background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                }}
              >
                {/* Task icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "4px",
                  background: isGraded ? "#d4edda" : isSubmitted ? "#cce5ff" : "#fff3cd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: `1px solid ${isGraded ? "#b8ddbf" : isSubmitted ? "#b3d4f0" : "#f0dfa0"}`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={isGraded ? "#155724" : isSubmitted ? "#004085" : "#856404"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>

                {/* Task info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/estudiante/tareas/${task.id}`}
                    className="moodle-link"
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: "#0066cc",
                      textDecoration: "none",
                    }}
                  >
                    {task.title}
                  </Link>
                  <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "0.2rem" }}>
                    Vence: {formatToColombiaString(activeDeadline)}
                    {hasExtension && <span style={{ marginLeft: 6, color: "#856404" }}>(Prórroga)</span>}
                    {isLate && <span style={{ marginLeft: 6, color: "#dc3545", fontWeight: 600 }}>· Tardía</span>}
                  </div>
                </div>

                {/* Status badge + grade */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                  {isGraded && submission.grade !== null && submission.grade !== undefined && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color: Number(submission.grade) >= 3 ? "#155724" : "#721c24",
                        lineHeight: 1,
                      }}>
                        {Number(submission.grade).toFixed(1)}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#6c757d" }}>/ 5.0</div>
                    </div>
                  )}

                  <span style={{
                    display: "inline-block",
                    padding: "0.25rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "3px",
                    background: isGraded ? "#d4edda" : isSubmitted ? "#cce5ff" : "#fff3cd",
                    color: isGraded ? "#155724" : isSubmitted ? "#004085" : "#856404",
                    border: `1px solid ${isGraded ? "#b8ddbf" : isSubmitted ? "#b3d4f0" : "#f0dfa0"}`,
                    whiteSpace: "nowrap",
                  }}>
                    {isGraded ? "✓ Calificada" : isSubmitted ? "Entregada" : "Pendiente"}
                  </span>

                  <Link
                    href={`/estudiante/tareas/${task.id}`}
                    style={{
                      padding: "0.35rem 0.85rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRadius: "3px",
                      background: isSubmitted ? "#f8f9fa" : "#f98012",
                      color: isSubmitted ? "#333" : "#fff",
                      border: `1px solid ${isSubmitted ? "#dee2e6" : "#e06d09"}`,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isGraded ? "Ver calificación" : isSubmitted ? "Ver entrega" : "Subir tarea"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
