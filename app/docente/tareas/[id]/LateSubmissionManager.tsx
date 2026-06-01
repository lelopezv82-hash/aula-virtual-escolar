"use client";

import { useState } from "react";
import { Clock, Check, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  allowLateSubmission: boolean;
}

interface LateSubmissionManagerProps {
  taskId: string;
  initialTaskAllowLate: boolean;
  students: Student[];
}

export default function LateSubmissionManager({
  taskId,
  initialTaskAllowLate,
  students
}: LateSubmissionManagerProps) {
  const router = useRouter();
  const [taskAllowLate, setTaskAllowLate] = useState(initialTaskAllowLate);
  const [studentAllowLate, setStudentAllowLate] = useState<Record<string, boolean>>(
    students.reduce((acc, s) => {
      acc[s.id] = s.allowLateSubmission;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [loadingTask, setLoadingTask] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState<Record<string, boolean>>({});

  const handleToggleTask = async () => {
    setLoadingTask(true);
    const newValue = !taskAllowLate;
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowLateSubmission: newValue })
      });
      if (res.ok) {
        setTaskAllowLate(newValue);
        router.refresh();
      } else {
        alert("Error al actualizar la configuración de la tarea");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    } finally {
      setLoadingTask(false);
    }
  };

  const handleToggleStudent = async (studentId: string) => {
    setLoadingStudent(prev => ({ ...prev, [studentId]: true }));
    const currentValue = !!studentAllowLate[studentId];
    const newValue = !currentValue;
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
        setStudentAllowLate(prev => ({ ...prev, [studentId]: newValue }));
        router.refresh();
      } else {
        alert("Error al actualizar el permiso del estudiante");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    } finally {
      setLoadingStudent(prev => ({ ...prev, [studentId]: false }));
    }
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Clock className="text-indigo-500" size={18} />
            Control de Entregas Fuera de Plazo
          </h3>
          <p className="text-sm text-muted mt-1">
            Permite a los estudiantes subir tareas después del vencimiento. Puedes activarlo para todo el curso o individualmente por estudiante.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {taskAllowLate ? "Habilitado para todos" : "Bloqueado tras vencer"}
          </span>
          <button
            onClick={handleToggleTask}
            disabled={loadingTask}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              taskAllowLate ? "bg-indigo-600" : "bg-gray-200 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                taskAllowLate ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mini warning showing currently active general setting */}
      {taskAllowLate && (
        <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <Check size={14} />
          La entrega tardía está habilitada para todo el curso. Los permisos individuales no son necesarios actualmente.
        </div>
      )}
    </div>
  );
}
