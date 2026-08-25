"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, UploadCloud, Loader2, CheckCircle, FileText, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";
import { useConfirm } from "@/components/ConfirmProvider";

export default function TareaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();
  const confirm = useConfirm();

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
  const [isEditing, setIsEditing] = useState(false);

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

  const hasActiveExtension = !!(submission?.allowLateSubmission || task?.allowLateSubmission);
  const hasUploadedFile = !!(submission?.fileUrl && submission.fileUrl.trim() !== "");
  const isAutomaticGrade1 = (submission?.grade === 1 || submission?.grade === 1.0) && hasActiveExtension && !hasUploadedFile;

  const isGraded = (submission?.status === "GRADED" && !isAutomaticGrade1) || (submission?.grade != null && !isAutomaticGrade1);
  const isSubmitted = hasUploadedFile || (task?.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")) && submission?.status === "SUBMITTED");

  // Check deadline status for grade reason
  const { isClosed: isDeadlinePassed } = task ? getTaskDeadlineStatus(task, submission) : { isClosed: false };
  const neverSubmitted = !hasUploadedFile && !isSubmitted;
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
      if (!submission.allowLateSubmission) {
        setIsTimerExpired(true);
        setTimeLeft(0);
      }
      return;
    } else {
      setTimeLeft(initialLeft);
    }

    const interval = setInterval(() => {
      const left = calculateTimeLeft();
      if (left <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        if (!submission.allowLateSubmission) {
          triggerAutoSubmit();
        }
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
        setIsEditing(false);
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

  const handleDelete = async () => {
    const confirmDelete = await confirm({
      title: "Borrar entrega",
      message: "¿Estás seguro de que deseas borrar tu entrega? Esto eliminará el archivo enviado y restablecerá el estado a 'No entregado'.",
      confirmText: "Borrar entrega",
      cancelText: "Cancelar",
      type: "warning"
    });
    if (!confirmDelete) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/estudiante/submissions?taskId=${taskId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission(null);
        setIsEditing(false);
        setFile(null);
      } else {
        setError(data.error || "Error al borrar la entrega.");
      }
    } catch {
      setError("Error de conexión al eliminar la entrega.");
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

  // Get clean filename from absolute URL
  function getFileNameFromUrl(url: string, defaultFallback: string = "Documento adjunto"): string {
    if (!url || typeof url !== "string") return defaultFallback;
    try {
      const decoded = decodeURIComponent(url);
      const cleanUrl = decoded.split("?")[0].replace(/\/(view|preview|edit|copy|download)\/?$/i, "");
      const parts = cleanUrl.split("/").filter(Boolean);
      let fileName = parts[parts.length - 1] || "";

      if (fileName.includes("_")) {
        const subParts = fileName.split("_");
        if (subParts.length > 1) {
          const lastSub = subParts[subParts.length - 1];
          if (lastSub && lastSub.includes(".")) {
            fileName = lastSub;
          } else {
            const tsIdx = subParts.findIndex(p => /^\d{10,}$/.test(p));
            if (tsIdx !== -1 && tsIdx < subParts.length - 1) {
              fileName = subParts.slice(tsIdx + 1).join("_");
            }
          }
        }
      }

      if (!fileName || ["view", "edit", "preview", "file", "d", "uc"].includes(fileName.toLowerCase()) || !fileName.includes(".")) {
        return defaultFallback;
      }

      return fileName;
    } catch {
      return defaultFallback;
    }
  }

  // Get standard Moodle icon based on file type
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
  
  const { activeDeadline, isClosed: isSubmissionBlocked, isLate: isOverdue } = getTaskDeadlineStatus(task, submission);
  const isGoogleForm = task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle"));
  
  const teacherName = task.course?.teacher?.name || "Docente";
  const initials = teacherName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  const canEditOrDelete = (!isGraded || isAutomaticGrade1 || hasActiveExtension) && !isSubmissionBlocked && (!isTimerExpired || hasActiveExtension) && !task.isExternal && !isGoogleForm;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto px-4 py-6">
      {/* Title section with pink icon */}
      <div className="flex items-start gap-4 mb-6">
        <Link
          href={task?.courseId ? `/estudiante/cursos/${task.courseId}` : "/estudiante"}
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
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 uppercase leading-none">{task.title}</h1>
              {task.type === "TASK_SABER" || task.type === "SABER" ? (
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-purple-100 text-purple-800 border border-purple-200">
                  Dimensión: El Saber (Cognitivo)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-orange-100 text-orange-800 border border-orange-200">
                  Dimensión: El Hacer (Procedimental)
                </span>
              )}
            </div>
            {task.dueDate && new Date(task.dueDate).getFullYear() < 9000 && (
              <p className="text-muted text-sm mt-1">Vence: {formatToColombiaString(task.dueDate)}</p>
            )}
          </div>
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
            <Clock size={20} className={timeLeft < 60 ? "text-red-500" : "text-[#f98012]"} />
            <span className="font-bold text-sm">Tiempo restante para finalizar:</span>
          </div>
          <div className="text-xl font-black font-mono">
            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
            {(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Instructions Card & Teacher Uploaded Attachment */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold mb-3 text-gray-900">Instrucciones</h2>
        <p className="whitespace-pre-wrap text-gray-700 text-sm mb-4 leading-relaxed">
          {task.description
            ? task.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
            : ""}
        </p>

        {task.resources && task.resources.length > 0 && (
          <div className="mb-4 border-t pt-4 border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Materiales y Recursos Vinculados</h3>
            <div className="flex flex-col gap-2">
              {task.resources.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2.5 p-2.5 border rounded-lg bg-gray-50 text-sm border-gray-200">
                  <span className="text-base">{getFileIcon(r.url)}</span>
                  <span className="font-semibold text-gray-700 flex-1">{r.title}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#f98012] font-semibold hover:underline text-xs"
                  >
                    Ver Material →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* Editing / Uploading form */}
      {isEditing ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm animate-scale-in">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Subir archivo de entrega</h2>
          
          {error && (
            <div className="flex items-center gap-3 p-4 border border-red-200 bg-red-50 rounded-xl text-red-900 mb-4 animate-scale-in">
              <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
              <div className="flex-1 text-sm font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
              <UploadCloud size={48} className="mx-auto mb-4 text-[#f98012]" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="btn btn-secondary mx-auto mb-2 inline-flex">Seleccionar Archivo</span>
                <input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
              <p className="text-sm text-gray-555 mt-2">
                {file ? file.name : "Soporta PDF, DOCX, Imágenes y archivos comprimidos."}
              </p>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setFile(null); setError(""); }} 
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 text-sm hover:bg-gray-50 font-medium transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-[#f98012] hover:bg-[#e06d09] text-white font-medium text-sm rounded flex items-center gap-2 transition-colors"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Action buttons (Moodle styled, light grey, under file guide) */}
          {canEditOrDelete && (
            <div className="flex items-center gap-3 mb-6">
              {isSubmitted ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 border border-gray-300 text-gray-800 font-semibold text-sm rounded transition-colors cursor-pointer"
                  >
                    Editar entrega
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 border border-gray-300 text-gray-800 font-semibold text-sm rounded transition-colors cursor-pointer"
                  >
                    Borrar entrega
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[#f98012] hover:bg-[#e06d09] text-white font-semibold text-sm rounded shadow-sm transition-colors cursor-pointer"
                >
                  Agregar entrega
                </button>
              )}
            </div>
          )}

          {/* Submission status table */}
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
                    {task.isExternal ? (
                      isGraded ? (
                         <span className="px-3 py-1 bg-[#d4edda] text-[#155724] border border-[#c3e6cb] rounded-sm text-xs font-bold uppercase w-max inline-flex items-center gap-1">
                           ✅ Registrado por el docente
                         </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-sm text-xs font-bold uppercase w-max inline-flex items-center gap-1">
                            ⏳ Pendiente de validación
                          </span>
                          <span className="text-xs text-gray-500 italic">Esta actividad es de entrega física. El docente registrará tu calificación.</span>
                        </div>
                      )
                    ) : isSubmitted ? (
                      <span className="px-3 py-1 bg-[#d4edda] text-[#155724] rounded-sm text-xs font-semibold uppercase">
                        Enviado para calificar
                      </span>
                    ) : (isDeadlinePassed || isSubmissionBlocked || isTimerExpired) ? (
                      <span className="px-3 py-1 bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] rounded-sm text-xs font-bold uppercase">
                        No entregado (Plazo vencido)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-sm text-xs font-semibold uppercase">
                        No entregado
                      </span>
                    )}
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
                
                {/* Última modificación */}
                <tr className="border-b border-gray-100">
                  <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Última modificación</td>
                  <td className="p-4 align-middle">
                    {submission?.submittedAt ? formatMoodleDate(submission.submittedAt, true) : "-"}
                  </td>
                </tr>
                
                {/* Archivos enviados */}
                {!isGoogleForm && !task.isExternal && (
                  <tr className="border-b border-gray-100">
                    <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Archivos enviados</td>
                    <td className="p-4 align-middle">
                      {submission?.fileUrl ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xl shrink-0">{getFileIcon(submission.fileUrl)}</span>
                          <a 
                            href={submission.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                          >
                            {getFileNameFromUrl(submission.fileUrl, "Archivo de entrega")}
                          </a>
                          <span className="text-gray-400 text-xs shrink-0">
                            {formatMoodleDate(submission.submittedAt)}
                          </span>
                        </div>
                      ) : "-"}
                    </td>
                  </tr>
                )}


              </tbody>
            </table>
          </div>

          {/* Overdue/Closed/Grace messages if not submitted */}
          {!isSubmitted && (isSubmissionBlocked || isDeadlinePassed || (isTimerExpired && !submission?.allowLateSubmission)) && !task.isExternal && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex flex-col gap-1 mb-8 animate-scale-in">
              <h3 className="font-bold flex items-center gap-2">
                <Clock size={18} /> Plazo de Entrega Vencido / Tiempo Agotado
              </h3>
              <p className="text-sm">
                El tiempo límite ha expirado o el plazo original ha vencido sin registrarse ninguna entrega de archivos. La entrega se encuentra deshabilitada.
              </p>
            </div>
          )}

          {!isSubmitted && isOverdue && !isSubmissionBlocked && (!isTimerExpired || submission?.allowLateSubmission) && !task.isExternal && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-[#7c3d00] flex flex-col gap-1 mb-8 animate-scale-in">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Clock size={16} className="text-[#f98012]" />
                Plazo Extemporáneo Activo
              </h3>
              <p className="text-xs">
                El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde hasta el {formatToColombiaString(activeDeadline)}.
              </p>
            </div>
          )}

          {/* Feedback/Grading section ("Comentario") */}
          {isGraded && (
            <div className="mt-10 animate-fade-in">
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
                        {submission.grade !== null && submission.grade !== undefined 
                          ? `${Number(submission.grade).toFixed(2).replace('.', ',')} / 5,00` 
                          : "Pendiente"}
                      </td>
                    </tr>
                    
                    {/* Calificado sobre */}
                    <tr className="border-b border-gray-100">
                      <td className="w-1/3 bg-gray-50/50 p-4 font-semibold text-gray-600 align-middle">Calificado sobre</td>
                      <td className="p-4 align-middle">
                        {submission.updatedAt ? formatMoodleDate(submission.updatedAt, true) : "-"}
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
                        {submission?.feedback ? (
                          submission.feedback
                        ) : (!isSubmitted && !task.isExternal && (isDeadlinePassed || isSubmissionBlocked || isTimerExpired)) ? (
                          <span className="text-gray-500 italic">Actividad no entregada dentro del plazo establecido.</span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
