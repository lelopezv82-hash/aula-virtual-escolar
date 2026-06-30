"use client";

import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

interface ResetSubmissionButtonProps {
  taskId: string;
  studentId: string;
  studentName: string;
  hasSubmission?: boolean;
}

export default function ResetSubmissionButton({ taskId, studentId, studentName, hasSubmission = true }: ResetSubmissionButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const handleReset = async () => {
    const confirmReset = await confirm({
      title: hasSubmission ? "Reiniciar Examen" : "Habilitar Reintento",
      message: hasSubmission
        ? `¿Estás seguro de que deseas reiniciar el examen de ${studentName}? Esto eliminará de forma permanente el intento actual del estudiante (incluyendo respuestas y calificación si las hubiera), permitiéndole iniciar y responder el examen nuevamente.`
        : `¿Estás seguro de que deseas habilitar el examen de ${studentName}? Esto creará un intento para que el estudiante pueda ingresar y responder el examen.`,
      confirmText: "Aceptar",
      cancelText: "Cancelar",
      type: "warning"
    });
    if (!confirmReset) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}/submission/${studentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await confirm({
          title: "Éxito",
          message: hasSubmission 
            ? "Examen reiniciado con éxito. El estudiante ya puede ingresar a resolverlo de nuevo." 
            : "Examen habilitado con éxito. El estudiante ya puede ingresar a resolverlo.",
          confirmText: "Aceptar",
          cancelText: null,
          type: "info"
        });
        router.refresh();
      } else {
        const data = await res.json();
        await confirm({
          title: "Error",
          message: data.error || "Error al procesar la solicitud.",
          confirmText: "Aceptar",
          cancelText: null,
          type: "danger"
        });
      }
    } catch (err) {
      await confirm({
        title: "Error de Red",
        message: "Error de red al intentar procesar la solicitud.",
        confirmText: "Aceptar",
        cancelText: null,
        type: "danger"
      });
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
