"use client";

import { useState } from "react";
import { RotateCcw, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

interface ResetAllSubmissionsButtonProps {
  taskId: string;
  groupId?: string;
  groupName?: string;
  studentCount: number;
}

export default function ResetAllSubmissionsButton({
  taskId,
  groupId,
  groupName,
  studentCount,
}: ResetAllSubmissionsButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const label = groupName ? `Grupo ${groupName}` : "Todos los grupos";

  const handleResetAll = async () => {
    const confirmReset = await confirm({
      title: "Reiniciar Intentos del Grupo",
      message:
        `¿Estás seguro de que deseas reiniciar el examen para los ${studentCount} estudiante(s) del ${label}?\n\n` +
        `⚠️ IMPORTANTE: Esta acción eliminará de forma permanente el intento actual de cada estudiante (incluyendo respuestas y calificaciones), permitiéndoles iniciar el examen nuevamente desde cero.`,
      confirmText: "Reiniciar Todo",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!confirmReset) return;

    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (groupId) body.groupId = groupId;

      const res = await fetch(`/api/docente/tareas/${taskId}/reset-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        await confirm({
          title: "Reinicio Completado",
          message: `Se reiniciaron exitosamente los intentos de ${data.resetCount} estudiante(s). Ya pueden ingresar a resolver el examen nuevamente.`,
          confirmText: "Aceptar",
          cancelText: null,
          type: "info",
        });
        router.refresh();
      } else {
        await confirm({
          title: "Error",
          message: data.error || "Error al reiniciar los intentos.",
          confirmText: "Aceptar",
          cancelText: null,
          type: "danger",
        });
      }
    } catch {
      await confirm({
        title: "Error de Red",
        message: "Error de red al intentar reiniciar los intentos.",
        confirmText: "Aceptar",
        cancelText: null,
        type: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleResetAll}
      disabled={loading || studentCount === 0}
      className="btn btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title={`Reiniciar el examen para todos los estudiantes del ${label}`}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={14} />
      ) : (
        <Users size={14} />
      )}
      Reiniciar Grupo
    </button>
  );
}
