import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import EvidenciaBotones from "@/app/estudiante/examenes/EvidenciaBotones";
import { getTaskDeadlineStatus } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function CalificacionesEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  activePeriodsFromDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);

  const now = new Date();

  // Get student group to fetch all tasks assigned to their group
  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, name: true }
  });
  const studentGroupId = studentRecord?.groupId || null;
  const studentName = studentRecord?.name || "Estudiante";

  // Fetch all active tasks assigned to the student's group (or all if no groups restrict them)
  const tasks = await prisma.task.findMany({
    where: {
      active: true,
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
      questions: {
        include: {
          options: true
        }
      },
      submissions: {
        where: { studentId }
      }
    }
  });

  // Map tasks to their submissions, adding virtual 1.0 graded submissions for expired/closed Google Forms exams
  // Map tasks to their submissions, adding virtual 1.0 graded submissions for expired/closed Google Forms exams
  const activeSubmissions = (await Promise.all(tasks.map(async task => {
    const sub = task.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(task, sub);
    const isGoogleForm = !!(task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));

    const isNative = task.questions && task.questions.length > 0;
    const canSeeAnswers = sub && sub.status !== "PENDING" && (isNative || sub.attempt > 1 || sub.unlockedAnswers === true);

    let feedbackTemplate = null;
    if (task.type === "EXAM" && isGoogleForm && canSeeAnswers) {
      const templateSub = await prisma.submission.findFirst({
        where: {
          taskId: task.id,
          feedback: { not: null }
        },
        select: { feedback: true }
      });
      feedbackTemplate = templateSub?.feedback || null;
    }

    if (sub) {
      // Detect if the student's individual timer has expired (including 30s grace period)
      const isTimerExpired = sub.startedAt && task.duration && 
        (new Date(sub.startedAt).getTime() + task.duration * 60 * 1000 + 30000 < now.getTime());

      const processedSub = {
        ...sub,
        feedback: canSeeAnswers ? sub.feedback : null
      };

      if (sub.status === "PENDING" && (isClosed || isTimerExpired)) {
        return {
          ...processedSub,
          status: "GRADED",
          grade: 1.0,
          feedbackTemplate,
          task
        };
      }
      return {
        ...processedSub,
        feedbackTemplate,
        task
      };
    }

    // If no submission and task/exam is closed, virtually grade as 1.0
    if (isClosed) {
      return {
        id: `virtual-${task.id}`,
        taskId: task.id,
        studentId,
        status: "GRADED",
        grade: 1.0,
        feedback: null,
        feedbackTemplate,
        fileUrl: null,
        submittedAt: null,
        createdAt: task.dueDate,
        updatedAt: task.dueDate,
        allowLateSubmission: false,
        lateSubmissionUntil: null,
        gdriveEmail: null,
        startedAt: null,
        attempt: 1,
        unlockedAnswers: false,
        task
      };
    }

    return null;
  }))).filter((sub): sub is any => sub !== null);

  // Sort by updatedAt desc (using task updatedAt fallback for virtual ones)
  activeSubmissions.sort((a, b) => new Date(b.updatedAt || b.task.updatedAt).getTime() - new Date(a.updatedAt || a.task.updatedAt).getTime());

  const graded = activeSubmissions.filter(s => s.status === "GRADED");
  const avg = graded.length > 0
    ? graded.reduce((sum, s) => sum + Math.max(1.0, s.grade ?? 0), 0) / graded.length
    : null;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Calificaciones</h1>
        <p>Consulta tus notas y retroalimentación agrupadas por periodos académicos.</p>
      </div>

      {/* Summary card */}
      {avg !== null && (
        <div className="card mb-6" style={{ borderLeft: "4px solid var(--primary-color)", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ textAlign: "center", minWidth: "80px" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: avg >= 3 ? "var(--success)" : "var(--danger)" }}>
              {avg.toFixed(1)}
            </div>
            <div className="text-muted text-xs">Promedio General</div>
          </div>
          <div>
            <p className="font-semibold">Escala colombiana (0.0 – 5.0)</p>
            <p className="text-sm text-muted">{graded.length} tarea(s) calificadas de {activeSubmissions.length} activas entregadas</p>
          </div>
        </div>
      )}

      {activeSubmissions.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No tienes entregas calificadas en periodos académicos activos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[...activePeriodNames, "Otros"].map(periodName => {
            const periodSubs = activeSubmissions.filter(sub => {
              if (periodName === "Otros") {
                return !sub.task.period || !activePeriodNames.includes(sub.task.period);
              }
              return sub.task.period === periodName;
            });

            if (periodSubs.length === 0) return null;

            return (
              <div key={periodName} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h2 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  {periodName}
                </h2>
                
                <div className="flex flex-col gap-4">
                  {periodSubs.map(sub => {
                    const isGraded = sub.status === "GRADED";
                    const isPending = sub.status === "SUBMITTED";
                    const currentGrade = sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade) : 0;
                    const gradeColor = isGraded
                      ? currentGrade >= 3 ? "var(--success)" : "var(--danger)"
                      : "var(--text-muted)";

                    return (
                      <div key={sub.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4"
                        style={{ background: "var(--bg-primary)", borderLeft: `4px solid ${isGraded ? gradeColor : "var(--border-color)"}` }}>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                              {sub.task.course.name}
                            </span>
                            {isGraded && (
                              sub.submittedAt === null ? (
                                <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Plazo vencido</span>
                              ) : (
                                <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>
                              )
                            )}
                            {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> En revisión</span>}
                          </div>
                          <h3 className="font-bold text-lg">{sub.task.title}</h3>
                          {isGraded && sub.feedback && !sub.feedback.includes("Calificado automáticamente por Google Forms") && !sub.feedback.trim().startsWith("[") && (
                            <div className="mt-2 p-3 rounded-lg text-sm italic" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: "3px solid var(--primary-color)" }}>
                              💬 &quot;{sub.feedback}&quot;
                            </div>
                          )}
                          {isGraded && sub.submittedAt === null && (
                            <p className="text-sm text-red-500 mt-1 font-medium">Calificación automática por falta de entrega.</p>
                          )}
                          {!isGraded && (
                            <p className="text-sm text-muted mt-1">Tu docente aún no ha calificado esta entrega.</p>
                          )}
                          
                          {sub.task.type === "EXAM" && (
                            <div className="mt-3">
                              <EvidenciaBotones 
                                exam={{
                                  id: sub.task.id,
                                  title: sub.task.title,
                                  course: { name: sub.task.course?.name || "Asignatura" }
                                }}
                                submission={{
                                  grade: sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade) : null,
                                  status: sub.status,
                                  fileUrl: sub.fileUrl,
                                  submittedAt: sub.submittedAt,
                                  feedback: sub.feedback,
                                  feedbackTemplate: sub.feedbackTemplate,
                                  studentName: studentName,
                                  attempt: sub.attempt,
                                  unlockedAnswers: sub.unlockedAnswers,
                                  answers: (sub as any).answers
                                }}
                                isGoogleForm={!!(sub.task.attachmentUrl?.includes("docs.google.com/forms") || sub.task.attachmentUrl?.includes("forms.gle"))}
                              />
                            </div>
                          )}
                        </div>

                        <div style={{ minWidth: "100px", textAlign: "center" }}>
                          {isGraded ? (
                            <>
                              <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                                {sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade).toFixed(1) : ""}
                              </div>
                              <div className="text-xs text-muted">nota</div>
                            </>
                          ) : (
                            <div className="text-xs text-muted italic">Pendiente de revisión</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
