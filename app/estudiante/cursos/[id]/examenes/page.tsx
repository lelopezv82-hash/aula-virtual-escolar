import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
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
      type: "EXAM",
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: {
      course: true,
      submissions: { where: { studentId } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = exams.filter(exam => {
    const submission = exam.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(exam, submission);
    const isTimerExpired = !!(submission?.startedAt && exam.duration &&
      (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()));
    const isVirtuallyClosed =
      (!submission && isClosed) ||
      (submission && submission.status === "PENDING" && (isClosed || isTimerExpired));
    const isSubmitted = submission && submission.status !== "PENDING";

    // External exams: only show in Presentados when graded, never in Disponibles
    if (exam.isExternal) {
      if (estado === "presentados") return isSubmitted;
      return false;
    }

    if (estado === "presentados") return isSubmitted || isVirtuallyClosed;
    // default: disponibles
    return !isSubmitted && !isVirtuallyClosed;
  });

  const showingPresentados = estado === "presentados";

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">
        Exámenes — {showingPresentados ? "Presentados" : "Disponibles"}
      </h2>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <ClipboardList size={44} className="mx-auto mb-4 opacity-40" />
          <p>{showingPresentados ? "No has presentado ningún examen todavía." : "No hay exámenes disponibles en esta asignatura."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(exam => {
            const submission = exam.submissions[0] || null;
            const { activeDeadline, hasExtension, isLate, isClosed } = getTaskDeadlineStatus(exam, submission);
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
                ? {
                    status: "GRADED",
                    grade: 1.0,
                  }
                : null;

            const activeSubmission =
              submission && submission.status !== "PENDING"
                ? submission
                : virtualSubmission || submission;

            const isGraded = !!(activeSubmission && activeSubmission.status === "GRADED");
            const grade = activeSubmission ? (activeSubmission.grade as number | null) : null;

            const leftBorderColor = isGraded
              ? (grade !== null && Number(grade) < 3 ? 'var(--danger)' : 'var(--success)')
              : isLate ? 'var(--danger)' : '#8b5cf6';

            return (
              <div
                key={exam.id}
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
                        <CheckCircle size={12} /> Calificado
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info flex items-center gap-1">
                        <Clock size={12} /> Entregado
                      </span>
                    )}
                    {!isSubmitted && isLate && <span className="badge badge-danger">Atrasado</span>}
                    {exam.isExternal && <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "rgba(59,130,246,0.1)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.2)" }}>Físico</span>}
                  </div>
                  <h3 className="font-bold text-base mb-0.5" style={{ color: "#8b5cf6" }}>{exam.title}</h3>
                  <p className="text-sm text-muted truncate">{exam.description || "Sin descripción"}</p>
                  <div className="flex items-center gap-1 text-xs text-muted mt-1">
                    <Clock size={12} />
                    <span>Vence: {formatToColombiaString(activeDeadline)} {hasExtension && "(Prórroga)"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  {isGraded && grade !== null && grade !== undefined && (
                    <div style={{ textAlign: "center", minWidth: "60px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: leftBorderColor, lineHeight: 1 }}>
                        {Number(grade).toFixed(1)}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>nota</div>
                    </div>
                  )}
                  <div>
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
