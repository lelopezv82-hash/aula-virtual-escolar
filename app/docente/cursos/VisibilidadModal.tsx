"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Save, Loader2, ShieldAlert, CheckCircle2, BookOpen, ClipboardList, FileText, Folder, Award, Bell } from "lucide-react";

interface Props {
  courseId: string;
  courseName: string;
  initialHiddenSections?: string[];
  initialPeriod1Active?: boolean;
  initialPeriod2Active?: boolean;
  initialPeriod3Active?: boolean;
  initialPeriod4Active?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SECTIONS = [
  {
    key: "descripcion",
    label: "Descripción y Módulos de la Asignatura",
    description: "Vista principal del curso con unidades, temas y tareas organizadas por módulos.",
    icon: <BookOpen size={18} className="text-primary" style={{ color: "var(--primary-color)" }} />,
  },
  {
    key: "tareas",
    label: "Sección de Tareas",
    description: "Lista de actividades y entregas asignadas a los estudiantes.",
    icon: <ClipboardList size={18} className="text-amber-500" style={{ color: "#f59e0b" }} />,
  },
  {
    key: "examenes",
    label: "Sección de Exámenes y Quizzes",
    description: "Evaluaciones en línea y pruebas nativas/formularios.",
    icon: <FileText size={18} className="text-purple-500" style={{ color: "#a855f7" }} />,
  },
  {
    key: "recursos",
    label: "Recursos y Materiales",
    description: "Archivos, documentos PDF, guías y enlaces publicados.",
    icon: <Folder size={18} className="text-emerald-500" style={{ color: "#10b981" }} />,
  },
  {
    key: "calificaciones",
    label: "Sección de Calificaciones",
    description: "Planilla de notas y reporte de rendimiento para el estudiante.",
    icon: <Award size={18} className="text-blue-500" style={{ color: "#3b82f6" }} />,
  },
  {
    key: "avisos",
    label: "Sección de Avisos y Novedades",
    description: "Notificaciones y anuncios de la asignatura.",
    icon: <Bell size={18} className="text-rose-500" style={{ color: "#f43f5e" }} />,
  },
];

export default function VisibilidadModal({
  courseId,
  courseName,
  initialHiddenSections = [],
  initialPeriod1Active = true,
  initialPeriod2Active = true,
  initialPeriod3Active = true,
  initialPeriod4Active = true,
  onClose,
  onSuccess,
}: Props) {
  const [hiddenSections, setHiddenSections] = useState<string[]>(initialHiddenSections);
  const [period1, setPeriod1] = useState<boolean>(initialPeriod1Active);
  const [period2, setPeriod2] = useState<boolean>(initialPeriod2Active);
  const [period3, setPeriod3] = useState<boolean>(initialPeriod3Active);
  const [period4, setPeriod4] = useState<boolean>(initialPeriod4Active);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleSection = (key: string) => {
    setHiddenSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSavedSuccess(false);

    try {
      const res = await fetch(`/api/docente/cursos/${courseId}/visibilidad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hiddenSections,
          period1Active: period1,
          period2Active: period2,
          period3Active: period3,
          period4Active: period4,
        }),
      });

      if (!res.ok) {
        throw new Error("Error al guardar los ajustes de visibilidad");
      }

      setSavedSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-xl bg-card rounded-xl border shadow-xl flex flex-col overflow-hidden animate-scale-up"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="text-primary" size={20} style={{ color: "var(--primary-color)" }} />
              Visibilidad de Secciones para Estudiantes
            </h2>
            <p className="text-xs text-muted mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Asignatura: <strong style={{ color: "var(--text-primary)" }}>{courseName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="alert alert-danger text-xs flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          {savedSuccess && (
            <div className="alert alert-success text-xs flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={16} /> Preferencias de visibilidad guardadas con éxito.
            </div>
          )}

          <p className="text-xs text-muted leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Activa o desactiva los interruptores para <strong>mostrar u ocultar</strong> secciones completas de la plataforma a los estudiantes inscritos en este curso.
          </p>

          {/* List of Sections */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1" style={{ color: "var(--text-muted)" }}>
              Secciones del Menú del Curso
            </h3>

            {SECTIONS.map((sec) => {
              const isHidden = hiddenSections.includes(sec.key);
              return (
                <div
                  key={sec.key}
                  onClick={() => toggleSection(sec.key)}
                  className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:border-primary"
                  style={{
                    background: isHidden ? "rgba(239, 68, 68, 0.04)" : "var(--bg-primary)",
                    borderColor: isHidden ? "rgba(239, 68, 68, 0.3)" : "var(--border-color)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: "var(--bg-card)" }}>
                      {sec.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2">
                        {sec.label}
                        {isHidden && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-600">
                            Oculto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 transition-all ${
                      isHidden ? "btn-danger" : "btn-success"
                    }`}
                    style={{
                      background: isHidden ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: isHidden ? "var(--danger)" : "var(--success)",
                      border: "none",
                    }}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff size={14} /> Oculto
                      </>
                    ) : (
                      <>
                        <Eye size={14} /> Visible
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Periods section */}
          <div className="flex flex-col gap-2.5 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1" style={{ color: "var(--text-muted)" }}>
              Visibilidad de Periodos Académicos
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Periodo 1", state: period1, setState: setPeriod1 },
                { label: "Periodo 2", state: period2, setState: setPeriod2 },
                { label: "Periodo 3", state: period3, setState: setPeriod3 },
                { label: "Periodo 4", state: period4, setState: setPeriod4 },
              ].map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => p.setState(!p.state)}
                  className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    background: p.state ? "var(--bg-primary)" : "rgba(239, 68, 68, 0.04)",
                    borderColor: p.state ? "var(--border-color)" : "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <span>{p.label}</span>
                  <span
                    className="font-bold flex items-center gap-1"
                    style={{ color: p.state ? "var(--success)" : "var(--danger)" }}
                  >
                    {p.state ? <Eye size={13} /> : <EyeOff size={13} />}
                    {p.state ? "Visible" : "Oculto"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t flex justify-end gap-3" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
          <button onClick={onClose} className="btn btn-secondary text-xs px-4 py-2" disabled={saving}>
            Cancelar
          </button>
          <button onClick={handleSave} className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
