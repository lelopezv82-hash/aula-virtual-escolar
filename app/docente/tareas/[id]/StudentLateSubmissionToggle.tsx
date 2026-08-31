"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Calendar, Check, X, Sparkles } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { toColombiaISOString, fromColombiaLocalStringToDate } from "@/lib/dateUtils";

interface StudentLateSubmissionToggleProps {
  taskId: string;
  studentId: string;
  studentName: string;
  initialAllowLate: boolean;
  initialLateUntil: string | null;
  disabled: boolean;
}

export default function StudentLateSubmissionToggle({
  taskId,
  studentId,
  studentName,
  initialAllowLate,
  initialLateUntil,
  disabled
}: StudentLateSubmissionToggleProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [allowLate, setAllowLate] = useState(initialAllowLate);
  const [lateUntil, setLateUntil] = useState<string>(toColombiaISOString(initialLateUntil));
  const [loading, setLoading] = useState(false);

  const setPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setLateUntil(toColombiaISOString(d.toISOString()));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docente/calificar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          studentId,
          allowLateSubmission: allowLate,
          lateSubmissionUntil: allowLate && lateUntil ? fromColombiaLocalStringToDate(lateUntil)?.toISOString() : null
        })
      });
      if (res.ok) {
        router.refresh();
        setShowModal(false);
      } else {
        await confirm({
          title: "Error",
          message: "Error al actualizar el permiso de entrega tardía.",
          confirmText: "Aceptar",
          cancelText: null,
          type: "danger"
        });
      }
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Error de Red",
        message: "Error de red al intentar guardar los cambios.",
        confirmText: "Aceptar",
        cancelText: null,
        type: "danger"
      });
    } finally {
      setLoading(false);
    }
  };

  // Determinar texto y estilos del estado actual
  let statusBadge = (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30">
      <X size={12} /> Bloqueado
    </span>
  );

  if (disabled) {
    statusBadge = (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30">
        <Check size={12} /> Habilitado Global
      </span>
    );
  } else if (initialAllowLate) {
    if (initialLateUntil) {
      const dateFormatted = new Date(initialLateUntil).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
      statusBadge = (
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-orange-50 text-[#e06d09] border border-orange-100 dark:bg-orange-950/20 dark:text-[#f98012] dark:border-orange-900/30 shadow-2xs">
          <Clock size={12} /> Prórroga: {dateFormatted}
        </span>
      );
    } else {
      statusBadge = (
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-orange-50 text-[#e06d09] border border-orange-100 dark:bg-orange-950/20 dark:text-[#f98012] dark:border-orange-900/30 shadow-2xs">
          <Check size={12} /> Habilitado Sin Límite
        </span>
      );
    }
  }

  return (
    <>
      <button
        onClick={() => !disabled && setShowModal(true)}
        disabled={disabled}
        title={disabled ? "Ya está habilitado globalmente para la tarea" : "Configurar plazo de entrega para este estudiante"}
        className={`focus:outline-none transition-all ${disabled ? "cursor-not-allowed opacity-80" : "hover:scale-105 active:scale-95 cursor-pointer"}`}
      >
        {statusBadge}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 animate-fade-in text-left">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="text-[#f98012]" size={20} />
                Prórroga de Entrega
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Estudiante: <span className="text-[#f98012] dark:text-[#f98012] font-bold">{studentName}</span>
              </p>
              
              <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800">
                <div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 block">
                    Permitir entrega tardía
                  </span>
                  <span className="text-xs text-muted block mt-0.5">
                    Habilita subir la tarea después del vencimiento.
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

              {allowLate && (
                <div className="mt-4 space-y-3 animate-fade-in p-3.5 rounded-xl bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800">
                  <label className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Calendar size={15} className="text-[#f98012]" />
                    Fecha y hora límite de prórroga:
                  </label>
                  <input
                    type="datetime-local"
                    value={lateUntil}
                    onChange={(e) => setLateUntil(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f98012]/25 focus:border-[#f98012]"
                  />

                  {/* Preset quick buttons */}
                  <div>
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1 mb-1.5">
                      <Sparkles size={12} className="text-[#f98012]" /> Atajos de fecha rápida:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPresetDays(1)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors"
                      >
                        +1 Día
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDays(2)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors"
                      >
                        +2 Días
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDays(3)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors"
                      >
                        +3 Días
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDays(7)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors"
                      >
                        +1 Sem
                      </button>
                      <button
                        type="button"
                        onClick={() => setLateUntil("")}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-muted hover:border-gray-400 transition-colors"
                      >
                        Sin límite
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted italic">
                    * Si no seleccionas una fecha, el alumno podrá entregar su tarea en cualquier momento sin fecha de expiración.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary px-4 py-2 text-sm rounded-xl font-medium"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary px-4 py-2 text-sm rounded-xl font-semibold flex items-center gap-1.5"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
