import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, CheckCircle } from "lucide-react";
import ExamenCardAcciones from "./ExamenCardAcciones";

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
            const isLate = now > new Date(exam.dueDate);
            const isGoogleForm = !!(exam.attachmentUrl && (exam.attachmentUrl.includes("docs.google.com/forms") || exam.attachmentUrl.includes("forms.gle")));

            // For badge display only (server-side simple check)
            const hasStudentExtension = submission && (
              submission.allowLateSubmission ||
              (submission.lateSubmissionUntil && new Date(submission.lateSubmissionUntil) > now)
            );
            const isClosed = isLate && !exam.allowLateSubmission && !(exam.lateSubmissionUntil && new Date(exam.lateSubmissionUntil) > now) && !hasStudentExtension;
            const isTimerExpired = !!(submission?.startedAt && exam.duration &&
              (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 + 30000 < now.getTime()));

            const virtualGraded =
              ((!submission || submission.status === "PENDING") && isClosed && isGoogleForm) ||
              (submission && submission.status === "PENDING" && isTimerExpired && isGoogleForm);

            const activeStatus = submission && submission.status !== "PENDING"
              ? submission.status
              : virtualGraded ? "GRADED" : (submission?.status || null);
            const activeGrade = submission && submission.status !== "PENDING"
              ? submission.grade
              : virtualGraded ? 1.0 : null;

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
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle size={12} /> Calificado: {activeGrade}
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

                <div className="flex flex-col md:items-end gap-2 min-w-[200px]">
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
