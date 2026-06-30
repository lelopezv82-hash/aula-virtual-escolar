"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, UploadCloud, Loader2, CheckCircle, FileText, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import EvidenciaBotones from "@/app/estudiante/examenes/EvidenciaBotones";

export default function TareaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"danger" | "warning">("danger");
  const [initialLoad, setInitialLoad] = useState(true);
  const [started, setStarted] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState("");

  useEffect(() => {
    // Fetch task and existing submission info
    fetch(`/api/estudiante/tareas/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          setTask(data.task);
          if (data.studentName) {
            setStudentName(data.studentName);
          }
          if (data.task.submissions && data.task.submissions.length > 0) {
            setSubmission(data.task.submissions[0]);
            if (data.task.submissions[0].startedAt) {
              setStarted(true);
            }
          }
        }
      })
      .catch(() => setError("No se pudo cargar la tarea"))
      .finally(() => setInitialLoad(false));
  }, [taskId]);

  useEffect(() => {
    if (!started || !task?.timeLimit || !submission?.startedAt || submission?.status === 'GRADED' || submission?.status === 'SUBMITTED') return;

    // Initial calculation immediately
    const calculateTime = () => {
      const startedTime = new Date(submission.startedAt).getTime();
      const limitMs = task.timeLimit * 60 * 1000;
      const endTime = startedTime + limitMs;
      const nowMs = new Date().getTime();
      const diff = endTime - nowMs;

      if (diff <= 0) {
        setTimeLeftStr("00:00 - Tiempo Agotado");
        return false;
      } else {
        const mins = Math.floor(diff / 1000 / 60);
        const secs = Math.floor((diff / 1000) % 60);
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        return true;
      }
    };
    
    calculateTime();
    const intervalId = setInterval(() => {
      if (!calculateTime()) clearInterval(intervalId);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [started, task, submission]);

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/estudiante/submissions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission((prev: any) => ({ ...prev, startedAt: data.startedAt }));
        setStarted(true);
      } else {
        setError(data.error);
        setErrorType("danger");
      }
    } catch {
      setError("Error al iniciar el examen");
      setErrorType("danger");
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

  const handleUpload = async (e: React.FormEvent, isMarkAsDone: boolean = false) => {
    e.preventDefault();
    if (!isMarkAsDone && !file) {
      setError("¡Ups! Falta el archivo. Por favor, selecciona el archivo de tu tarea antes de enviarla.");
      setErrorType("warning");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("taskId", taskId);
    if (file) {
      formData.append("file", file);
    }
    if (isMarkAsDone) {
      formData.append("markAsDone", "true");
    }

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

  if (initialLoad) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  if (!task) {
    return <div className="alert alert-danger">No se encontró la tarea o no tienes acceso.</div>;
  }

  const isGraded = submission?.status === "GRADED";
  const isSubmitted = submission?.status === "SUBMITTED" || isGraded;
  
  const now = new Date();
  const isOverdue = task ? new Date(task.dueDate) < now : false;
  
  // Prórroga activa general o individual
  const generalLateUntil = task?.lateSubmissionUntil ? new Date(task.lateSubmissionUntil) : null;
  const studentLateUntil = submission?.lateSubmissionUntil ? new Date(submission.lateSubmissionUntil) : null;
  
  const hasGeneralExtension = task?.allowLateSubmission || (generalLateUntil && generalLateUntil > now);
  const hasStudentExtension = submission?.allowLateSubmission || (studentLateUntil && studentLateUntil > now);
  
  const isLateSubmissionAllowed = task ? (hasGeneralExtension || hasStudentExtension) : false;
  const isSubmissionBlocked = isOverdue && !isLateSubmissionAllowed;
  
  // Determinar la fecha límite de la prórroga si existe y no ha expirado
  const activeExtensionDate = studentLateUntil && studentLateUntil > now 
    ? studentLateUntil 
    : (generalLateUntil && generalLateUntil > now ? generalLateUntil : null);

  const isGoogleForm = task?.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle"));

  const finalIframeUrl = task?.attachmentUrl 
    ? task.attachmentUrl.replace(/(?:_|%5F|%20|\+|-)*ESTUDIANTE(?:_|%5F|%20|\+|-|%5f)*/gi, encodeURIComponent(studentName || "")) 
    : "";

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={task.type === 'EXAM' ? "/estudiante/examenes" : "/estudiante/tareas"} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-muted text-sm">Vence: {new Date(task.dueDate).toLocaleString()}</p>
        </div>
      </div>

      <div className="card mb-6">
        {task.description && (
          <>
            <h2 className="text-lg font-bold mb-2">Instrucciones</h2>
            <p className="whitespace-pre-wrap mb-4" style={{ color: "var(--text-secondary)" }}>
              {task.description}
            </p>
          </>
        )}

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

        {isGoogleForm && !isSubmitted && !isGraded && (
          <div className="mt-4 border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b flex items-center justify-between gap-2 text-blue-800 dark:text-blue-300" style={{ borderColor: "var(--border-color)" }}>
              <span className="text-sm font-medium">📝 Por favor responde el siguiente formulario:</span>
              {task.timeLimit && started && (
                <span className="font-bold font-mono bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Clock size={16} /> {timeLeftStr}
                </span>
              )}
            </div>
            
            {!task.timeLimit || started ? (
              <iframe 
                src={finalIframeUrl.includes("embedded=true") ? finalIframeUrl : `${finalIframeUrl}${finalIframeUrl.includes("?") ? "&" : "?"}embedded=true`}
                width="100%" 
                height="800" 
                frameBorder="0" 
                marginHeight={0} 
                marginWidth={0}
                className="bg-white"
              >
                Cargando formulario...
              </iframe>
            ) : (
              <div className="p-12 text-center flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                <Clock size={48} className="text-amber-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Examen con Límite de Tiempo</h3>
                <p className="mb-6 text-muted max-w-md mx-auto">
                  Este examen tiene una duración máxima de <strong>{task.timeLimit} minutos</strong>. 
                  Una vez que hagas clic en el botón, el temporizador comenzará y no se podrá pausar.
                </p>
                <button 
                  onClick={handleStartExam} 
                  disabled={loading}
                  className="btn btn-primary text-lg px-8 py-3"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Comenzar Examen Ahora"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ borderTop: isGraded ? '4px solid var(--success)' : isSubmitted ? '4px solid var(--primary-color)' : '4px solid var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4">Tu Entrega</h2>

        {isGraded && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-green-800 mb-1 flex items-center gap-2">
              <CheckCircle size={18} /> {task?.type === "EXAM" ? "Examen Calificado" : "Tarea Calificada"}
            </h3>
            <p className="text-2xl font-black text-green-700 my-2">Nota: {submission.grade}</p>
            {submission.feedback && !submission.feedback.includes("Calificado automáticamente por Google Forms") && !submission.feedback.trim().startsWith("[") && (
              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                <strong className="text-green-900 flex items-center gap-2 mb-2">
                  <FileText size={16} />
                  Comentario del docente:
                </strong>
                <p className="italic text-green-800">&quot;{submission.feedback}&quot;</p>
              </div>
            )}
            
            {isGoogleForm && submission.feedback && (
              <div className="mt-4 border-t border-green-200 pt-4">
                <EvidenciaBotones 
                  exam={{
                    id: task.id,
                    title: task.title,
                    course: { name: task.course?.name || "Asignatura" }
                  }}
                  submission={{
                    grade: submission.grade,
                    status: submission.status,
                    fileUrl: submission.fileUrl,
                    submittedAt: submission.submittedAt,
                    feedback: submission.feedback
                  }}
                  isGoogleForm={isGoogleForm}
                />
              </div>
            )}
          </div>
        )}

        {isSubmitted && !isGoogleForm && (
          <div className="flex items-center gap-3 p-4 border rounded-md mb-6" style={{ borderColor: "var(--border-color)" }}>
            <FileText className="text-blue-500" size={32} />
            <div>
              <p className="font-medium">Archivo entregado</p>
              <p className="text-sm text-muted">Enviado el {new Date(submission.submittedAt).toLocaleString()}</p>
            </div>
            <a 
              href={submission.fileUrl} 
              target="_blank"
              download
              className="btn btn-secondary ml-auto"
            >
              Descargar
            </a>
          </div>
        )}

        {isSubmitted && isGoogleForm && !isGraded && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-800 mb-1 flex items-center gap-2">
              <CheckCircle size={18} /> Formulario Recibido
            </h3>
            <p className="text-sm text-blue-700">Tu examen ha sido recibido. Actualiza la página si la calificación automática está activada.</p>
          </div>
        )}

        {!isGraded && !isGoogleForm && (
          isSubmissionBlocked ? (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 text-red-800 dark:text-red-350 flex flex-col gap-2">
              <h3 className="font-bold flex items-center gap-2">
                <Clock size={18} /> Plazo de Entrega Vencido
              </h3>
              <p className="text-sm">
                El plazo para subir esta tarea ha vencido y la entrega ha sido desactivada. Comunícate con tu docente si necesitas habilitar la entrega extemporánea.
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
                    {activeExtensionDate ? ` hasta el ${activeExtensionDate.toLocaleString()}.` : " sin límite de tiempo definido."}
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
    </div>
  );
}
