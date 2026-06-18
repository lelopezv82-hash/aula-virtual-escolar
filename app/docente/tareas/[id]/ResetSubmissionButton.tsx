"use client";

import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ResetSubmissionButtonProps {
  taskId: string;
  studentId: string;
  studentName: string;
  hasSubmission?: boolean;
}

export default function ResetSubmissionButton({ taskId, studentId, studentName, hasSubmission = true }: ResetSubmissionButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    const confirmReset = window.confirm(
      hasSubmission
        ? `¿Estás seguro de que deseas reiniciar el examen de ${studentName}?\n\n` +
          "⚠️ Esto eliminará de forma permanente el intento actual del estudiante (incluyendo respuestas y calificación si las hubiera), " +
          "permitiéndole iniciar y responder el examen nuevamente."
        : `¿Estás seguro de que deseas habilitar el examen de ${studentName}?\n\n` +
          "Esto creará un intento para que el estudiante pueda ingresar y responder el examen."
    );
    if (!confirmReset) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}/submission/${studentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert(hasSubmission ? "Examen reiniciado con éxito. El estudiante ya puede ingresar a resolverlo de nuevo." : "Examen habilitado con éxito. El estudiante ya puede ingresar a resolverlo.");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Error al procesar la solicitud.");
      }
    } catch (err) {
      alert("Error de red al intentar procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
      title={hasSubmission ? "Reiniciar entrega para que pueda volver a resolverlo" : "Habilitar entrega para que pueda resolverlo"}
    >
      {loading ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
      {hasSubmission ? "Reiniciar Intento" : "Habilitar Reintento"}
    </button>
  );
}
