"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, FileText, Download } from "lucide-react";
import Link from "next/link";

export default function CalificarPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const resolvedParams = use(params);
  const { id: taskId, studentId } = resolvedParams;
  const router = useRouter();

  const [submission, setSubmission] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [grade, setGrade] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetch(`/api/docente/tareas/${taskId}/submission/${studentId}`)
      .then((res) => res.json())
      .then((data) => {
        setTask(data.task);
        setSubmission(data.submission);
        if (data.submission?.grade !== null && data.submission?.grade !== undefined) {
          setGrade(data.submission.grade.toString());
        }
        if (data.submission?.feedback) {
          setFeedback(data.submission.feedback);
        }
      })
      .catch(() => setError("No se pudo cargar la entrega"))
      .finally(() => setInitialLoad(false));
  }, [taskId, studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/docente/calificar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          grade,
          feedback,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push(`/docente/tareas/${taskId}`), 1500);
      } else {
        setError(data.error || "Error al calificar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/docente/tareas/${taskId}`}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Calificar Entrega</h1>
          <p className="text-muted text-sm">{task?.title} — {submission?.student?.name}</p>
        </div>
      </div>

      {/* Archivo entregado */}
      {submission?.fileUrl && (
        <div
          className="card flex items-center gap-4 mb-6"
          style={{ borderLeft: "4px solid var(--primary-color)" }}
        >
          <FileText size={40} className="text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Archivo entregado</p>
            <p className="text-sm text-muted">
              Enviado el{" "}
              {submission.submittedAt
                ? new Date(submission.submittedAt).toLocaleString()
                : "—"}
            </p>
          </div>
          <a
            href={submission.fileUrl}
            download
            target="_blank"
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download size={16} /> Descargar
          </a>
        </div>
      )}

      {/* Formulario de calificación */}
      <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
        {error && <div className="alert alert-danger">{error}</div>}
        {success && (
          <div
            className="alert"
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              fontWeight: 500,
            }}
          >
            ✅ ¡Calificación guardada! Redirigiendo…
          </div>
        )}

        <div className="input-group">
          <label htmlFor="grade">
            Calificación{" "}
            <span className="text-muted text-sm">(escala colombiana 0.0 – 5.0)</span>
          </label>
          <input
            id="grade"
            type="number"
            step="0.1"
            min="0"
            max="5"
            className="input-field"
            placeholder="Ej. 4.5"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="feedback">Retroalimentación / Observaciones</label>
          <textarea
            id="feedback"
            className="input-field"
            rows={4}
            placeholder="Escribe un comentario sobre el trabajo del estudiante…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <div
          className="flex justify-end gap-3 mt-2 border-t pt-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Link href={`/docente/tareas/${taskId}`} className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={loading || success}>
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            Guardar Calificación
          </button>
        </div>
      </form>
    </div>
  );
}
