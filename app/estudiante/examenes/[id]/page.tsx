"use client";

import { useState, useEffect, use, useCallback } from "react";
import { ArrowLeft, UploadCloud, Loader2, CheckCircle, FileText, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";
import { useConfirm } from "@/components/ConfirmProvider";
import ExamenNativo from "../ExamenNativo";

export default function TareaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();
  const confirm = useConfirm();

  const [task, setTask] = useState<any>(null);
  const [studentName, setStudentName] = useState("");
  const [submission, setSubmission] = useState<any>(null);
  const [feedbackTemplate, setFeedbackTemplate] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimerExpired, setIsTimerExpired] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"danger" | "warning">("danger");
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasSentGoogleForm, setHasSentGoogleForm] = useState(false);

  const fetchTaskDetails = useCallback(() => {
    // Fetch task and existing submission info
    fetch(`/api/estudiante/tareas/${taskId}?_=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          if (data.task.type !== "EXAM") {
            router.replace(`/estudiante/tareas/${taskId}`);
            return;
          }
          setTask(data.task);
          if (data.studentName) setStudentName(data.studentName);
          if (data.feedbackTemplate) setFeedbackTemplate(data.feedbackTemplate);
          if (data.task.submissions && data.task.submissions.length > 0) {
            setSubmission(data.task.submissions[0]);
          }
        }
      })
      .catch(() => setError("No se pudo cargar la tarea"))
      .finally(() => setInitialLoad(false));
  }, [taskId, router]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const now = new Date();
  const isNativeExam = !!(task?.questions && task.questions.length > 0);
  const isGoogleForm = !isNativeExam && !!(task?.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));
  
  // Detect if the student's individual timer has expired
  const timerHasExpired = isTimerExpired || !!(submission?.startedAt && task?.duration && 
    (new Date(submission.startedAt).getTime() + task.duration * 60 * 1000 < now.getTime()));

  // Check if late submissions are blocked (overdue and no extensions)
  const { isClosed, isLate: isOverdue, activeDeadline } = getTaskDeadlineStatus(task, submission);

  // If the exam is closed/expired and never finished/submitted:
  // For Google Forms: virtual 1.0 if closed or timer expired.
  // For Native Exams: virtual 1.0 only if never started and closed. If started, we will submit their saved answers.
  const virtualSubmission = ((!submission || submission.status === "PENDING") && isClosed && isGoogleForm) ||
                            (submission && submission.status === "PENDING" && timerHasExpired && isGoogleForm) ||
                            (!submission && isClosed && isNativeExam)
    ? { status: "GRADED", grade: 1.0, feedback: null, submittedAt: null, fileUrl: null, attempt: submission?.attempt || 1, unlockedAnswers: submission?.unlockedAnswers || false }
    : null;

  const activeSubmission = (submission && submission.status !== "PENDING") ? submission : (virtualSubmission || submission);

  const isGraded = activeSubmission?.status === "GRADED";
  const isSubmitted = activeSubmission?.status === "SUBMITTED" || isGraded;

  // Determine the reason for minimum grade (1.0)
  const neverStarted = !submission || (submission.status === "PENDING" && !submission.startedAt);
  const hasAnswers = submission?.answers && Object.keys(submission.answers as Record<string, unknown>).length > 0;
  const startedButEmpty = submission && submission.startedAt && submission.status !== "PENDING"
    && submission.grade !== null && submission.grade <= 1.0
    && !hasAnswers;
  const gradeReason = (virtualSubmission && neverStarted)
    ? "No presentaste el examen a tiempo"
    : (virtualSubmission && !neverStarted && !hasAnswers)
      ? "No respondiste ninguna pregunta"
      : startedButEmpty
        ? "No respondiste ninguna pregunta"
        : null;

  // Polling to check if webhook has graded the exam
  useEffect(() => {
    if (!task || !isGoogleForm) return;

    const isDefinitivelyGraded = submission?.status === "GRADED" && submission?.grade !== null && submission?.grade !== 1.0;
    if (isDefinitivelyGraded) return;

    const gradedAt = submission?.submittedAt ? new Date(submission.submittedAt).getTime() : null;
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    if (submission?.status === "GRADED" && gradedAt && gradedAt < twoMinutesAgo) return;

    const interval = setInterval(() => {
      fetch(`/api/estudiante/tareas/${taskId}?_=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.task && data.task.submissions && data.task.submissions.length > 0) {
            const sub = data.task.submissions[0];
            setSubmission(sub);
            if (data.feedbackTemplate) setFeedbackTemplate(data.feedbackTemplate);
            if (sub.status === "GRADED" && sub.grade !== null && sub.grade !== 1.0) {
              clearInterval(interval);
            }
          }
        })
        .catch(err => console.error("Error polling submission status:", err));
    }, 3000);
    return () => clearInterval(interval);
  }, [task, taskId, isGoogleForm, submission?.status, submission?.grade]);

  const triggerAutoSubmit = useCallback(async () => {
    setIsTimerExpired(true);
    setLoading(true);
    try {
      const isNative = !!(task?.questions && task.questions.length > 0);
      let res;
      if (isNative) {
        res = await fetch(`/api/estudiante/tareas/${taskId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: {} })
        });
      } else {
        const formData = new FormData();
        formData.append("taskId", taskId);
        res = await fetch("/api/estudiante/submissions", {
          method: "POST",
          body: formData,
        });
      }
      const data = await res.json();
      if (res.ok) {
        setSubmission(data.submission);
      } else {
        setError(data.error || "El tiempo límite ha vencido.");
      }
    } catch {
      setError("Tiempo expirado y error al enviar automáticamente.");
    } finally {
      setLoading(false);
    }
  }, [taskId, task]);

  // If the native exam is closed and the student has a PENDING submission, trigger auto-submit immediately
  useEffect(() => {
    if (task && isNativeExam && submission && submission.status === "PENDING" && isClosed && !loading && !isSubmitted) {
      triggerAutoSubmit();
    }
  }, [task, isNativeExam, submission, submission?.status, isClosed, loading, isSubmitted, triggerAutoSubmit]);

  // Timer countdown hook
  useEffect(() => {
    if (!task || !task.duration || !submission || !submission.startedAt || isSubmitted || isTimerExpired) {
      return;
    }

    const calculateTimeLeft = () => {
      const start = new Date(submission.startedAt).getTime();
      const end = start + task.duration * 60 * 1000;
      const nowTime = new Date().getTime();
      const diff = Math.floor((end - nowTime) / 1000);
      return diff;
    };

    const initialLeft = calculateTimeLeft();
    if (initialLeft <= 0) {
      setIsTimerExpired(true);
      setTimeLeft(0);
      triggerAutoSubmit();
      return;
    } else {
      setTimeLeft(initialLeft);
    }

    const interval = setInterval(() => {
      const left = calculateTimeLeft();
      if (left <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        setIsTimerExpired(true);
        triggerAutoSubmit();
      } else {
        setTimeLeft(left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [task, submission, isSubmitted, isTimerExpired, triggerAutoSubmit]);

  const handleStartExam = async () => {
    setStartingExam(true);
    setError("");
    try {
      const res = await fetch(`/api/estudiante/tareas/${taskId}/start`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission(data.submission);
      } else {
        setError(data.error || "No se pudo iniciar el examen");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setStartingExam(false);
    }
  };

  const handleStartSecondAttempt = async () => {
    const confirmAttempt = await confirm({
      title: "Realizar Segundo Intento",
      message: "⚠️ IMPORTANTE: ¿Estás seguro de que deseas iniciar tu segundo intento? Tu calificación anterior será reemplazada y no podrás ver las respuestas del primer intento. El cronómetro iniciará de cero.",
      confirmText: "Iniciar Intento",
      cancelText: "Cancelar",
      type: "warning"
    });
    if (!confirmAttempt) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/estudiante/tareas/${taskId}/second-attempt`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission(data.submission);
        router.refresh();
      } else {
        setError(data.error || "No se pudo iniciar el segundo intento");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsFinished = async () => {
    const confirmSubmit = await confirm({
      title: "Finalizar y Entregar Examen",
      message: "¿Estás seguro de que deseas finalizar y entregar el examen?\n\n" +
        "⚠️ IMPORTANTE: Asegúrate de haber presionado el botón 'Enviar' (Submit) DENTRO del formulario de Google antes de hacer clic en Aceptar.\n\n" +
        "Si entregas el examen ahora sin haber enviado tus respuestas en Google Forms, no quedarán registradas y no podrás volver a abrir el examen.",
      confirmText: "Aceptar",
      cancelText: "Cancelar",
      type: "warning"
    });
    if (!confirmSubmit) return;

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("taskId", taskId);
      const res = await fetch("/api/estudiante/submissions", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission(data.submission);
      } else {
        setError(data.error || "Error al entregar el examen.");
      }
    } catch {
      setError("Error de conexión al guardar la entrega.");
    } finally {
      setLoading(false);
    }
  };

  // Moodle-style date formatter (e.g. "jueves, 14 de mayo de 2026, 18:30" or "6 de mayo de 2026, 05:40")
  function formatMoodleDate(dateInput: Date | string | null | undefined, includeDayName: boolean = false): string {
    if (!dateInput) return "-";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    
    const formatter = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      weekday: includeDayName ? 'long' : undefined,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(d);
    let weekday = '';
    let day = '';
    let month = '';
    let year = '';
    let hour = '';
    let minute = '';
    
    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value;
      else if (part.type === 'day') day = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'year') year = part.value;
      else if (part.type === 'hour') hour = part.value;
      else if (part.type === 'minute') minute = part.value;
    }
    
    weekday = weekday.toLowerCase().replace(/[\.,]/g, '');
    month = month.toLowerCase();
    
    const dateStr = `${day} de ${month} de ${year}`;
    const timeStr = `${hour}:${minute}`;
    
    if (includeDayName && weekday) {
      return `${weekday}, ${dateStr}, ${timeStr}`;
    }
    return `${dateStr}, ${timeStr}`;
  }

  function getFileNameFromUrl(url: string): string {
    if (!url) return "archivo";
    try {
      const decoded = decodeURIComponent(url);
      const urlObj = new URL(decoded);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        const fileParts = lastPart.split('%2F');
        return fileParts[fileParts.length - 1];
      }
    } catch {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        return lastPart.split('?')[0];
      }
    }
    return "archivo";
  }

  function getFileIcon(url: string) {
    if (!url) return "📎";
    const cleanUrl = url.toLowerCase().split('?')[0];
    if (cleanUrl.endsWith('.pdf')) return "📄";
    if (cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx')) return "📝";
    if (cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx')) return "📊";
    if (cleanUrl.endsWith('.ppt') || cleanUrl.endsWith('.pptx')) return "📉";
    if (cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.gif')) return "🖼️";
    if (cleanUrl.endsWith('.zip') || cleanUrl.endsWith('.rar') || cleanUrl.endsWith('.tar') || cleanUrl.endsWith('.gz')) return "📦";
    return "📎";
  }

  if (initialLoad) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#f98012]" size={40} /></div>;
  }

  if (!task) {
    return <div className="alert alert-danger">No se encontró la tarea o no tienes acceso.</div>;
  }

  // Splash screen for timed tasks that haven't started yet
  if (task.duration && (!submission || !submission.startedAt)) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto card p-8 text-center flex flex-col gap-6 mt-10" style={{ borderColor: "var(--border-color)" }}>
        <div className="p-4 rounded-full bg-orange-50 dark:bg-orange-950/30 text-[#f98012] dark:text-[#f98012] mx-auto w-16 h-16 flex items-center justify-center animate-scale-in">
          <Clock size={36} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary mb-2">Evaluación con Tiempo Límite</h1>
          <p className="text-muted text-sm">
            Esta tarea es un examen que tiene un límite de tiempo de <strong>{task.duration} minutos</strong>.
          </p>
        </div>
        
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 rounded-lg p-4 text-left text-sm flex flex-col gap-2">
          <p className="font-bold flex items-center gap-1">⚠️ IMPORTANTE:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Una vez que hagas clic en &quot;Iniciar Examen&quot;, el cronómetro comenzará a correr y no podrá pausarse.</li>
            <li>Al terminarse el tiempo, tus respuestas se guardarán y enviarán automáticamente.</li>
            <li>Asegúrate de tener buena conexión y terminar antes de que el reloj llegue a cero.</li>
          </ul>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button 
          onClick={handleStartExam} 
          disabled={startingExam}
          className="btn btn-primary w-full py-3 text-base flex justify-center items-center gap-2"
        >
          {startingExam ? <Loader2 className="animate-spin" size={20} /> : "Iniciar Examen"}
        </button>
      </div>
    );
  }

  // Google Forms check and embed URL preparation
  let embedUrl = task.attachmentUrl || "";
  if (isGoogleForm && embedUrl && studentName) {
    embedUrl = embedUrl.replace("_ESTUDIANTE_", encodeURIComponent(studentName));
    embedUrl = embedUrl.replace("__ESTUDIANTE__", encodeURIComponent(studentName));
  }

  const teacherName = task.course?.teacher?.name || "Docente";
  const initials = teacherName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto px-4 py-6">
      {/* Title section with pink icon */}
      <div className="flex items-start gap-4 mb-6">
        <Link
          href={task?.courseId ? `/estudiante/cursos/${task.courseId}/examenes?estado=${submission && submission.status !== "PENDING" ? "presentados" : "disponibles"}` : "/estudiante"}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors mt-1 animate-scale-in"
        >
          <ArrowLeft size={24} />
        </Link>
        <div className="flex items-start gap-4 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-[#f012be] bg-white text-[#f012be] shrink-0 shadow-sm mt-1 animate-scale-in">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 uppercase leading-none">{task.title}</h1>
            <p className="text-muted text-sm mt-1">Vence: {formatToColombiaString(task.dueDate)}</p>
          </div>
        </div>
      </div>

      {/* Countdown Timer Banner */}
      {task.duration && !isSubmitted && timeLeft !== null && timeLeft > 0 && (
        <div className="mb-6 p-4 rounded-xl border flex items-center justify-between animate-pulse" 
             style={{ 
               background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)',
               borderColor: timeLeft < 60 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 99, 235, 0.3)',
               color: timeLeft < 60 ? 'var(--danger)' : 'var(--primary-color)'
             }}>
          <div className="flex items-center gap-2">
            <Clock size={20} className={timeLeft < 60 ? "text-red-500" : "text-[#f98012]"} />
            <span className="font-bold text-sm">Tiempo restante para finalizar:</span>
          </div>
          <div className="text-xl font-black font-mono">
            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
            {(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Instructions Card & Guidelines */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold mb-3 text-gray-900">Instrucciones</h2>
        <p className="whitespace-pre-wrap text-gray-700 text-sm mb-4 leading-relaxed">
          {task.description
            ? task.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
            : ""}
        </p>

        {/* Normal file link styled in Moodle style */}
        {task.attachmentUrl && !isGoogleForm && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
            <span className="text-xl shrink-0">{getFileIcon(task.attachmentUrl)}</span>
            <a 
              href={task.attachmentUrl} 
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm break-all"
            >
              {getFileNameFromUrl(task.attachmentUrl)}
            </a>
            <span className="text-gray-500 text-xs ml-auto shrink-0">
              {formatMoodleDate(task.createdAt || task.updatedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Conditional rendering: if submitted, show Moodle status page, else show exam presentation */}
      {isSubmitted ? (
        <>
          {/* Attempt information and status table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8 shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Estado de la entrega</h2>
            </div>
            <table className="w-full border-collapse text-left text-sm text-gray-700">
              <tbody>
                {/* Estado de la entrega */}
                <tr className="border-b border-gray-100">
                  <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Estado de la entrega</td>
                  <td className="p-4 align-middle">
                    <span className="px-3 py-1 bg-[#d4edda] text-[#155724] rounded-sm text-xs font-semibold uppercase">
                      Finalizado
                    </span>
                  </td>
                </tr>
                
                {/* Estado de la calificación */}
                <tr className="border-b border-gray-100">
                  <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Estado de la calificación</td>
                  <td className="p-4 align-middle">
                    {isGraded ? (
                      <span className="px-3 py-1 bg-[#d4edda] text-[#155724] rounded-sm text-xs font-semibold uppercase">
                        Calificado
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-sm text-xs font-semibold uppercase">
                        Sin calificar
                      </span>
                    )}
                  </td>
                </tr>
                
                {/* Última modificación / Fecha de finalización */}
                <tr className="border-b border-gray-100">
                  <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Última modificación</td>
                  <td className="p-4 align-middle">
                    {activeSubmission?.submittedAt ? formatMoodleDate(activeSubmission.submittedAt, true) : "-"}
                  </td>
                </tr>
                
                {/* Intentos */}
                {activeSubmission?.attempt && (
                  <tr className="border-b border-gray-100">
                    <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Intento</td>
                    <td className="p-4 align-middle font-medium text-gray-800">
                      {activeSubmission.attempt}
                    </td>
                  </tr>
                )}

                {/* Comentarios de la entrega */}
                <tr>
                  <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Comentarios de la entrega</td>
                  <td className="p-4 align-middle">
                    <details className="group cursor-pointer">
                      <summary className="text-blue-600 hover:underline flex items-center gap-1 font-medium list-none select-none">
                        <span className="inline-block transition-transform duration-200 group-open:rotate-90 text-[10px]">▶</span>
                        Comentarios (0)
                      </summary>
                      <p className="text-gray-400 text-xs mt-2 pl-4 cursor-default">No hay comentarios en esta entrega.</p>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Feedback/Grading section ("Comentario") */}
          {isGraded && (
            <div className="mt-10 mb-8 animate-fade-in">
              <div className="p-1 mb-4">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">Comentario</h2>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-left text-sm text-gray-700">
                  <tbody>
                    {/* Calificación */}
                    <tr className="border-b border-gray-100">
                      <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Calificación</td>
                      <td className="p-4 align-middle font-bold text-gray-950 text-base">
                        {activeSubmission.grade !== null && activeSubmission.grade !== undefined 
                          ? `${Math.max(1.0, Number(activeSubmission.grade)).toFixed(2).replace('.', ',')} / 5,00` 
                          : "-"}
                      </td>
                    </tr>
                    
                    {/* Calificado sobre */}
                    <tr className="border-b border-gray-100">
                      <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Calificado sobre</td>
                      <td className="p-4 align-middle">
                        {activeSubmission.updatedAt ? formatMoodleDate(activeSubmission.updatedAt, true) : "-"}
                      </td>
                    </tr>
                    
                    {/* Calificado por */}
                    <tr className="border-b border-gray-100">
                      <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Calificado por</td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          {task.course?.teacher?.profilePic ? (
                            <img 
                              src={task.course.teacher.profilePic} 
                              alt={teacherName} 
                              className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#e9ecef] text-[#495057] font-semibold flex items-center justify-center text-xs uppercase shadow-sm border border-gray-300">
                              {initials}
                            </div>
                          )}
                          <span className="text-gray-800 font-semibold">{teacherName}</span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Comentarios de retroalimentación */}
                    <tr>
                      <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Comentarios de retroalimentación</td>
                      <td className="p-4 align-middle text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {activeSubmission.feedback || "Excelente actividad"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Graded messages if applicable */}
          {gradeReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-8 animate-scale-in">
              <h3 className="font-bold flex items-center gap-2">
                <AlertTriangle size={18} /> {gradeReason}
              </h3>
              <p className="text-sm mt-1">Se ha asignado la nota mínima (1.0) de forma automática.</p>
            </div>
          )}

          {/* If it's a native exam, render ExamenNativo below for review */}
          {isNativeExam && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Revisión de Preguntas</h2>
              <ExamenNativo
                taskId={taskId}
                questions={task.questions}
                submission={submission}
                onSubmissionUpdated={(sub) => {
                  setSubmission(sub);
                  fetchTaskDetails();
                }}
                isTimerExpired={isTimerExpired}
                isClosed={isClosed}
              />
            </div>
          )}

          {/* Re-attempt action button if allowed (e.g. native exam with 2 attempts, or if they haven't started second attempt yet) */}
          {isNativeExam && activeSubmission?.attempt === 1 && !isClosed && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleStartSecondAttempt}
                disabled={loading}
                className="px-6 py-3 bg-[#f98012] hover:bg-[#e06d09] text-white font-bold rounded shadow transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin mr-2 inline" size={20} /> : null}
                Realizar Segundo Intento
              </button>
            </div>
          )}
        </>
      ) : (
        /* Render exam taking view if not submitted yet */
        <div className="mt-4">
          {isNativeExam ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Evaluación del Examen</h2>
              <ExamenNativo
                taskId={taskId}
                questions={task.questions}
                submission={submission}
                onSubmissionUpdated={(sub) => {
                  setSubmission(sub);
                  fetchTaskDetails();
                }}
                isTimerExpired={isTimerExpired}
                isClosed={isClosed}
              />
            </div>
          ) : task.isExternal ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center flex flex-col gap-3 shadow-sm">
              <Clock size={36} className="text-muted opacity-40 mx-auto" />
              <p className="text-muted text-sm">La calificación para este examen entregado al docente aún no ha sido registrada.</p>
            </div>
          ) : task.attachmentUrl ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-4 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Examen en Línea</h2>
              
              {!timerHasExpired && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm flex flex-col gap-2">
                  <p className="font-bold flex items-center gap-1">💡 Enlace Externo:</p>
                  <p>Si el examen no carga correctamente abajo, puedes abrirlo directamente en una nueva pestaña:</p>
                  <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary self-start text-xs font-semibold py-1.5 px-3">
                    Abrir examen en nueva pestaña
                  </a>
                </div>
              )}

              <div className="relative border rounded-lg overflow-hidden bg-white" style={{ height: "650px", borderColor: "var(--border-color)" }}>
                {timerHasExpired ? (
                  <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                    <AlertTriangle className="text-red-500 mb-4 animate-bounce" size={48} />
                    <h3 className="text-xl font-bold text-red-600">Tiempo Expirado</h3>
                    <p className="text-muted mt-2 max-w-md">
                      El tiempo límite para completar este examen ha finalizado y el formulario ha sido bloqueado.
                    </p>
                  </div>
                ) : (
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    marginHeight={0}
                    marginWidth={0}
                  >
                    Cargando formulario...
                  </iframe>
                )}
              </div>

              {!timerHasExpired && (
                <div className="flex flex-col gap-3 mt-2 border-t pt-4 border-gray-100">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <p className="text-xs text-gray-500">⚠️ Una vez que completes tu examen en el enlace de arriba, haz clic aquí para registrar tu entrega en el aula virtual.</p>
                    <button 
                      onClick={handleMarkAsFinished} 
                      disabled={loading}
                      className="px-5 py-2.5 bg-[#f98012] hover:bg-[#e06d09] text-white font-semibold text-sm rounded flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      Finalizar y Entregar Examen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center flex flex-col gap-4 border-t-4 border-t-red-500 shadow-sm">
              <AlertTriangle className="text-amber-500 mx-auto" size={48} />
              <h2 className="text-xl font-bold">Enlace no Configurado</h2>
              <p className="text-muted text-sm max-w-md mx-auto">
                Este examen no tiene un enlace de evaluación configurado por el docente. Por favor, comunícate con tu profesor para que asigne el formulario correspondiente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
