"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, Loader2, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";

export default function TareaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();
  
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    // Fetch task and existing submission info
    fetch(`/api/estudiante/tareas/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          setTask(data.task);
          if (data.task.submissions && data.task.submissions.length > 0) {
            setSubmission(data.task.submissions[0]);
          }
        }
      })
      .catch(() => setError("No se pudo cargar la tarea"))
      .finally(() => setInitialLoad(false));
  }, [taskId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Por favor selecciona un archivo.");
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
      }
    } catch (err) {
      setError("Error de conexión al servidor.");
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
  
  const isOverdue = task ? new Date(task.dueDate) < new Date() : false;
  const isLateSubmissionAllowed = task ? (task.allowLateSubmission || !!submission?.allowLateSubmission) : false;
  const isSubmissionBlocked = isOverdue && !isLateSubmissionAllowed;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/estudiante/tareas" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-muted text-sm">Vence: {new Date(task.dueDate).toLocaleString()}</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-bold mb-2">Instrucciones</h2>
        <p className="whitespace-pre-wrap mb-4" style={{ color: "var(--text-secondary)" }}>
          {task.description}
        </p>

        {task.attachmentUrl && (
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

      <div className="card" style={{ borderTop: isGraded ? '4px solid var(--success)' : isSubmitted ? '4px solid var(--primary-color)' : '4px solid var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4">Tu Entrega</h2>

        {isGraded && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-green-800 mb-1 flex items-center gap-2">
              <CheckCircle size={18} /> Tarea Calificada
            </h3>
            <p className="text-2xl font-black text-green-700 my-2">Nota: {submission.grade}</p>
            {submission.feedback && (
              <div className="mt-2 text-green-900">
                <strong>Comentario del docente:</strong>
                <p className="italic mt-1">"{submission.feedback}"</p>
              </div>
            )}
          </div>
        )}

        {isSubmitted && (
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

        {!isGraded && (
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
              {error && <div className="alert alert-danger">{error}</div>}
              
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

              <button type="submit" className="btn btn-primary mt-2" disabled={!file || loading}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : (isSubmitted ? "Reemplazar Entrega" : "Enviar Tarea")}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
