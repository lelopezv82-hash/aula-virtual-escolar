import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, CheckCircle, Clock } from "lucide-react";
import ExamenCardAcciones from "./ExamenCardAcciones";
import { getTaskDeadlineStatus, formatToColombiaString } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function ExamenesEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, name: true }
  });
  const studentGroupId = studentRecord?.groupId || null;
  const studentName = studentRecord?.name || "Estudiante";

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const exams = await prisma.task.findMany({
    where: {
      active: true,
      type: "EXAM",
      isExternal: false,
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

  const pendingExams = exams.filter(exam => {
    const submission = exam.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(exam, submission);
    const isTimerExpired = !!(submission?.startedAt && exam.duration &&
      (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()));
    const virtualGraded =
      (!submission && isClosed) ||
      (submission && submission.status === "PENDING" && (isClosed || isTimerExpired));
    const isSubmitted = submission && submission.status !== "PENDING";
    return !isSubmitted && !virtualGraded;
  });

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Exámenes</h1>
        <p>Revisa y resuelve tus evaluaciones programadas.</p>
      </div>

      <div className="flex flex-col gap-4">
        {pendingExams.length === 0 ? (
          <div className="card text-center py-8 text-muted">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
            <p>No tienes exámenes pendientes en este momento.</p>
          </div>
        ) : (
          pendingExams.map(exam => {
            const submission = exam.submissions[0] || null;
            const isGoogleForm = !!(exam.attachmentUrl && (exam.attachmentUrl.includes("docs.google.com/forms") || exam.attachmentUrl.includes("forms.gle")));

            const { activeDeadline, hasExtension, isClosed, isLate } = getTaskDeadlineStatus(exam, submission);
            const isTimerExpired = !!(submission?.startedAt && exam.duration &&
              (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()));

            const virtualGraded =
              (!submission && isClosed) ||
              (submission && submission.status === "PENDING" && (isClosed || isTimerExpired));

            const activeStatus = submission && submission.status !== "PENDING"
              ? submission.status
              : virtualGraded ? "GRADED" : (submission?.status || null);
            const activeGrade = submission && submission.status !== "PENDING"
              ? (submission.grade !== null && submission.grade !== undefined ? Math.max(1.0, submission.grade) : null)
              : virtualGraded ? 1.0 : null;

            // Determine reason for minimum grade
            const neverStarted = !submission || (submission.status === "PENDING" && !submission.startedAt);
            const hasAnswers = submission?.answers && Object.keys(submission.answers as Record<string, unknown>).length > 0;
            const startedButEmpty = submission && submission.startedAt && submission.status !== "PENDING"
              && submission.grade !== null && submission.grade <= 1.0
              && !hasAnswers;
            const gradeReason = virtualGraded && neverStarted
              ? "No presentó"
              : (virtualGraded && !neverStarted && !hasAnswers)
                ? "No respondió"
                : startedButEmpty
                  ? "No respondió"
                  : null;

            const isSubmitted = activeStatus && activeStatus !== "PENDING";
            const isGraded = activeStatus === "GRADED";

            const leftBorderColor = isSubmitted
              ? (isGraded && activeGrade !== null && Number(activeGrade) < 3.0 ? 'var(--danger)' : 'var(--success)')
              : isLate ? 'var(--danger)' : '#8b5cf6';

            const gradeColor = isGraded
              ? (activeGrade !== null && Number(activeGrade) >= 3 ? 'var(--success)' : 'var(--danger)')
              : 'var(--text-muted)';

            return (
              <div key={exam.id}
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
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", background: "#f3e8ff", borderRadius: "4px", color: "#6b21a8" }}>
                      {exam.course.name}
                    </span>
                    {isGraded && (
                      <span className={`badge flex items-center gap-1 ${gradeReason ? 'badge-danger' : 'badge-success'}`}>
                        <CheckCircle size={12} /> Calificado
                      </span>
                    )}
                    {isGraded && gradeReason && (
                      <span className="text-xs text-red-500 dark:text-red-400 font-semibold">
                        — {gradeReason}
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> Entregado</span>
                    )}
                    {!isSubmitted && isLate && (
                      <span className="badge badge-danger">Atrasado</span>
                    )}
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.25rem", color: "#8b5cf6" }}>{exam.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 0.5rem 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {exam.description
                      ? exam.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
                      : ""}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <Clock size={12} />
                  {formatToColombiaString(activeDeadline) !== "Sin fecha límite" && (
                    <span>Vence: {formatToColombiaString(activeDeadline)} {hasExtension && "(Prórroga)"}</span>
                  )}
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
                      En proceso de calificación...
                    </div>
                  ) : null}

                  {/* Interactive actions rendered client-side only (correct local timezone + portal support) */}
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
                      answers: submission.answers,
                    } : null}
                    studentName={studentName}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
