"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, UploadCloud, Loader2, CheckCircle, FileText, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";

export default function TareaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();

  
  const [task, setTask] = useState<any>(null);
  const [studentName, setStudentName] = useState("");
  const [submission, setSubmission] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimerExpired, setIsTimerExpired] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"danger" | "warning">("danger");
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    // Fetch task and existing submission info
    fetch(`/api/estudiante/tareas/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          if (data.task.type === "EXAM") {
            router.replace(`/estudiante/examenes/${taskId}`);
            return;
          }
          setTask(data.task);
          if (data.studentName) setStudentName(data.studentName);
          if (data.task.submissions && data.task.submissions.length > 0) {
            setSubmission(data.task.submissions[0]);
          }
        }
      })
      .catch(() => setError("No se pudo cargar la tarea"))
      .finally(() => setInitialLoad(false));
  }, [taskId, router]);


  const isGraded = submission?.status === "GRADED";
  const isSubmitted = submission?.status === "SUBMITTED" || isGraded;

  // Check deadline status for grade reason
  const { isClosed: isDeadlinePassed } = task ? getTaskDeadlineStatus(task, submission) : { isClosed: false };
  const neverSubmitted = !submission || submission.status === "PENDING";
  const virtualGraded = neverSubmitted && isDeadlinePassed;
  const gradeReason = virtualGraded ? "No entregaste la tarea a tiempo" : null;

  const triggerAutoSubmit = async () => {
    setIsTimerExpired(true);
    setLoading(true);
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
        setError(data.error || "El tiempo límite ha vencido.");
      }
    } catch {
      setError("Tiempo expirado y error al enviar automáticamente.");
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown hook
  useEffect(() => {
    if (!task || !task.duration || !submission || !submission.startedAt || isSubmitted) {
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
      return;
    } else {
      setTimeLeft(initialLeft);
    }

    const interval = setInterval(() => {
      const left = calculateTimeLeft();
      if (left <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        triggerAutoSubmit();
      } else {
        setTimeLeft(left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [task, submission, isSubmitted]);

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
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  if (!task) {
    return <div className="alert alert-danger">No se encontró la tarea o no tienes acceso.</div>;
  }
  
  const now = new Date();
  const { activeDeadline, hasExtension, isClosed: isSubmissionBlocked, isLate: isOverdue, isUnlimitedExtension } = getTaskDeadlineStatus(task, submission);
  const activeExtensionDate = hasExtension && !isUnlimitedExtension ? activeDeadline : null;

  // Splash screen for timed tasks that haven't started yet
  if (task.duration && (!submission || !submission.startedAt)) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto card p-8 text-center flex flex-col gap-6 mt-10" style={{ borderColor: "var(--border-color)" }}>
        <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 mx-auto w-16 h-16 flex items-center justify-center">
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
            <li>Una vez que hagas clic en "Iniciar Examen", el cronómetro comenzará a correr y no podrá pausarse.</li>
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
  const isGoogleForm = task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle"));
  let embedUrl = task.attachmentUrl || "";
  if (isGoogleForm && embedUrl && studentName) {
    embedUrl = embedUrl.replace("_ESTUDIANTE_", encodeURIComponent(studentName));
    embedUrl = embedUrl.replace("__ESTUDIANTE__", encodeURIComponent(studentName));
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/estudiante/tareas" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-muted text-sm">Vence: {formatToColombiaString(task.dueDate)}</p>
        </div>
      </div>

      {/* Countdown Timer Banner */}
      {task.duration && !isSubmitted && timeLeft !== null && (
        <div className="mb-6 p-4 rounded-xl border flex items-center justify-between animate-pulse" 
             style={{ 
               background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)',
               borderColor: timeLeft < 60 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 99, 235, 0.3)',
               color: timeLeft < 60 ? 'var(--danger)' : 'var(--primary-color)'
             }}>
          <div className="flex items-center gap-2">
            <Clock size={20} className={timeLeft < 60 ? "text-red-500" : "text-blue-500"} />
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
            <FileText className="text-blue-500" size={32} />
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
      {isGoogleForm ? (
        <div className="card mb-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Examen en Línea</h2>
          <div className="relative border rounded-lg overflow-hidden bg-white" style={{ height: "650px", borderColor: "var(--border-color)" }}>
            {isTimerExpired || (timeLeft !== null && timeLeft <= 0) ? (
              <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="text-red-500 mb-4 animate-bounce" size={48} />
                <h3 className="text-xl font-bold text-red-600">Tiempo Expirado</h3>
                <p className="text-muted mt-2 max-w-md">
                  El tiempo límite para completar este examen ha finalizado y el formulario ha sido bloqueado. Tus respuestas parciales se han registrado.
                </p>
              </div>
            ) : isSubmitted ? (
              <div className="absolute inset-0 bg-green-50 dark:bg-green-950/20 flex flex-col items-center justify-center p-6 text-center">
                <CheckCircle className="text-green-500 mb-4" size={48} />
                <h3 className="text-xl font-bold text-green-600">Examen Entregado</h3>
                <p className="text-muted mt-2 max-w-md">
                  Has completado y entregado este examen con éxito.
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

          {!isSubmitted && !isTimerExpired && (
            <div className="flex justify-between items-center mt-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <p className="text-xs text-muted">⚠️ Recuerda dar clic en "Enviar" dentro de Google Forms antes de dar clic aquí.</p>
              <button 
                onClick={handleMarkAsFinished} 
                disabled={loading}
                className="btn btn-primary flex items-center gap-2 py-2.5 px-6"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Finalizar y Entregar Examen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ borderTop: isGraded ? '4px solid var(--success)' : isSubmitted ? '4px solid var(--primary-color)' : '4px solid var(--border-color)' }}>
          <h2 className="text-lg font-bold mb-4">Tu Entrega</h2>

          {isGraded && (
            <div className={`${gradeReason ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4 mb-6`}>
              <h3 className={`font-bold mb-1 flex items-center gap-2 ${gradeReason ? 'text-red-800' : 'text-green-800'}`}>
                {gradeReason ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                {gradeReason ? gradeReason : 'Tarea Calificada'}
              </h3>
              {gradeReason && (
                <p className="text-sm text-red-700 mb-2">Se ha asignado la nota mínima (1.0) de forma automática.</p>
              )}
              <p className={`text-2xl font-black my-2 ${gradeReason ? 'text-red-700' : 'text-green-700'}`}>
                Nota: {submission.grade !== null && submission.grade !== undefined ? Math.max(1.0, Number(submission.grade)).toFixed(1) : submission.grade}
              </p>
              {submission.feedback && (
                <div className={`mt-2 ${gradeReason ? 'text-red-900' : 'text-green-900'}`}>
                  <strong>Comentario del docente:</strong>
                  <p className="italic mt-1">&quot;{submission.feedback}&quot;</p>
                </div>
              )}
            </div>
          )}

          {isSubmitted && !isGoogleForm && (
            <div className="flex items-center gap-3 p-4 border rounded-md mb-6" style={{ borderColor: "var(--border-color)" }}>
              <FileText className="text-blue-500" size={32} />
              <div>
                <p className="font-medium">Archivo entregado</p>
                <p className="text-sm text-muted">Enviado el {formatToColombiaString(submission.submittedAt)}</p>
              </div>
              {submission.fileUrl && (
                <a 
                  href={submission.fileUrl} 
                  target="_blank"
                  download
                  className="btn btn-secondary ml-auto"
                >
                  Descargar
                </a>
              )}
            </div>
          )}

          {!isGraded && !isGoogleForm && (
            isSubmissionBlocked || isTimerExpired ? (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 text-red-800 dark:text-red-350 flex flex-col gap-2">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock size={18} /> Plazo de Entrega Vencido / Tiempo Agotado
                </h3>
                <p className="text-sm">
                  El tiempo límite ha expirado o el plazo original ha vencido. La entrega se ha deshabilitado.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                {isOverdue && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-4 text-indigo-900 dark:text-indigo-200 flex flex-col gap-1">
                    <h3 className="font-bold flex items-center gap-2 text-sm">
                      <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
                      Plazo Extemporáneo Activo
                    </h3>
                    <p className="text-xs">
                      El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde
                      {activeExtensionDate ? ` hasta el ${formatToColombiaString(activeExtensionDate)}.` : " sin límite de tiempo definido."}
                    </p>
                  </div>
                )}
                {error && (
                  errorType === "warning" ? (
                    <div className="flex items-center gap-3 p-4 border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-900 dark:text-amber-200 animate-scale-in">
                      <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0" size={20} />
                      <div className="flex-1 text-sm font-medium">
                        {error}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 rounded-xl text-red-900 dark:text-red-200 animate-scale-in">
                      <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
                      <div className="flex-1 text-sm font-medium">
                        {error}
                      </div>
                    </div>
                  )
                )}
                
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--primary-color)' }}>
                  <UploadCloud size={48} className="mx-auto mb-4" style={{ color: 'var(--primary-color)' }} />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="btn btn-secondary mx-auto mb-2 inline-flex">Seleccionar Archivo</span>
                    <input 
                      id="file-upload" 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileChange} 
                    />
                  </label>
                  <p className="text-sm text-muted mt-2">
                    {file ? file.name : "Soporta PDF, DOCX, Imágenes y archivos comprimidos."}
                  </p>
                </div>

                <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (isSubmitted ? "Reemplazar Entrega" : "Enviar Tarea")}
                </button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}

