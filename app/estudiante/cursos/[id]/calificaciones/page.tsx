import prisma from '@/lib/prisma';
import Link from 'next/link';
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
    select: { saberPercent: true, hacerPercent: true, serPercent: true, finalPercent: true, hiddenSections: true }
  });
  const hiddenSections = Array.isArray(course?.hiddenSections) ? (course?.hiddenSections as string[]) : [];

  if (hiddenSections.includes("calificaciones")) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        padding: "3rem",
        textAlign: "center",
        color: "#6c757d",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#333", marginBottom: "0.25rem" }}>Sección Oculta</h2>
        <p style={{ fontSize: "0.875rem" }}>El docente ha desactivado la visibilidad de la sección de Calificaciones para este curso.</p>
      </div>
    );
  }
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
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        {
          OR: [
            ...(studentGroupId ? [{ groups: { some: { id: studentGroupId } } }] : []),
            { assignedStudents: { some: { id: studentId } } }
          ]
        }
      ],
    },
    include: {
      course: true,
      assignedStudents: {
        select: { id: true }
      },
      questions: { include: { options: true } },
      submissions: { where: { studentId } },
    },
  });

  const activeSubmissions = (await Promise.all(tasks.map(async task => {
    const sub = task.submissions[0];
    const hasProrroga = !!sub?.allowLateSubmission || !!task.allowLateSubmission;
    const hasRealGrade = sub?.grade !== null && sub?.grade !== undefined;
    // Non-activated student (absent): virtual closed submission with grade 1.0 (unless graded or granted prórroga)
    const isNotActivatedForStudent = !task.assignedStudents.some(s => s.id === studentId) && !hasRealGrade && !hasProrroga;
    if (isNotActivatedForStudent) {
      return {
        id: `unassigned-${task.id}`,
        taskId: task.id,
        studentId,
        status: "GRADED",
        grade: 1.0,
        feedback: "No asistió a la clase (Actividad no habilitada)",
        fileUrl: null,
        submittedAt: null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        allowLateSubmission: false,
        lateSubmissionUntil: null,
        startedAt: null,
        attempt: 1,
        unlockedAnswers: false,
        feedbackTemplate: null,
        isNotActivated: true,
        task
      };
    }

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
        (new Date(sub.startedAt).getTime() + task.duration * 60 * 1000 + 30000 < now.getTime()) &&
        !sub.allowLateSubmission;

      const isExam = task.type === "EXAM" || task.type === "FINAL";
      const isInteractive = task.type === "INTERACTIVE";
      const hasUploadedFile = !isExam && !isInteractive && (
        sub.status === "SUBMITTED" ||
        !!sub.submittedAt ||
        !!(sub.fileUrl && sub.fileUrl.trim() !== "") ||
        (Array.isArray((sub as any).fileUrls) && (sub as any).fileUrls.length > 0)
      );
      const isExamSubmitted = isExam && !!(sub.status !== "PENDING" && sub.startedAt);
      const isInteractiveSubmitted = isInteractive && !!(
        (sub.grade !== null && sub.grade !== undefined) ||
        sub.status === "GRADED" ||
        sub.status === "SUBMITTED"
      );
      const isSubmitted = isExam ? isExamSubmitted : isInteractive ? isInteractiveSubmitted : hasUploadedFile;

      const hasActiveExtension = !!(sub.allowLateSubmission || task.allowLateSubmission);
      const hasRealGrade = sub.grade !== null && sub.grade !== undefined && !(hasActiveExtension && (sub.grade === 1 || sub.grade === 1.0) && !hasUploadedFile);

      const shouldHideFeedback = (task.type === "EXAM" || task.type === "FINAL") && !canSeeAnswers;
      const processedSub = { ...sub, feedback: shouldHideFeedback ? null : sub.feedback };

      if (hasActiveExtension && (sub.grade === 1 || sub.grade === 1.0) && !hasUploadedFile) {
        if (isClosed || isTimerExpired) {
          return { ...processedSub, status: "GRADED", grade: 1.0, feedbackTemplate, task };
        }
        return null;
      }

      if (!isSubmitted && !hasRealGrade) {
        if (isClosed || isTimerExpired) {
          return { ...processedSub, status: "GRADED", grade: 1.0, feedbackTemplate, task };
        }
        return null;
      }

      if (sub.status === "PENDING" && (isClosed || isTimerExpired)) {
        return { ...processedSub, status: "GRADED", grade: 1.0, feedbackTemplate, task };
      }

      return { ...processedSub, feedbackTemplate, task };
    }

    if (isClosed) {
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
      return {
        id: `virtual-${task.id}`,
        taskId: task.id, studentId, status: "GRADED", grade: 1.0,
        feedback: null, feedbackTemplate, fileUrl: null, submittedAt: null,
        createdAt: task.dueDate || task.createdAt, updatedAt: task.dueDate || task.updatedAt,
        allowLateSubmission: false, lateSubmissionUntil: null, gdriveEmail: null,
        startedAt: null, attempt: 1, unlockedAnswers: false, task,
      };
    }

    // Open tasks not yet submitted by student and not expired: do not show in Calificaciones
    return null;
  }))).filter((sub): sub is any => sub !== null);

  activeSubmissions.sort((a, b) => new Date(b.updatedAt || b.task.updatedAt).getTime() - new Date(a.updatedAt || a.task.updatedAt).getTime());

  // Fetch additional grades per period for this student
  const additionalGradesDb = await prisma.additionalGrade.findMany({
    where: { studentId, courseId: id },
  });
  const additionalGradesMap = new Map(additionalGradesDb.map(ag => [ag.period, ag.grade]));

  // Compute overall average across all graded items
  const validOverallGrades = activeSubmissions
    .map(s => typeof s.grade === 'number' ? s.grade : parseFloat(s.grade))
    .filter(v => !isNaN(v) && v >= 1 && v <= 5);
  const overallAvg = validOverallGrades.length > 0
    ? validOverallGrades.reduce((a, b) => a + b, 0) / validOverallGrades.length
    : null;

  const gradeColor = (g: number) => g >= 3 ? "var(--success)" : "var(--danger)";

  const renderCard = (sub: any) => {
    const isGraded = sub.status === "GRADED" || sub.grade != null;
    const isPending = sub.status === "SUBMITTED";
    const currentGrade = sub.grade !== null && sub.grade !== undefined ? sub.grade : 0;
    const gColor = isGraded ? gradeColor(currentGrade) : "var(--text-muted)";
    const isSaber = sub.task.type === "EXAM" || sub.task.type === "TASK_SABER" || sub.task.type === "SABER";
    const accentColor = isSaber ? "#8b5cf6" : "var(--primary-color)";

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
              sub.submittedAt === null && !sub.task.isExternal && (sub.grade === 1 || sub.grade === 1.0) && (!sub.feedback || sub.feedback.includes("No asistió") || sub.feedback.includes("No entregó"))
                ? <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Plazo vencido</span>
                : <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>
            )}
            {sub.allowLateSubmission && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5" }}>
                ⏰ Con prórroga
              </span>
            )}
            {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> {sub.submittedAt ? "En revisión" : "Pendiente"}</span>}
            {sub.task.type === "TASK_SABER" && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }}>
                📖 Tarea (Saber)
              </span>
            )}
            {sub.task.type === "EXAM" && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }}>
                📝 Examen (Saber)
              </span>
            )}
            {sub.task.type === "TASK" && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" }}>
                📋 Tarea (Hacer)
              </span>
            )}
            {sub.task.type === "INTERACTIVE" && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }}>
                🎮 Actividad Interactiva (Hacer)
              </span>
            )}
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
          {sub.submittedAt && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.35rem 0", display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
              <Clock size={12} className="text-[#f97316]" />
              <span><strong>Entregado:</strong> {new Date(sub.submittedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {sub.fileUrl && (
                <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 600, marginLeft: "0.5rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  📎 Ver archivo entregado
                </a>
              )}
            </div>
          )}
          {isGraded && sub.feedback && !sub.feedback.includes("Calificado automáticamente") && !sub.feedback.trim().startsWith("[") && (
            <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontStyle: "italic", background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: `3px solid ${accentColor}` }}>
              💬 &quot;{sub.feedback}&quot;
            </div>
          )}
          {isGraded && sub.submittedAt === null && !sub.task.isExternal && (sub.grade === 1 || sub.grade === 1.0) && (!sub.feedback || sub.feedback.includes("No asistió") || sub.feedback.includes("No entregó")) && (
            <p style={{ fontSize: "0.875rem", color: "var(--danger)", marginTop: "0.25rem", fontWeight: 500 }}>Calificación automática por falta de entrega.</p>
          )}
          {!isGraded && (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {sub.submittedAt ? "Tu docente aún no ha calificado esta entrega." : "Actividad pendiente de realización / entrega."}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.25rem", minWidth: "110px", textAlign: "center" }}>
          {isGraded ? (
            <>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: gColor, lineHeight: 1 }}>
                {sub.grade !== null && sub.grade !== undefined ? sub.grade.toFixed(1) : ""}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              {sub.submittedAt ? "Pendiente de revisión" : (sub.task.type === "INTERACTIVE" ? "Por realizar" : "Por entregar")}
            </div>
          )}
          <div className="mt-1 w-full flex justify-center">
            <Link
              href={sub.task.type === "EXAM" || sub.task.type === "FINAL" ? `/estudiante/examenes/${sub.task.id}` : `/estudiante/tareas/${sub.task.id}`}
              className="btn btn-secondary text-xs px-2 py-1 w-full flex justify-center"
            >
              {sub.task.type === "INTERACTIVE"
                ? (isGraded || sub.submittedAt ? "Ver Actividad" : "Ver Detalle")
                : sub.task.isExternal
                ? "Ver Detalle"
                : (sub.submittedAt || (sub.fileUrl && sub.fileUrl.trim() !== "") ? "Ver Entrega" : "Ver Detalle")}
            </Link>
          </div>
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

            const tareas   = periodSubs.filter(s => s.task.type === "TASK" || s.task.type === "TASK_HACER" || s.task.type === "HACER" || s.task.type === "INTERACTIVE");
            const examenes = periodSubs.filter(s => s.task.type === "EXAM" || s.task.type === "TASK_SABER" || s.task.type === "SABER");
            const serSubs   = periodSubs.filter(s => s.task.type === "SER");
            const finalSubs = periodSubs.filter(s => s.task.type === "FINAL");

            const gradedTareas   = tareas.filter(s   => s.status === "GRADED" || s.grade != null);
            const gradedExamenes = examenes.filter(s  => s.status === "GRADED" || s.grade != null);
            const gradedSer      = serSubs.filter(s   => s.status === "GRADED" || s.grade != null);
            const gradedFinal    = finalSubs.filter(s => s.status === "GRADED" || s.grade != null);

            const avg = (arr: any[]) => {
              const validGrades = arr
                .map(x => typeof x.grade === 'number' ? x.grade : parseFloat(x.grade))
                .filter(v => !isNaN(v) && v >= 1 && v <= 5);
              return validGrades.length > 0 ? validGrades.reduce((s, v) => s + v, 0) / validGrades.length : null;
            };
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

                {/* Period Summary Card: Solo Nota Definitiva */}
                {finalGrade !== null && (
                  <div
                    className="card mb-6"
                    style={{
                      borderLeft: `5px solid ${finalGrade >= 3.0 ? "var(--success)" : "var(--danger)"}`,
                      padding: "1.25rem 1.5rem",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1.25rem",
                      background: "var(--bg-primary)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-color)",
                      borderLeftWidth: "5px",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                        Resumen del {periodName}
                      </p>
                      <h3 className="text-xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
                        {periodName}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            finalGrade >= 4.6
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              : finalGrade >= 4.0
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : finalGrade >= 3.0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          Desempeño {
                            finalGrade >= 4.6 ? "Superior" :
                            finalGrade >= 4.0 ? "Alto" :
                            finalGrade >= 3.0 ? "Básico" : "Bajo"
                          }
                        </span>
                        <span className="text-xs text-muted font-medium">
                          {finalGrade >= 3.0 ? "Aprobado" : "Reprobado"}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1.1rem",
                        background: finalGrade >= 3.0 ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                        padding: "0.85rem 1.6rem",
                        borderRadius: "1rem",
                        border: `1.5px solid ${finalGrade >= 3.0 ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                          Nota Definitiva
                        </div>
                        <div style={{ fontSize: "0.75rem", color: gradeColor(finalGrade), fontWeight: 700 }}>
                          {periodName}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "2.6rem",
                          fontWeight: 900,
                          lineHeight: 1,
                          color: gradeColor(finalGrade),
                        }}
                      >
                        {finalGrade.toFixed(1)}
                      </div>
                    </div>
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
                  {(serSubs.length > 0 || additionalGrade !== null) && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Star size={14} style={{ color: "#0d9488" }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0d9488" }}>Ser — Actitudinal</span>
                      </div>
                      {serSubs.length > 0 ? (
                        <div className="flex flex-col gap-3">{serSubs.map(renderCard)}</div>
                      ) : (
                        <div
                          style={{
                            background: "var(--bg-primary)",
                            borderLeft: `4px solid ${gradeColor(additionalGrade!)}`,
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
                            <div style={{ fontSize: "2rem", fontWeight: 800, color: gradeColor(additionalGrade!), lineHeight: 1 }}>
                              {additionalGrade!.toFixed(1)}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>nota</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
