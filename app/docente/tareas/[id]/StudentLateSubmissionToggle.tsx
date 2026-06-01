"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StudentLateSubmissionToggleProps {
  taskId: string;
  studentId: string;
  initialValue: boolean;
  disabled: boolean;
}

export default function StudentLateSubmissionToggle({
  taskId,
  studentId,
  initialValue,
  disabled
}: StudentLateSubmissionToggleProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;
    setLoading(true);
    const newValue = !value;
    try {
      const res = await fetch(`/api/docente/calificar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          studentId,
          allowLateSubmission: newValue
        })
      });
      if (res.ok) {
        setValue(newValue);
        router.refresh();
      } else {
        alert("Error al actualizar el permiso");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || loading}
      title={disabled ? "Ya está habilitado globalmente para la tarea" : "Habilitar entrega fuera de plazo para este estudiante"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? "bg-indigo-300 dark:bg-indigo-900/50 cursor-not-allowed" : (value ? "bg-indigo-600" : "bg-gray-200 dark:bg-zinc-700")
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          disabled || value ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
