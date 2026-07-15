import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import ExamenCardAcciones from "@/app/estudiante/examenes/ExamenCardAcciones";
import { formatToColombiaString, getTaskDeadlineStatus } from '@/lib/dateUtils';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CursoExamenesPage({
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
    select: { groupId: true, name: true },
  });
  const studentGroupId = studentRecord?.groupId || null;
  const studentName = studentRecord?.name || "Estudiante";

  const activePeriodsFromDb = await prisma.period.findMany({ where: { active: true } });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const exams = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      type: { in: ["EXAM", "FINAL"] },
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: {
      course: true,
      submissions: { where: { studentId } },
    },
    orderBy: { dueDate: "asc" },
  });

  const filtered = exams.filter(exam => {
    const submission = exam.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(exam, submission);
    const isTimerExpired = !exam.isExternal && !!(submission?.startedAt && exam.duration &&
      (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()));
    const isVirtuallyClosed = !exam.isExternal && (
      (!submission && isClosed) ||
      (submission && submission.status === "PENDING" && (isClosed || isTimerExpired))
    );
    const isSubmitted = submission && submission.status !== "PENDING";

    if (estado === "presentados") {
      if (exam.isExternal) return true;
      return !!(isSubmitted || isVirtuallyClosed);
    }
    if (exam.isExternal) return false;
    return !isSubmitted && !isVirtuallyClosed;
  });

  const showingPresentados = estado === "presentados";

  return (
    <div>
      {/* Moodle-style page header */}
      <h2 style={{
        fontSize: "1.5rem",
        fontWeight: 700,
        color: "#333",
        marginBottom: "1.5rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #dee2e6",
      }}>
        Exámenes — {showingPresentados ? "Presentados" : "Disponibles"}
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
            {showingPresentados ? "No has presentado ningún examen todavía." : "No hay exámenes disponibles en esta asignatura."}
          </p>
        </div>
      ) : (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          overflow: "hidden",
        }}>
          {filtered.map((exam, idx) => {
            const submission = exam.submissions[0] || null;
            const { activeDeadline, hasExtension, isClosed } = getTaskDeadlineStatus(exam, submission);
            const isSubmitted = submission && submission.status !== "PENDING";

            const isGoogleForm = !!(
              exam.attachmentUrl &&
              (exam.attachmentUrl.includes("docs.google.com/forms") ||
                exam.attachmentUrl.includes("forms.gle"))
            );
            const isTimerExpired = !!(
              submission?.startedAt &&
              exam.duration &&
              new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()
            );

            const virtualSubmission =
              ((!submission || submission.status === "PENDING") &&
                isClosed &&
                isGoogleForm) ||
              (submission &&
                submission.status === "PENDING" &&
                isTimerExpired &&
                isGoogleForm)
                ? { status: "GRADED", grade: 1.0 }
                : null;

            const activeSubmission =
              submission && submission.status !== "PENDING"
                ? submission
                : virtualSubmission || submission;

            const isGraded = !!(activeSubmission && activeSubmission.status === "GRADED");
            const grade = activeSubmission ? (activeSubmission.grade as number | null) : null;

            return (
              <div
                key={exam.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 1.25rem",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #dee2e6" : "none",
                  background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                }}
              >
                {/* Exam icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "4px",
                  background: isGraded ? "#d4edda" : isSubmitted ? "#cce5ff" : "#e8d5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: `1px solid ${isGraded ? "#b8ddbf" : isSubmitted ? "#b3d4f0" : "#d5b8ec"}`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={isGraded ? "#155724" : isSubmitted ? "#004085" : "#6f42c1"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>

                {/* Exam info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "#333",
                    marginBottom: "0.2rem",
                  }}>
                    {exam.title}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                    Vence: {formatToColombiaString(activeDeadline)}
                    {hasExtension && <span style={{ marginLeft: 6, color: "#856404" }}>(Prórroga)</span>}
                    {exam.duration && (
                      <span style={{ marginLeft: 8 }}>· Duración: {exam.duration} min</span>
                    )}
                  </div>
                </div>

                {/* Status badge + grade + action */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                  {isGraded && grade !== null && grade !== undefined && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color: Number(grade) >= 3 ? "#155724" : "#721c24",
                        lineHeight: 1,
                      }}>
                        {Number(grade).toFixed(1)}
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
                    background: isGraded ? "#d4edda" : isSubmitted ? "#cce5ff" : "#e8d5f5",
                    color: isGraded ? "#155724" : isSubmitted ? "#004085" : "#6f42c1",
                    border: `1px solid ${isGraded ? "#b8ddbf" : isSubmitted ? "#b3d4f0" : "#d5b8ec"}`,
                    whiteSpace: "nowrap",
                  }}>
                    {isGraded ? "✓ Calificado" : isSubmitted ? "Presentado" : "Disponible"}
                  </span>

                  {exam.isExternal && isGraded ? (
                    <Link
                      href={`/estudiante/examenes/${exam.id}`}
                      style={{
                        padding: "0.35rem 0.85rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRadius: "3px",
                        background: "#f8f9fa",
                        color: "#333",
                        border: "1px solid #dee2e6",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ver calificación
                    </Link>
                  ) : (
                    <ExamenCardAcciones
                      examId={exam.id}
                      examTitle={exam.title}
                      courseName={exam.course.name}
                      attachmentUrl={exam.attachmentUrl}
                      dueDate={exam.dueDate.toISOString()}
                      duration={exam.duration}
                      allowLateSubmission={exam.allowLateSubmission}
                      lateSubmissionUntil={exam.lateSubmissionUntil ? exam.lateSubmissionUntil.toISOString() : null}
                      submission={submission ? {
                        status: submission.status,
                        grade: submission.grade,
                        feedback: submission.feedback,
                        fileUrl: submission.fileUrl,
                        submittedAt: submission.submittedAt,
                        startedAt: submission.startedAt,
                        allowLateSubmission: submission.allowLateSubmission,
                        lateSubmissionUntil: submission.lateSubmissionUntil,
                        attempt: submission.attempt ?? 1,
                        unlockedAnswers: submission.unlockedAnswers ?? false,
                        answers: (submission as any).answers,
                      } : null}
                      studentName={studentName}
                      isExternal={exam.isExternal}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
