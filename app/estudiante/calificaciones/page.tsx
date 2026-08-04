import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { getTaskDeadlineStatus } from '@/lib/dateUtils';
import EvidenciaBotones from "@/app/estudiante/examenes/EvidenciaBotones";
import Link from "next/link";

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

      const shouldHideFeedback = (task.type === "EXAM" || task.type === "FINAL") && !canSeeAnswers;
      const processedSub = {
        ...sub,
        feedback: shouldHideFeedback ? null : sub.feedback
      };

      return {
        ...processedSub,
        feedbackTemplate,
        task
      };
    }

    return null;
  }))).filter((sub): sub is any => sub !== null);

  // Sort by updatedAt desc (using task updatedAt fallback for virtual ones)
  activeSubmissions.sort((a, b) => new Date(b.updatedAt || b.task.updatedAt).getTime() - new Date(a.updatedAt || a.task.updatedAt).getTime());

  // Group submissions by period and course to calculate true definitivas
  const periodData = [...activePeriodNames, "Otros"].map(periodName => {
    const periodSubs = activeSubmissions.filter(sub => {
      if (periodName === "Otros") {
        return !sub.task.period || !activePeriodNames.includes(sub.task.period);
      }
      return sub.task.period === periodName;
    });

    if (periodSubs.length === 0) return null;

    const coursesMap = new Map<string, { course: any, subs: any[], definitiva: number | null }>();
    
    periodSubs.forEach(sub => {
      const cid = sub.task.courseId;
      if (!coursesMap.has(cid)) {
        coursesMap.set(cid, { course: sub.task.course, subs: [], definitiva: null });
      }
      coursesMap.get(cid)!.subs.push(sub);
    });

    // Calculate definitiva for each course
    coursesMap.forEach(courseData => {
      const { course, subs } = courseData;
      
      const saberSubs = subs.filter(s => s.task.type === "EXAM" && (s.status === "GRADED" || s.grade != null));
      const hacerSubs = subs.filter(s => s.task.type === "TASK" && (s.status === "GRADED" || s.grade != null));
      const serSubs   = subs.filter(s => s.task.type === "SER" && (s.status === "GRADED" || s.grade != null));
      const finalSubs = subs.filter(s => s.task.type === "FINAL" && (s.status === "GRADED" || s.grade != null));

      const avgType = (list: any[]) => list.length > 0 ? list.reduce((a, b) => a + (b.grade || 0), 0) / list.length : null;

      const saber = avgType(saberSubs);
      const hacer = avgType(hacerSubs);
      const ser = avgType(serSubs);
      const final = avgType(finalSubs);

      const sp = course.saberPercent ?? 30;
      const hp = course.hacerPercent ?? 50;
      const ep = course.serPercent ?? 20;
      const fp = course.finalPercent ?? 0;

      const hasAny = saber !== null || hacer !== null || ser !== null || final !== null;
      courseData.definitiva = hasAny 
        ? (saber ?? 0) * (sp / 100) + (hacer ?? 0) * (hp / 100) + (ser ?? 0) * (ep / 100) + (final ?? 0) * (fp / 100)
        : null;
    });

    return {
      periodName,
      courses: Array.from(coursesMap.values())
    };
  }).filter(Boolean);

  // Calculate global average from definitivas
  let validDefinitivas = 0;
  let sumDefinitivas = 0;
  periodData.forEach(p => {
    p?.courses.forEach(c => {
      if (c.definitiva !== null) {
        sumDefinitivas += c.definitiva;
        validDefinitivas++;
      }
    });
  });
  const avg = validDefinitivas > 0 ? sumDefinitivas / validDefinitivas : null;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Calificaciones</h1>
        <p>Consulta tus notas definitivas y retroalimentación agrupadas por periodos académicos.</p>
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
            <p className="text-sm text-muted">Promedio calculado a partir de las notas definitivas de {validDefinitivas} curso(s).</p>
          </div>
        </div>
      )}

      {periodData.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No tienes entregas calificadas en periodos académicos activos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {periodData.map((periodInfo: any) => {
            return (
              <div key={periodInfo.periodName} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h2 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  {periodInfo.periodName}
                </h2>
                
                <div className="flex flex-col gap-6">
                  {periodInfo.courses.map((courseData: any) => (
                    <div key={courseData.course.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-md flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary-color)' }}></span>
                          {courseData.course.name}
                        </h3>
                        {courseData.definitiva !== null && (
                          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Nota Definitiva:</span>
                            <span className={`font-black text-lg ${courseData.definitiva >= 3 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {courseData.definitiva.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        {courseData.subs.map((sub: any) => {
                          const isGraded = sub.status === "GRADED" || sub.grade != null;
                          const isPending = sub.status === "SUBMITTED";
                          const currentGrade = sub.grade !== null && sub.grade !== undefined ? sub.grade : 0;
                          const gradeColor = isGraded
                            ? currentGrade >= 3 ? "var(--success)" : "var(--danger)"
                            : "var(--text-muted)";

                          return (
                            <div key={sub.id}
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
                                border: `1px solid var(--border-color)`,
                                borderLeftWidth: "4px",
                                boxShadow: "var(--shadow-sm)",
                              }}
                            >
                              {/* Left: info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                                  {sub.task.isExternal ? (
                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
                                      📁 Entrega en clase
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f0f9ff", color: "#0369a1", border: "1px solid #b9e6fe" }}>
                                      💻 Entrega en plataforma
                                    </span>
                                  )}
                                  {isGraded && (
                                    sub.submittedAt === null && !sub.task.isExternal ? (
                                      <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Plazo vencido</span>
                                    ) : (
                                      <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>
                                    )
                                  )}
                                  {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> En revisión</span>}
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.25rem" }}>{sub.task.title}</h3>
                                {isGraded && sub.feedback && !sub.feedback.includes("Calificado automáticamente por Google Forms") && !sub.feedback.trim().startsWith("[") && (
                                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontStyle: "italic", background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: "3px solid var(--primary-color)" }}>
                                    💬 &quot;{sub.feedback}&quot;
                                  </div>
                                )}
                                {isGraded && sub.submittedAt === null && !sub.task.isExternal && (
                                  <p style={{ fontSize: "0.875rem", color: "var(--danger)", marginTop: "0.25rem", fontWeight: 500 }}>Calificación automática por falta de entrega.</p>
                                )}
                                {!isGraded && (
                                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Tu docente aún no ha calificado esta entrega.</p>
                                )}
                              </div>

                              {/* Right: grade + action */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", minWidth: "120px", textAlign: "center" }}>
                                {isGraded ? (
                                  <>
                                    <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                                      {sub.grade !== null && sub.grade !== undefined ? sub.grade.toFixed(1) : ""}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "0.5rem" }}>
                                    {sub.task.type === "EXAM" ? "En proceso de calificación..." : "Pendiente de revisión"}
                                  </div>
                                )}

                                <div className="mt-1 w-full flex justify-center">
                                  {sub.task.type === "EXAM" ? (
                                    <EvidenciaBotones
                                      exam={{
                                        id: sub.task.id,
                                        title: sub.task.title,
                                        course: { name: sub.task.course?.name || "Asignatura" }
                                      }}
                                      submission={{
                                        grade: sub.grade !== null && sub.grade !== undefined ? sub.grade : null,
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
                                      variant="secondary"
                                      label="Ver Calificación"
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
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
