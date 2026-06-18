import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import EvidenciaBotones from "./EvidenciaBotones";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function ExamenesEstudiantePage() {
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
            const submission = exam.submissions[0];
            const isLate = new Date() > new Date(exam.dueDate);
            const isGoogleForm = !!(exam.attachmentUrl && (exam.attachmentUrl.includes("docs.google.com/forms") || exam.attachmentUrl.includes("forms.gle")));
            
            // Check if late submissions are blocked (overdue and no extensions)
            const hasStudentExtension = submission && (
              submission.allowLateSubmission || 
              (submission.lateSubmissionUntil && new Date(submission.lateSubmissionUntil) > new Date())
            );
            const isClosed = isLate && !exam.allowLateSubmission && !(exam.lateSubmissionUntil && new Date(exam.lateSubmissionUntil) > new Date()) && !hasStudentExtension;
            
            // Detect if the student's individual timer has expired
            const isTimerExpired = submission?.startedAt && exam.duration && 
              (new Date(submission.startedAt).getTime() + exam.duration * 60 * 1000 < new Date().getTime());

            // If the Google Form exam is closed/expired and never finished/submitted, virtually grade it as 1.0
            const virtualSubmission = ((!submission || submission.status === "PENDING") && isClosed && isGoogleForm) ||
                                      (submission && submission.status === "PENDING" && isTimerExpired && isGoogleForm)
              ? { status: "GRADED", grade: 1.0, feedback: null, submittedAt: null, fileUrl: null }
              : null;
              
            const activeSubmission = (submission && submission.status !== "PENDING") ? submission : (virtualSubmission || submission);
            const isSubmitted = activeSubmission && activeSubmission.status !== "PENDING";
            const isGraded = activeSubmission && activeSubmission.status === "GRADED";

            return (
              <div key={exam.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderLeft: isSubmitted ? '4px solid var(--success)' : isLate ? '4px solid var(--danger)' : '4px solid #8b5cf6' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-1 bg-purple-100 rounded text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {exam.course.name}
                    </span>
                    {isGraded && (
                      <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle size={12} /> Calificado: {activeSubmission.grade}
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
                  <div className="text-sm text-muted flex items-center gap-1">
                    <Clock size={16} /> 
                    Vence: {new Date(exam.dueDate).toLocaleString()}
                  </div>
                  
                  {!isSubmitted && (
                    <Link href={`/estudiante/examenes/${exam.id}`} className="btn w-full md:w-auto" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                      Resolver Examen
                    </Link>
                  )}


                  {isSubmitted && (
                    <EvidenciaBotones 
                      exam={{
                        id: exam.id,
                        title: exam.title,
                        course: { name: exam.course.name }
                      }}
                      submission={{
                        grade: activeSubmission.grade,
                        status: activeSubmission.status,
                        fileUrl: activeSubmission.fileUrl,
                        submittedAt: activeSubmission.submittedAt,
                        feedback: activeSubmission.feedback
                      }}
                      isGoogleForm={isGoogleForm}
                    />
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
