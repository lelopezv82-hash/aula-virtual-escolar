import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle, ClipboardList, FileText, Star } from "lucide-react";
import { getTaskDeadlineStatus } from '@/lib/dateUtils';

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

  const now = new Date();

  const course = await prisma.course.findUnique({
    where: { id },
    select: { saberPercent: true, hacerPercent: true, serPercent: true, finalPercent: true }
  });
  const saberPct = (course?.saberPercent ?? 30) / 100;
  const hacerPct = (course?.hacerPercent ?? 50) / 100;
  const serPct   = (course?.serPercent   ?? 20) / 100;
  const finalPct = (course?.finalPercent ?? 0) / 100;
  const saberLabel = `${course?.saberPercent ?? 30}%`;
  const hacerLabel = `${course?.hacerPercent ?? 50}%`;
  const serLabel   = `${course?.serPercent   ?? 20}%`;
  const finalLabel = `${course?.finalPercent ?? 0}%`;

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
    // External tasks: show as "pending teacher grade" even without submission
    if (task.isExternal) {
      return {
        id: `ext-${task.id}`,
        taskId: task.id, studentId, status: "PENDING", grade: null,
        feedback: null, feedbackTemplate: null, fileUrl: null, submittedAt: null,
        createdAt: task.createdAt, updatedAt: task.updatedAt,
        allowLateSubmission: false, lateSubmissionUntil: null, gdriveEmail: null,
        startedAt: null, attempt: 1, unlockedAnswers: false, task,
      };
    }
    if (isClosed && !task.isExternal) {
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

  // Fetch additional grades per period for this student
  const additionalGradesDb = await prisma.additionalGrade.findMany({
    where: { studentId, courseId: id },
  });
  const additionalGradesMap = new Map(additionalGradesDb.map(ag => [ag.period, ag.grade]));

  // Compute overall average across all graded items
  const graded = activeSubmissions.filter(s => s.status === "GRADED" || s.grade != null);
  const overallAvg = graded.length > 0
    ? graded.reduce((sum, s) => sum + Math.max(1.0, s.grade ?? 0), 0) / graded.length
    : null;

  const gradeColor = (g: number) => g >= 3 ? "var(--success)" : "var(--danger)";

  const renderCard = (sub: any) => {
    const isGraded = sub.status === "GRADED" || sub.grade != null;
    const isPending = sub.status === "SUBMITTED";
    const currentGrade = sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade) : 0;
    const gColor = isGraded ? gradeColor(currentGrade) : "var(--text-muted)";
    const isExam = sub.task.type === "EXAM";
    const accentColor = isExam ? "#8b5cf6" : "var(--primary-color)";

    return (
      <div
        key={sub.id}
        style={{
          background: "var(--bg-primary)",
          borderLeft: `4px solid ${isGraded ? gColor : "var(--border-color)"}`,
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
              sub.submittedAt === null && !sub.task.isExternal
                ? <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Plazo vencido</span>
                : <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>
            )}
            {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> En revisión</span>}
            {sub.task.isExternal ? (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
                📁 Entrega en clase
              </span>
            ) : (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f0f9ff", color: "#0369a1", border: "1px solid #b9e6fe" }}>
                💻 Entrega en plataforma
              </span>
            )}
          </div>
          <h4 className="font-bold text-base mb-0.5" style={{ color: accentColor }}>{sub.task.title}</h4>
          {isGraded && sub.feedback && !sub.feedback.includes("Calificado automáticamente") && !sub.feedback.trim().startsWith("[") && (
            <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontStyle: "italic", background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: `3px solid ${accentColor}` }}>
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.25rem", minWidth: "110px", textAlign: "center" }}>
          {isGraded ? (
            <>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: gColor, lineHeight: 1 }}>
                {sub.grade !== null && sub.grade !== undefined ? Math.max(1.0, sub.grade).toFixed(1) : ""}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              {sub.task.type === "EXAM" ? "En proceso de calificación..." : "Pendiente de revisión"}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Calificaciones</h2>

      {activeSubmissions.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <AlertCircle size={44} className="mx-auto mb-4 opacity-40" />
          <p>No tienes calificaciones registradas en esta asignatura todavía.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[...activePeriodNames, "Otros"].map(periodName => {
            const periodSubs = activeSubmissions.filter(sub => {
              if (periodName === "Otros") return !sub.task.period || !activePeriodNames.includes(sub.task.period);
              return sub.task.period === periodName;
            });
            if (periodSubs.length === 0 && !additionalGradesMap.has(periodName)) return null;

            const tareas   = periodSubs.filter(s => s.task.type === "TASK");
            const examenes  = periodSubs.filter(s => s.task.type === "EXAM");
            const serSubs   = periodSubs.filter(s => s.task.type === "SER");
            const finalSubs = periodSubs.filter(s => s.task.type === "FINAL");

            const gradedTareas   = tareas.filter(s   => s.status === "GRADED" || s.grade != null);
            const gradedExamenes = examenes.filter(s  => s.status === "GRADED" || s.grade != null);
            const gradedSer      = serSubs.filter(s   => s.status === "GRADED" || s.grade != null);
            const gradedFinal    = finalSubs.filter(s => s.status === "GRADED" || s.grade != null);

            const avg = (arr: any[]) => arr.length > 0 ? arr.reduce((s, x) => s + Math.max(1.0, x.grade ?? 0), 0) / arr.length : null;
            const avgTareas   = avg(gradedTareas);
            const avgExamenes = avg(gradedExamenes);
            const avgSer      = avg(gradedSer);
            const avgFinal    = avg(gradedFinal);

            const additionalGrade = additionalGradesMap.get(periodName) ?? null;
            const effectiveSerGrade = avgSer ?? additionalGrade;

            // Weighted final using course-specific percentages
            const finalWeighted = avgFinal !== null ? +(avgFinal * finalPct).toFixed(2) : null;
            const saberWeighted = (avgExamenes !== null || finalWeighted !== null)
              ? +((avgExamenes !== null ? avgExamenes * saberPct : 0) + (finalWeighted ?? 0)).toFixed(2)
              : null;
            const combinedWeight = saberPct + finalPct;
            const avgSaberCombined = (avgExamenes !== null || avgFinal !== null)
              ? +(((avgExamenes ?? 0) * saberPct + (avgFinal ?? 0) * finalPct) / combinedWeight).toFixed(2)
              : null;

            const hacerWeighted = avgTareas   !== null ? +(avgTareas   * hacerPct).toFixed(2) : null;
            const serWeighted   = effectiveSerGrade !== null ? +(effectiveSerGrade * serPct).toFixed(2) : null;
            const finalGrade =
              saberWeighted !== null || hacerWeighted !== null || serWeighted !== null
                ? (saberWeighted ?? 0) + (hacerWeighted ?? 0) + (serWeighted ?? 0)
                : null;
            const componentCount = (avgExamenes !== null || avgFinal !== null ? 1 : 0) + (avgTareas !== null ? 1 : 0) + (effectiveSerGrade !== null ? 1 : 0);
            const hasSubs = periodSubs.length > 0;
            const components = componentCount;

            return (
              <div key={periodName}>
                {/* Period header */}
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ height: "1px", flex: 1, background: "var(--border-color)" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                    {periodName}
                  </span>
                  <div style={{ height: "1px", flex: 1, background: "var(--border-color)" }} />
                </div>

                {/* Period Summary Card */}
                {(avgTareas !== null || avgExamenes !== null || effectiveSerGrade !== null) && (
                  <div
                    className="card mb-5"
                    style={{
                      borderLeft: "4px solid var(--primary-color)",
                      padding: "1.1rem 1.4rem",
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Resumen del {periodName}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-end" }}>
                      {/* Saber — Exámenes */}
                      {saberWeighted !== null && (
                        <div style={{ textAlign: "center", minWidth: "80px" }}>
                          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: gradeColor(avgSaberCombined!), lineHeight: 1 }}>
                            {saberWeighted.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {avgFinal !== null
                              ? `${avgSaberCombined!.toFixed(1)} × ${((saberPct + finalPct) * 100).toFixed(0)}%`
                              : `${avgExamenes!.toFixed(1)} × ${saberLabel}`}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <FileText size={11} style={{ color: "#8b5cf6" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Saber (Cognitivo)</span>
                          </div>
                        </div>
                      )}

                      {saberWeighted !== null && (avgTareas !== null || effectiveSerGrade !== null) && (
                        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)", fontWeight: 300, lineHeight: 1 }}>+</div>
                      )}

                      {/* Hacer — Tareas */}
                      {avgTareas !== null && (
                        <div style={{ textAlign: "center", minWidth: "80px" }}>
                          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: gradeColor(avgTareas), lineHeight: 1 }}>
                            {hacerWeighted!.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {avgTareas.toFixed(1)} × {hacerLabel}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <ClipboardList size={11} style={{ color: "var(--primary-color)" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Hacer (Procedimental)</span>
                          </div>
                        </div>
                      )}

                      {effectiveSerGrade !== null && (avgExamenes !== null || avgTareas !== null) && (
                        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)", fontWeight: 300, lineHeight: 1 }}>+</div>
                      )}

                      {/* Ser — Actitudinal */}
                      {effectiveSerGrade !== null && (
                        <div style={{ textAlign: "center", minWidth: "80px" }}>
                          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: gradeColor(effectiveSerGrade), lineHeight: 1 }}>
                            {serWeighted!.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {effectiveSerGrade.toFixed(1)} × {serLabel}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <Star size={11} style={{ color: "#0d9488" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Ser (Actitudinal)</span>
                          </div>
                        </div>
                      )}

                      {/* Equals and Final Grade */}
                      {finalGrade !== null && componentCount > 1 && (
                        <>
                          <div style={{ fontSize: "1.5rem", color: "var(--text-muted)", fontWeight: 300, lineHeight: 1 }}>=</div>
                          <div
                            style={{
                              textAlign: "center",
                              minWidth: "90px",
                              padding: "0.5rem 1rem",
                              borderRadius: "0.75rem",
                              background: finalGrade >= 3 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
                              border: `2px solid ${gradeColor(finalGrade)}`,
                            }}
                          >
                            <div style={{ fontSize: "2rem", fontWeight: 900, color: gradeColor(finalGrade), lineHeight: 1 }}>
                              {finalGrade.toFixed(1)}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginTop: "0.2rem" }}>Nota Final</div>
                          </div>
                        </>
                      )}

                      {/* If only one component, show it as final */}
                      {finalGrade !== null && componentCount === 1 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", alignSelf: "center" }}>
                          Nota del período
                        </div>
                      )}
                    </div>

                    {componentCount > 1 && (
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
                        * Nota final = {[saberWeighted !== null && `${saberWeighted.toFixed(2)} (Cognitivo×${saberLabel})`, hacerWeighted !== null && `${hacerWeighted.toFixed(2)} (Procedimental×${hacerLabel})`, serWeighted !== null && `${serWeighted.toFixed(2)} (Actitudinal×${serLabel})`].filter(Boolean).join(" + ")}.
                      </p>
                    )}
                  </div>
                )}

                {/* Task items */}
                <div className="flex flex-col gap-6">
                  {examenes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} style={{ color: "#8b5cf6" }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8b5cf6" }}>Saber — Cognitivo</span>
                      </div>
                      <div className="flex flex-col gap-3">{examenes.map(renderCard)}</div>
                    </div>
                  )}
                  {tareas.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList size={14} style={{ color: "var(--primary-color)" }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary-color)" }}>Hacer — Procedimental</span>
                      </div>
                      <div className="flex flex-col gap-3">{tareas.map(renderCard)}</div>
                    </div>
                  )}

                  {/* Ser — Actitudinal */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star size={14} style={{ color: "#0d9488" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0d9488" }}>Ser — Actitudinal</span>
                    </div>
                    {serSubs.length > 0 ? (
                      <div className="flex flex-col gap-3">{serSubs.map(renderCard)}</div>
                    ) : (
                      additionalGrade !== null ? (
                        <div
                          style={{
                            background: "var(--bg-primary)",
                            borderLeft: `4px solid ${gradeColor(additionalGrade)}`,
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
                              <span className="badge badge-success flex items-center gap-1">
                                <CheckCircle size={12} /> Calificada
                              </span>
                              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "rgba(13,148,136,0.1)", color: "#0d9488", border: "1px solid rgba(13,148,136,0.2)" }}>
                                Asignada por el docente
                              </span>
                            </div>
                            <h4 className="font-bold text-base mb-0.5" style={{ color: "#0d9488" }}>
                              Nota Actitudinal — {periodName}
                            </h4>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              Esta nota refleja tu actitud, participación y comportamiento durante el período.
                            </p>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.25rem", minWidth: "110px", textAlign: "center" }}>
                            <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor(additionalGrade), lineHeight: 1 }}>
                              {additionalGrade.toFixed(1)}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            background: "var(--bg-primary)",
                            borderLeft: "4px solid var(--border-color)",
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
                            opacity: 0.7,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <h4 className="font-bold text-base mb-0.5" style={{ color: "#0d9488" }}>
                              Nota Actitudinal — {periodName}
                            </h4>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              Tu docente aún no ha registrado la nota actitudinal para este período.
                            </p>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", minWidth: "110px", textAlign: "center" }}>
                            Pendiente
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Examen Final */}
                  {finalSubs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} style={{ color: "#0ea5e9" }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0ea5e9" }}>Examen Final</span>
                      </div>
                      <div className="flex flex-col gap-3">{finalSubs.map(renderCard)}</div>
                    </div>
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
