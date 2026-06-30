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
  const { isClosed, isLate: isOverdue, activeDeadline, isUnlimitedExtension } = getTaskDeadlineStatus(task, submission);

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

    // Stop polling only if already GRADED with a real grade (not the auto-submit placeholder 1.0).
    // If grade is exactly 1.0, keep polling for up to 2 min to capture the real webhook grade.
    const isDefinitivelyGraded = submission?.status === "GRADED" && submission?.grade !== null && submission?.grade !== 1.0;
    if (isDefinitivelyGraded) return;

    // Also stop if GRADED for more than 2 minutes (webhook likely won't come)
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
            // Stop polling when we have a definitive non-1.0 grade
            if (sub.status === "GRADED" && sub.grade !== null && sub.grade !== 1.0) {
              clearInterval(interval);
            }
          }
        })
        .catch(err => console.error("Error polling submission status:", err));
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("¡Ups! Falta el archivo. Por favor, selecciona el archivo de tu tarea antes de enviarla.");
      setErrorType("warning");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("taskId", taskId);
    formData.append("file", file);

    try {
      const res = await fetch("/api/estudiante/submissions", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSubmission(data.submission);
        setFile(null);
      } else {
        setError(data.error || "Error al enviar la tarea.");
        setErrorType("danger");
      }
    } catch {
      setError("Error de conexión al servidor.");
      setErrorType("danger");
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

  if (initialLoad) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#f98012]" size={40} /></div>;
  }

  if (!task) {
    return <div className="alert alert-danger">No se encontró la tarea o no tienes acceso.</div>;
  }
  
  // Variables computed early

  // Splash screen for timed tasks that haven't started yet
  if (task.duration && (!submission || !submission.startedAt)) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto card p-8 text-center flex flex-col gap-6 mt-10" style={{ borderColor: "var(--border-color)" }}>
        <div className="p-4 rounded-full bg-orange-50 dark:bg-orange-950/30 text-[#f98012] dark:text-[#f98012] mx-auto w-16 h-16 flex items-center justify-center">
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

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={task?.courseId ? `/estudiante/cursos/${task.courseId}/examenes?estado=${submission && submission.status !== "PENDING" ? "presentados" : "disponibles"}` : "/estudiante"}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </Link>

        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-muted text-sm">Vence: {formatToColombiaString(task.dueDate)}</p>
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


      <div className="card mb-6">
        <h2 className="text-lg font-bold mb-2">Instrucciones</h2>
        <p className="whitespace-pre-wrap mb-4" style={{ color: "var(--text-secondary)" }}>
          {task.description}
        </p>

        {/* Normal file link if it is not embedded as Google Form */}
        {task.attachmentUrl && !isGoogleForm && (
          <div className="flex items-center gap-3 p-4 border rounded-md" style={{ borderColor: "var(--border-color)", background: "var(--bg-primary)" }}>
            <FileText className="text-[#f98012]" size={32} />
            <div>
              <p className="font-medium">Guía / Archivo Adjunto</p>
              <p className="text-xs text-muted">Subido por el docente</p>
            </div>
            <a 
              href={task.attachmentUrl} 
              target="_blank"
              download
              className="btn btn-secondary ml-auto"
            >
              Descargar Guía
            </a>
          </div>
        )}
      </div>

      {/* Exam Iframe or normal upload area */}
      {isNativeExam ? (
        <div className="card mb-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Evaluación del Examen</h2>
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
        <div className="card mb-6" style={{ borderTop: isGraded ? '4px solid var(--success)' : '4px solid #8b5cf6' }}>
          <h2 className="text-lg font-bold mb-4">Evaluación del Examen</h2>

          {isGraded ? (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-1 flex items-center gap-2 text-green-800" style={{ color: "var(--success)" }}>
                <CheckCircle size={18} /> Examen Calificado
              </h3>
              <p className="text-2xl font-black my-2 text-green-700" style={{ color: "var(--success)" }}>
                Nota: {activeSubmission.grade !== null && activeSubmission.grade !== undefined ? Math.max(1.0, Number(activeSubmission.grade)).toFixed(1) : ""}
              </p>
              {activeSubmission.feedback && (
                <div className="mt-2 text-green-900" style={{ color: "var(--text-primary)" }}>
                  <strong>Comentario del docente:</strong>
                  <p className="italic mt-1" style={{ color: "var(--text-secondary)" }}>&quot;{activeSubmission.feedback}&quot;</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <Clock size={36} className="text-muted opacity-40" />
              <p className="text-muted text-sm">Tu docente aún no ha registrado tu calificación para este examen presencial / externo.</p>
            </div>
          )}
        </div>
      ) : task.attachmentUrl ? (
        <div className="card mb-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Examen en Línea</h2>
          
          {!isSubmitted && !timerHasExpired && !isGoogleForm && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 rounded-lg p-4 text-sm flex flex-col gap-2">
              <p className="font-bold flex items-center gap-1">💡 Enlace Externo:</p>
              <p>Si el examen no carga correctamente abajo, puedes abrirlo directamente en una nueva pestaña:</p>
              <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary self-start text-xs font-semibold py-1.5 px-3">
                Abrir examen en nueva pestaña
              </a>
            </div>
          )}

          <div className="relative border rounded-lg overflow-hidden bg-white" style={{ height: "650px", borderColor: "var(--border-color)" }}>
            {activeSubmission?.status === "GRADED" ? (
              <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center overflow-y-auto ${gradeReason ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
                {gradeReason ? (
                  <AlertTriangle className="text-red-500 mb-2 shrink-0" size={48} />
                ) : (
                  <CheckCircle className="text-green-500 mb-2 shrink-0" size={48} />
                )}
                <h3 className={`text-xl font-bold ${gradeReason ? 'text-red-600' : 'text-green-600'}`}>
                  {gradeReason ? gradeReason : 'Examen Calificado'}
                </h3>
                <p className="text-muted mt-1 max-w-md text-sm">
                  {gradeReason
                    ? 'Se ha asignado la nota mínima (1.0) de forma automática.'
                    : 'Has completado y entregado este examen con éxito. Tu calificación ya está registrada.'
                  }
                </p>
                
                <div className={`my-4 p-4 rounded-full bg-white dark:bg-gray-800 shadow-md border-2 flex flex-col items-center justify-center w-32 h-32 mx-auto shrink-0 animate-fade-in ${gradeReason ? 'border-red-500' : 'border-green-500'}`}>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Nota</span>
                  <span className={`text-3xl font-black ${gradeReason ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {activeSubmission.grade !== null && activeSubmission.grade !== undefined ? Math.max(1.0, Number(activeSubmission.grade)).toFixed(1) : ""}
                  </span>
                </div>

              </div>
            ) : (activeSubmission?.status === "SUBMITTED" && isGoogleForm && !timerHasExpired) ? (
              <div className="absolute inset-0 bg-orange-50 dark:bg-orange-950/20 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="animate-spin text-[#f98012] mb-4" size={48} />
                <h3 className="text-xl font-bold text-[#f98012]">Procesando respuestas</h3>
                <p className="text-muted mt-2 max-w-sm">
                  Estamos recuperando tu nota y respuestas de Google Forms. Esto puede tomar unos segundos...
                </p>
                <p className="text-xs text-gray-400 mt-4 max-w-xs">
                  Si ya presionaste &quot;Enviar&quot; en el formulario, esta página se actualizará automáticamente.
                </p>
              </div>
            ) : (activeSubmission?.status === "SUBMITTED" && isGoogleForm && timerHasExpired) ? (
              <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="text-red-500 mb-4 animate-bounce" size={48} />
                <h3 className="text-xl font-bold text-red-600">Tiempo Expirado</h3>
                <p className="text-muted mt-2 max-w-md">
                  El tiempo límite ha finalizado y el formulario ha sido bloqueado.
                </p>
                <p className="text-sm text-muted mt-2 max-w-md">
                  Si presionaste &quot;Enviar&quot; en Google Forms durante el tiempo límite o el período de gracia, tus respuestas se procesarán en breve.
                </p>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                  <span className="text-xs text-gray-400">Buscando calificaciones en el servidor...</span>
                </div>
              </div>
            ) : isSubmitted ? (
              <div className="absolute inset-0 bg-green-50 dark:bg-green-950/20 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                <CheckCircle className="text-green-500 mb-4" size={48} />
                <h3 className="text-xl font-bold text-green-600">Examen Entregado</h3>
                <p className="text-muted mt-2 max-w-md">
                  Has completado y entregado este examen con éxito.
                </p>

              </div>
            ) : timerHasExpired ? (
              <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="text-red-500 mb-4 animate-bounce" size={48} />
                <h3 className="text-xl font-bold text-red-600">Tiempo Expirado</h3>
                <p className="text-muted mt-2 max-w-md">
                  El tiempo límite para completar este examen ha finalizado y el formulario ha sido bloqueado. Tus respuestas parciales se han registrado.
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

          {!isSubmitted && !timerHasExpired && !isGoogleForm && (
            <div className="flex flex-col gap-3 mt-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-xs text-muted">⚠️ Una vez que completes tu examen en el enlace de arriba, haz clic aquí para registrar tu entrega en el aula virtual.</p>
                <button 
                  onClick={handleMarkAsFinished} 
                  disabled={loading}
                  className="btn btn-primary flex items-center gap-2 py-2.5 px-6"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  Finalizar y Entregar Examen
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center flex flex-col gap-4 border-t-4 border-t-red-500">
          <AlertTriangle className="text-amber-500 mx-auto" size={48} />
          <h2 className="text-xl font-bold">Enlace no Configurado</h2>
          <p className="text-muted text-sm max-w-md mx-auto">
            Este examen no tiene un enlace de evaluación configurado por el docente. Por favor, comunícate con tu profesor para que asigne el formulario correspondiente.
          </p>
        </div>
      )}
    </div>
  );
}

