"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, Check, X, Users, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toColombiaISOString } from "@/lib/dateUtils";

interface BulkProrrogaModalProps {
  taskId: string;
  selectedStudents: { id: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BulkProrrogaModal({
  taskId,
  selectedStudents,
  isOpen,
  onClose,
  onSuccess
}: BulkProrrogaModalProps) {
  const router = useRouter();

  // Calculate default date (tomorrow at 23:59 Colombia time)
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    return toColombiaISOString(d.toISOString());
  };

  const [allowLate, setAllowLate] = useState(true);
  const [lateUntil, setLateUntil] = useState<string>(getDefaultDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAllowLate(true);
      setLateUntil(getDefaultDate());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const setPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setLateUntil(toColombiaISOString(d.toISOString()));
  };

  const handleSave = async () => {
    if (selectedStudents.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/docente/tareas/${taskId}/prorroga`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents.map(s => s.id),
          allowLateSubmission: allowLate,
          lateSubmissionUntil: allowLate && lateUntil ? lateUntil : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al aplicar la prórroga masiva");
      }

      router.refresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving bulk late submission:", err);
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-zinc-800 text-left relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f98012]">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Prórroga de Entrega Masiva
              </h3>
              <p className="text-xs text-muted">
                Configura la nueva fecha y hora para los estudiantes seleccionados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Estudiantes seleccionados */}
          <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-zinc-800/40 border border-orange-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#e06d09] dark:text-[#f98012] flex items-center gap-1.5">
                <Users size={14} /> Estudiantes seleccionados ({selectedStudents.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {selectedStudents.map(student => (
                <span
                  key={student.id}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 shadow-xs font-medium"
                >
                  {student.name}
                </span>
              ))}
            </div>
          </div>

          {/* Switch permitir entrega tardía */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800">
            <div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                Habilitar prórroga de entrega
              </span>
              <span className="text-xs text-muted block mt-0.5">
                {allowLate 
                  ? "Los estudiantes seleccionados podrán enviar su tarea tras vencer."
                  : "Se bloqueará la entrega para estos estudiantes si ya venció el plazo general."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAllowLate(!allowLate)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allowLate ? "bg-[#f98012]" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowLate ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Configuración de Fecha y Hora si allowLate está activo */}
          {allowLate && (
            <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 space-y-3 animate-fade-in">
              <label className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Calendar size={15} className="text-[#f98012]" />
                Nueva fecha y hora límite de prórroga:
              </label>

              <input
                type="datetime-local"
                value={lateUntil}
                onChange={(e) => setLateUntil(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-zinc-700 dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f98012]/30 focus:border-[#f98012]"
              />

              {/* Botones de atajos rápidos */}
              <div>
                <span className="text-[11px] font-semibold text-muted flex items-center gap-1 mb-1.5">
                  <Sparkles size={12} className="text-[#f98012]" /> Atajos de fecha rápida:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPresetDays(1)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] dark:hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors shadow-2xs"
                  >
                    +1 Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDays(2)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] dark:hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors shadow-2xs"
                  >
                    +2 Días
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDays(3)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] dark:hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors shadow-2xs"
                  >
                    +3 Días
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDays(7)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] dark:hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors shadow-2xs"
                  >
                    +1 Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setLateUntil("")}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-gray-400 text-muted transition-colors shadow-2xs"
                  >
                    Sin fecha límite (Indefinido)
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                * Si no seleccionas una fecha, los estudiantes podrán entregar su tarea sin fecha límite de expiración.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-900/40">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <span className="text-xs text-muted font-medium">
            Se actualizarán <strong>{selectedStudents.length}</strong> {selectedStudents.length === 1 ? 'estudiante' : 'estudiantes'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || selectedStudents.length === 0}
              className="px-5 py-2 text-sm font-bold text-white bg-[#f98012] hover:bg-[#e06d09] rounded-xl shadow-md flex items-center gap-2 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Aplicar Prórroga ({selectedStudents.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
