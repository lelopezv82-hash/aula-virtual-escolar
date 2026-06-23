import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, CheckCircle } from "lucide-react";
import ExamenCardAcciones from "./ExamenCardAcciones";
import { getTaskDeadlineStatus } from '@/lib/dateUtils';

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
        <h1>Mis Exámenes</h1>
        <p>Revisa y resuelve tus evaluaciones programadas.</p>
      </div>

      <div className="flex flex-col gap-4">
        {exams.length === 0 ? (
          <div className="card text-center py-8 text-muted">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
            <p>No tienes exámenes asignados en este momento.</p>
          </div>
        ) : (
          exams.map(exam => {
            const submission = exam.submissions[0] || null;
            const isGoogleForm = !!(exam.attachmentUrl && (exam.attachmentUrl.includes("docs.google.com/forms") || exam.attachmentUrl.includes("forms.gle")));

            const { isClosed, isLate } = getTaskDeadlineStatus(exam, submission);
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

            return (
              <div key={exam.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderLeft: isSubmitted ? '4px solid var(--success)' : isLate ? '4px solid var(--danger)' : '4px solid #8b5cf6' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-1 bg-purple-100 rounded text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {exam.course.name}
                    </span>
                    {isGraded && (
                      <span className={`badge flex items-center gap-1 ${gradeReason ? 'badge-danger' : 'badge-success'}`}>
                        <CheckCircle size={12} /> Calificado: {activeGrade !== null ? Number(activeGrade).toFixed(1) : ""}
                      </span>
                    )}
                    {isGraded && gradeReason && (
                      <span className="text-xs text-red-500 dark:text-red-400 font-semibold">
                        — {gradeReason}
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="badge badge-info">Entregado</span>
                    )}
                    {!isSubmitted && isLate && (
                      <span className="badge badge-danger">Atrasado</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: '#8b5cf6' }}>{exam.title}</h3>
                  <p className="text-sm text-muted line-clamp-2 mt-1">{exam.description}</p>
                </div>

                <div className="flex flex-col md:items-end gap-2 min-w-[180px]">
                  {/* Grade number display */}
                  {isGraded && activeGrade !== null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: Number(activeGrade) >= 3 ? 'var(--success)' : 'var(--danger)' }}>
                        {Number(activeGrade).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted">nota</div>
                    </div>
                  )}
                  {isSubmitted && !isGraded && (
                    <div className="text-xs text-muted italic">En proceso de calificación...</div>
                  )}

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
