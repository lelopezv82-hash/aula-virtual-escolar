"use client";

import { useState } from "react";
import { Clock, Check, AlertCircle, Save, Calendar, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  allowLateSubmission: boolean;
  lateSubmissionUntil?: string | null;
}

interface LateSubmissionManagerProps {
  taskId: string;
  initialTaskAllowLate: boolean;
  initialTaskLateUntil?: string | null;
  students: Student[];
}

export default function LateSubmissionManager({
  taskId,
  initialTaskAllowLate,
  initialTaskLateUntil,
  students
}: LateSubmissionManagerProps) {
  const router = useRouter();
  const [taskAllowLate, setTaskAllowLate] = useState(initialTaskAllowLate);
  const [lateUntil, setLateUntil] = useState<string>(
    initialTaskLateUntil ? new Date(new Date(initialTaskLateUntil).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16) : ""
  );
  
  const [studentAllowLate, setStudentAllowLate] = useState<Record<string, boolean>>(
    students.reduce((acc, s) => {
      acc[s.id] = s.allowLateSubmission;
      return acc;
    }, {} as Record<string, boolean>)
  );
  
  const [loadingTask, setLoadingTask] = useState(false);

  const handleSaveConfig = async (allowLate: boolean, untilDate: string) => {
    setLoadingTask(true);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          allowLateSubmission: allowLate,
          lateSubmissionUntil: allowLate && untilDate ? new Date(untilDate).toISOString() : null
        })
      });
      if (res.ok) {
        router.refresh();
        alert("Configuración de prórroga general guardada con éxito.");
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

  const handleToggleSwitch = async () => {
    const nextState = !taskAllowLate;
    setTaskAllowLate(nextState);
    if (!nextState) {
      // Si se desactiva, guardar inmediatamente
      await handleSaveConfig(false, "");
    }
  };

  return (
    <div className="mb-6 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 no-print transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <Clock className="text-indigo-500" size={18} />
            Control de Entregas Fuera de Plazo
          </h3>
          <p className="text-sm text-muted mt-1">
            Permite a los estudiantes subir tareas después del vencimiento. Puedes activarlo para todo el curso o de forma individual.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {taskAllowLate ? "Habilitado para todos" : "Bloqueado tras vencer"}
          </span>
          <button
            onClick={handleToggleSwitch}
            disabled={loadingTask}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              taskAllowLate ? "bg-indigo-600" : "bg-gray-200 dark:bg-zinc-700"
            } ${loadingTask ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                taskAllowLate ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Panel de configuración de fecha extemporánea cuando la entrega tardía está activada */}
      {taskAllowLate && (
        <div className="mt-4 p-4 border border-indigo-100/50 dark:border-indigo-900/20 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl animate-fade-in flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="flex-1">
            <label className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 mb-1.5">
              <Calendar size={14} className="text-indigo-500" />
              Fecha y hora límite de prórroga general (Opcional):
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={lateUntil}
                onChange={(e) => setLateUntil(e.target.value)}
                className="w-full max-w-md px-3.5 py-2.0 text-sm rounded-lg border border-gray-200 dark:border-zinc-800 dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
              />
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/60 mt-1">
              * Si no defines fecha/hora, la prórroga estará activa indefinidamente.
            </p>
          </div>
          
          <button
            onClick={() => handleSaveConfig(true, lateUntil)}
            disabled={loadingTask}
            className="btn btn-primary px-4 py-2 text-sm rounded-lg font-semibold flex items-center gap-1.5 self-start md:self-end bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white"
          >
            <Save size={16} />
            {loadingTask ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      )}

      {/* Mini warning showing currently active general setting */}
      {taskAllowLate && (
        <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
          La entrega tardía está habilitada a nivel general. Los estudiantes podrán entregar la tarea hasta la fecha límite extemporánea configurada arriba.
        </div>
      )}
    </div>
  );
}
