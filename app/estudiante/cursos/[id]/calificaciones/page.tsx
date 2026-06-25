import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { getTaskDeadlineStatus } from '@/lib/dateUtils';
import EvidenciaBotones from "@/app/estudiante/examenes/EvidenciaBotones";
import Link from "next/link";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CursoCalificacionesPage({
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

  const activePeriodsFromDb = await prisma.period.findMany({ where: { active: true } });
  activePeriodsFromDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, name: true },
  });
  const studentGroupId = studentRecord?.groupId || null;
  const studentName = studentRecord?.name || "Estudiante";

  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: {
      course: true,
      questions: { include: { options: true } },
      submissions: { where: { studentId } },
    },
  });

  const activeSubmissions = (await Promise.all(tasks.map(async task => {
    const sub = task.submissions[0];
    const { isClosed } = getTaskDeadlineStatus(task, sub);
    const isGoogleForm = !!(task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));
    const isNative = task.questions && task.questions.length > 0;
    const canSeeAnswers = sub && sub.status !== "PENDING" && (isNative || sub.attempt > 1 || sub.unlockedAnswers === true);

    let feedbackTemplate = null;
    if (task.type === "EXAM" && isGoogleForm && canSeeAnswers) {
      const templateSub = await prisma.submission.findFirst({
        where: { taskId: task.id, feedback: { not: null } },
        select: { feedback: true },
      });
      feedbackTemplate = templateSub?.feedback || null;
    }

    if (sub) {
      const isTimerExpired = sub.startedAt && task.duration &&
        (new Date(sub.startedAt).getTime() + task.duration * 60 * 1000 + 30000 < now.getTime());
      const processedSub = { ...sub, feedback: canSeeAnswers ? sub.feedback : null };
      if (sub.status === "PENDING" && (isClosed || isTimerExpired)) {
        return { ...processedSub, status: "GRADED", grade: 1.0, feedbackTemplate, task };
      }
      return { ...processedSub, feedbackTemplate, task };
    }
    if (isClosed) {
      return {
        id: `virtual-${task.id}`,
        taskId: task.id, studentId, status: "GRADED", grade: 1.0,
        feedback: null, feedbackTemplate, fileUrl: null, submittedAt: null,
        createdAt: task.dueDate, updatedAt: task.dueDate,
        allowLateSubmission: false, lateSubmissionUntil: null, gdriveEmail: null,
        startedAt: null, attempt: 1, unlockedAnswers: false, task,
      };
    }
    return null;
  }))).filter((sub): sub is any => sub !== null);

  activeSubmissions.sort((a, b) => new Date(b.updatedAt || b.task.updatedAt).getTime() - new Date(a.updatedAt || a.task.updatedAt).getTime());

  const graded = activeSubmissions.filter(s => s.status === "GRADED");
  const avg = graded.length > 0
    ? graded.reduce((sum, s) => sum + Math.max(1.0, s.grade ?? 0), 0) / graded.length
    : null;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Calificaciones</h2>

      {avg !== null && (
        <div className="card mb-5" style={{ borderLeft: "4px solid var(--primary-color)", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ textAlign: "center", minWidth: "70px" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, color: avg >= 3 ? "var(--success)" : "var(--danger)", lineHeight: 1 }}>
              {avg.toFixed(1)}
            </div>
            <div className="text-muted text-xs mt-1">Promedio</div>
          </div>
          <div>
            <p className="font-semibold">Escala colombiana (0.0 – 5.0)</p>
            <p className="text-sm text-muted">{graded.length} actividade(s) calificadas</p>
          </div>
        </div>
      )}

      {activeSubmissions.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <AlertCircle size={44} className="mx-auto mb-4 opacity-40" />
          <p>No tienes calificaciones registradas en esta asignatura todavía.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[...activePeriodNames, "Otros"].map(periodName => {
            const periodSubs = activeSubmissions.filter(sub => {
              if (periodName === "Otros") return !sub.task.period || !activePeriodNames.includes(sub.task.period);
              return sub.task.period === periodName;
            });
            if (periodSubs.length === 0) return null;

            return (
              <div key={periodName} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h3 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  {periodName}
                </h3>
                <div className="flex flex-col gap-4">
                  {periodSubs.map(sub => {
                    const isGraded = sub.status === "GRADED";
                    const isPending = sub.status === "SUBMITTED";
                    const currentGrade = sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade) : 0;
                    const gradeColor = isGraded ? (currentGrade >= 3 ? "var(--success)" : "var(--danger)") : "var(--text-muted)";

                    return (
                      <div
                        key={sub.id}
                        style={{
                          background: "var(--bg-primary)",
                          borderLeft: `4px solid ${isGraded ? gradeColor : "var(--border-color)"}`,
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          padding: "1rem",
                          borderRadius: "var(--radius-lg)",
                          border: "1px solid var(--border-color)",
                          borderLeftWidth: "4px",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {isGraded && (
                              sub.submittedAt === null
                                ? <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Plazo vencido</span>
                                : <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>
                            )}
                            {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> En revisión</span>}
                          </div>
                          <h4 className="font-bold text-base mb-0.5">{sub.task.title}</h4>
                          {isGraded && sub.feedback && !sub.feedback.includes("Calificado automáticamente") && !sub.feedback.trim().startsWith("[") && (
                            <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontStyle: "italic", background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: "3px solid var(--primary-color)" }}>
                              💬 &quot;{sub.feedback}&quot;
                            </div>
                          )}
                          {isGraded && sub.submittedAt === null && (
                            <p style={{ fontSize: "0.875rem", color: "var(--danger)", marginTop: "0.25rem", fontWeight: 500 }}>Calificación automática por falta de entrega.</p>
                          )}
                          {!isGraded && (
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Tu docente aún no ha calificado esta entrega.</p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", minWidth: "110px", textAlign: "center" }}>
                          {isGraded ? (
                            <>
                              <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                                {sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade).toFixed(1) : ""}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
                            </>
                          ) : (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "0.5rem" }}>
                              {sub.task.type === "EXAM" ? "En proceso de calificación..." : "Pendiente de revisión"}
                            </div>
                          )}
                          <div className="w-full flex justify-center">
                            {sub.task.type === "EXAM" ? (
                              <EvidenciaBotones
                                exam={{ id: sub.task.id, title: sub.task.title, course: { name: sub.task.course?.name || "" } }}
                                submission={{
                                  grade: sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade) : null,
                                  status: sub.status, fileUrl: sub.fileUrl,
                                  submittedAt: sub.submittedAt, feedback: sub.feedback,
                                  feedbackTemplate: sub.feedbackTemplate, studentName,
                                  attempt: sub.attempt, unlockedAnswers: sub.unlockedAnswers,
                                  answers: (sub as any).answers,
                                }}
                                isGoogleForm={!!(sub.task.attachmentUrl?.includes("docs.google.com/forms") || sub.task.attachmentUrl?.includes("forms.gle"))}
                                variant="secondary"
                                label="Ver Respuestas"
                              />
                            ) : (
                              <Link href={`/estudiante/tareas/${sub.task.id}`} className="btn btn-secondary text-xs px-2 py-1 w-full flex justify-center">
                                Ver Entrega
                              </Link>
                            )}
                          </div>
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
