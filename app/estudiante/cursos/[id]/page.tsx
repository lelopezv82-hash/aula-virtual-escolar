import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (d.getFullYear() >= 9000) return null;
    return d.toLocaleString("es-CO", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota",
    });
  } catch {
    return dateStr;
  }
}

function TaskIcon({ isGraded, isSubmitted }: { isGraded: boolean; isSubmitted: boolean }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 6,
      background: "#fce4ec", border: "1px solid #f48fb1",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2185b" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
  );
}

function ResourceIcon({ type }: { type: string }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 4,
      background: "#e3f2fd", border: "1px solid #90caf9",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  );
}

export default async function CursoDescripcionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const course = await prisma.course.findUnique({
    where: { id },
    select: { hiddenSections: true }
  });
  const hiddenSections = Array.isArray(course?.hiddenSections) ? (course?.hiddenSections as string[]) : [];

  if (hiddenSections.includes("descripcion")) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        padding: "3rem",
        textAlign: "center",
        color: "#6c757d",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#333", marginBottom: "0.25rem" }}>Sección Oculta</h2>
        <p style={{ fontSize: "0.875rem" }}>El docente ha desactivado la visibilidad de la sección de descripción/contenido para este curso.</p>
      </div>
    );
  }

  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  const activePeriodNames = periodsDb.map(p => p.name);

  const now = new Date();

  // Fetch all tasks and exams (active periods only)
  const tasks = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      isExternal: false,
      type: { in: ["TASK", "TASK_SABER", "SABER", "EXAM", "FINAL"] },
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        {
          OR: [
            { groups: { none: {} } },
            ...(studentGroupId ? [{ groups: { some: { id: studentGroupId } } }] : []),
            { assignedStudents: { some: { id: studentId } } }
          ]
        }
      ],
    },
    include: {
      submissions: { where: { studentId } },
      resources: true,
    },
    orderBy: { dueDate: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Actividades</h2>

      {tasks.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "10px",
          padding: "3rem",
          textAlign: "center",
          color: "#6c757d",
          fontSize: "0.95rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          No hay actividades disponibles en este curso todavía.
        </div>
      ) : (
        <div style={{
          background: "#ffffff",
          border: "1px solid #dee2e6",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          {tasks.map((task, idx) => {
            const submission = task.submissions[0];
            const hasActiveExtension = !!(submission?.allowLateSubmission || task.allowLateSubmission);
            const hasUploadedFile = !!(submission?.fileUrl && submission.fileUrl.trim() !== "");
            const isAutomaticGrade1 = (submission?.grade === 1 || submission?.grade === 1.0) && hasActiveExtension && !hasUploadedFile;

            const isSubmitted = !!(submission && (submission.status !== "PENDING" || (submission.grade != null && !isAutomaticGrade1) || hasUploadedFile));
            const isGraded = !!(submission && ((submission.status === "GRADED" && !isAutomaticGrade1) || (submission.grade != null && !isAutomaticGrade1)));

            const href = task.id.startsWith("ex-")
              ? "#"
              : (task.type === "EXAM" || task.type === "FINAL")
                ? `/estudiante/examenes/${task.id}`
                : `/estudiante/tareas/${task.id}`;

            const apertura = formatDate(task.publishAt ? task.publishAt.toISOString() : null);
            const cierre = formatDate(task.dueDate ? task.dueDate.toISOString() : null);
            const cleanDesc = task.description
              ? task.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
              : null;

            const deadlineStatus = getTaskDeadlineStatus(
              {
                dueDate: task.dueDate.toISOString(),
                allowLateSubmission: !!task.allowLateSubmission,
                lateSubmissionUntil: task.lateSubmissionUntil ? task.lateSubmissionUntil.toISOString() : null,
                type: task.type,
              },
              {
                allowLateSubmission: !!submission?.allowLateSubmission,
                lateSubmissionUntil: submission?.lateSubmissionUntil ? submission.lateSubmissionUntil.toISOString() : null,
              }
            );

            const hasExtension = deadlineStatus && deadlineStatus.isLate && !deadlineStatus.isClosed;
            const isClosedWithoutSubmission = !isSubmitted && !hasExtension && deadlineStatus?.isClosed && !task.isExternal;

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                  padding: "1rem 1.25rem",
                  borderBottom: idx < tasks.length - 1 ? "1px solid #f1f3f5" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
                  <TaskIcon isGraded={isGraded} isSubmitted={isSubmitted} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <Link
                        href={href}
                        style={{ color: "#0066cc", fontWeight: 600, fontSize: "0.95rem", textDecoration: "none" }}
                      >
                        {task.title}
                      </Link>
                      {isGraded && (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                          borderRadius: 3,
                          background: "#d4edda", color: "#155724",
                          border: "1px solid #b8ddbf",
                        }}>
                          ✓ Calificado
                        </span>
                      )}
                      {isSubmitted && !isGraded && (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                          borderRadius: 3, background: "#fff3cd", color: "#856404",
                          border: "1px solid #ffc107",
                        }}>
                          Pendiente por calificar
                        </span>
                      )}
                      {hasExtension && !isSubmitted && (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                          borderRadius: 3, background: "#fff7ed", color: "#c2410c",
                          border: "1px solid #ffedd5",
                        }}>
                          ⏰ Prórroga Activa
                        </span>
                      )}
                      {isClosedWithoutSubmission && (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                          borderRadius: 3,
                          background: "#f8d7da", color: "#721c24",
                          border: "1px solid #f5c6cb",
                        }}>
                          Cerrada nota 1
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.2rem" }}>
                      {apertura && (
                        <span><span style={{ fontWeight: 600 }}>Apertura:</span> {apertura}</span>
                      )}
                      {apertura && cierre && <span style={{ margin: "0 0.5rem", color: "#cbd5e1" }}> · </span>}
                      {cierre && (
                        <span><span style={{ fontWeight: 600 }}>Cierre:</span> {cierre}</span>
                      )}
                    </div>

                    {hasExtension && !isSubmitted && deadlineStatus && (
                      <div style={{
                        marginTop: "0.4rem",
                        padding: "0.5rem 0.75rem",
                        background: "#fff7ed",
                        border: "1px solid #ffedd5",
                        borderRadius: "6px",
                        color: "#9a3412",
                        fontSize: "0.78rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px"
                      }}>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>⏰</span> Plazo Extemporáneo Activo
                        </div>
                        <div>
                          {deadlineStatus.isUnlimitedExtension
                            ? "El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde sin fecha de expiración."
                            : `El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde hasta el ${formatToColombiaString(deadlineStatus.activeDeadline)}.`}
                        </div>
                      </div>
                    )}

                    {cleanDesc && (
                      <div style={{
                        fontSize: "0.82rem", color: "#475569",
                        marginTop: "0.3rem", lineHeight: 1.4,
                      }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Instrucciones: </span>{cleanDesc}
                      </div>
                    )}
                  </div>
                </div>

                {/* Nested Attached Guides / Materials under Task */}
                {((task.attachmentUrl) || (task.resources && task.resources.length > 0)) && (
                  <div style={{
                    marginLeft: "2.75rem",
                    marginTop: "0.35rem",
                    padding: "0.5rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem"
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>
                      Material adjunto de la tarea:
                    </div>
                    {task.attachmentUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <ResourceIcon type={task.attachmentUrl.split('.').pop() || "FILE"} />
                        <a href={task.attachmentUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0284c7", textDecoration: "none", fontWeight: 500 }}>
                          Descargar Guía de la Tarea
                        </a>
                      </div>
                    )}
                    {task.resources?.map(res => (
                      <div key={res.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <ResourceIcon type={res.type} />
                        <a href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0284c7", textDecoration: "none", fontWeight: 500 }}>
                          {res.title}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
