"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, CheckCircle2, Trophy, Sparkles, RefreshCw, AlertCircle, FileText, Lock } from "lucide-react";

interface VisorActividadInteractivaProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    attachmentUrl?: string | null;
    interactiveUrl?: string | null;
    courseId: string;
    dueDate?: string;
  };
  initialSubmission?: {
    id?: string;
    grade?: number | null;
    status?: string;
    feedback?: string | null;
    answers?: any;
    submittedAt?: string | null;
  } | null;
  onSubmissionUpdated?: (sub: any) => void;
  isClosed?: boolean;
}

export default function VisorActividadInteractiva({
  task,
  initialSubmission,
  onSubmissionUpdated,
  isClosed = false
}: VisorActividadInteractivaProps) {
  const [submission, setSubmission] = useState(initialSubmission);
  const [currentGrade, setCurrentGrade] = useState<number | null>(initialSubmission?.grade ?? null);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Determinar URL de la actividad
  let activityUrl = "/activities/excel_escape.html";
  const rawInteractive = task.interactiveUrl || (task.attachmentUrl && (task.attachmentUrl.includes(".html") || task.attachmentUrl.includes("/activities/")) ? task.attachmentUrl : null);

  if (rawInteractive && rawInteractive.trim() !== "") {
    if (rawInteractive.startsWith("/")) {
      activityUrl = rawInteractive;
    } else {
      // Usar proxy interno de la plataforma para servir el archivo directamente como HTML ejecutable,
      // evitando bloqueos de permisos de Google Drive o visores externos.
      activityUrl = `/api/tareas/${task.id}/attachment?target=interactive`;
    }
  }

  // Guía de apoyo opcional (si attachmentUrl existe y no es el mismo archivo HTML interactivo)
  const hasGuide = Boolean(
    task.attachmentUrl &&
    task.attachmentUrl !== rawInteractive &&
    !task.attachmentUrl.endsWith(".html") &&
    !task.attachmentUrl.endsWith(".htm") &&
    !task.attachmentUrl.includes("/activities/")
  );
  const guideUrl = hasGuide ? `/api/tareas/${task.id}/attachment?target=guide` : null;

  // Manejar pantalla completa
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Sincronizar calificación si initialSubmission carga de forma asíncrona
  useEffect(() => {
    if (initialSubmission) {
      setSubmission(initialSubmission);
      if (initialSubmission.grade !== undefined && initialSubmission.grade !== null) {
        setCurrentGrade(initialSubmission.grade);
      }
    }
  }, [initialSubmission]);

  const submitGrade = async (grade: number, isFinal: boolean, extraData?: any, isManualClick = false) => {
    setSavingStatus("saving");
    setStatusMessage(isFinal ? "Guardando entrega final..." : "Guardando avance...");

    try {
      const res = await fetch(`/api/estudiante/tareas/${task.id}/interactive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          currentLevel: extraData?.currentLevel,
          totalLevels: extraData?.totalLevels,
          mistakes: extraData?.mistakes,
          isFinal,
          activityTitle: extraData?.activityTitle || task.title
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setCurrentGrade(result.grade);
        setSavingStatus("saved");
        setStatusMessage(result.message || "Guardado");

        const updated = {
          id: result.submissionId,
          grade: result.grade,
          status: "GRADED",
          submittedAt: new Date().toISOString()
        };
        setSubmission(updated);
        if (onSubmissionUpdated) onSubmissionUpdated(updated);

        if (isManualClick || isFinal) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 4000);
        }
        setTimeout(() => setSavingStatus("idle"), 2500);
      } else {
        setSavingStatus("error");
        setStatusMessage(result.error || "No se pudo guardar la nota");
      }
    } catch {
      setSavingStatus("error");
      setStatusMessage("Error de conexión al guardar nota");
    }
  };

  // Función de sincronización para detectar si la actividad asignó o reportó su propia nota
  const handleManualSync = (isManualClick = false) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'AULA_REQUEST_PROGRESS', isFinal: false }, '*');
    }

    // Inspección directa de variables globales o elementos del DOM donde la actividad asigna su propia nota
    try {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow as any;
      if (doc || win) {
        const normalizeGrade = (val: any): number | null => {
          if (typeof val === 'string') {
            const match = val.match(/([0-9]+(?:[.,][0-9]+)?)/);
            if (match) val = parseFloat(match[1].replace(',', '.'));
            else val = parseFloat(val.replace(',', '.'));
          }
          if (typeof val !== 'number' || isNaN(val)) return null;
          if (val > 5.0 && val <= 10.0) val = 1.0 + (val / 10.0) * 4.0;
          else if (val > 10.0 && val <= 100.0) val = 1.0 + (val / 100.0) * 4.0;
          return Math.max(1.0, Math.min(5.0, parseFloat(val.toFixed(1))));
        };

        // 1. Variables globales asignadas por la actividad misma
        const gVars = [win?.finalGrade, win?.notaFinal, win?.calificacion, win?.currentGrade, win?.nota];
        for (const v of gVars) {
          const nVar = normalizeGrade(v);
          if (nVar !== null) {
            submitGrade(nVar, true, { activityTitle: doc?.title || task.title }, isManualClick);
            return;
          }
        }

        // 2. Elementos DOM donde la actividad escribe su nota asignada
        if (doc) {
          const selectors = ['#final-grade', '#nota-final', '#calificacion', '#nota', '[id*="final-grade"]', '[id*="nota-final"]', '.nota-final', '.calificacion-final'];
          for (const sel of selectors) {
            const el = doc.querySelector(sel);
            if (el) {
              const txt = (el.textContent || '').trim();
              const nEl = normalizeGrade(txt);
              if (nEl !== null) {
                submitGrade(nEl, true, { activityTitle: doc.title || task.title }, isManualClick);
                return;
              }
            }
          }
        }
      }
    } catch {}
  };

  // Escuchar mensajes del juego o actividad interactiva
  useEffect(() => {
    if (isClosed) return;
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Detectar nota reportada directamente por la actividad
      const rawGrade = data.grade !== undefined 
        ? data.grade 
        : (data.nota !== undefined 
            ? data.nota 
            : (data.calificacion !== undefined 
                ? data.calificacion 
                : (data.score !== undefined ? data.score : null)));

      if (rawGrade !== null && rawGrade !== undefined) {
        let val: number | null = null;
        if (typeof rawGrade === 'string') {
          const match = rawGrade.match(/([0-9]+(?:[.,][0-9]+)?)/);
          if (match) val = parseFloat(match[1].replace(',', '.'));
        } else if (typeof rawGrade === 'number') {
          val = rawGrade;
        }

        if (val !== null && !isNaN(val)) {
          if (val > 5.0 && val <= 10.0) {
            val = 1.0 + (val / 10.0) * 4.0;
          } else if (val > 10.0 && val <= 100.0) {
            val = 1.0 + (val / 100.0) * 4.0;
          }
          const finalVal = Math.max(1.0, Math.min(5.0, parseFloat(val.toFixed(1))));
          const isFinal = !!data.isFinal || data.type === "ACTIVIDAD_COMPLETADA" || data.type === "ACTIVIDAD_FINALIZADA";
          await submitGrade(finalVal, isFinal, data);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [task.id, task.title, onSubmissionUpdated, isClosed]);

  // Sincronización periódica automática en segundo plano
  useEffect(() => {
    if (isClosed) return;
    const timer = setInterval(() => {
      handleManualSync(false);
    }, 10000);
    return () => clearInterval(timer);
  }, [task.id, isClosed]);

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 relative">
      
      {/* Barra de cabecera superior */}
      <header className="bg-slate-800/95 border-b border-slate-700/80 px-4 py-3 flex items-center justify-between gap-3 text-white flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/estudiante/cursos/${task.courseId}`}
            className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Volver a Asignatura</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎮</span>
            <div>
              <h1 className="text-sm md:text-base font-bold text-white leading-tight line-clamp-1">
                {task.title}
              </h1>
              {isClosed ? (
                <span className="text-[11px] text-amber-400 font-medium">Actividad Cerrada (Plazo Vencido)</span>
              ) : (
                <span className="text-[11px] text-emerald-400 font-medium">Actividad Interactiva con Calificación Automática</span>
              )}
            </div>
          </div>
        </div>

        {/* Badge de Nota y botones de acción */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Badge de Nota Oficial */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-xl shadow-md border border-emerald-400/40">
            <Trophy size={16} className="text-yellow-300" />
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-medium text-emerald-100 hidden md:inline">Nota Oficial:</span>
              <span className="text-base md:text-lg font-black tracking-tight">
                {currentGrade !== null ? currentGrade.toFixed(1) : "—"}
              </span>
              <span className="text-[10px] text-emerald-200">/ 5.0</span>
            </div>
          </div>

          {/* Botón Descargar Guía si existe */}
          {guideUrl && (
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 text-xs font-bold text-orange-200 hover:text-white bg-orange-600/80 hover:bg-orange-600 px-3 py-1.5 rounded-xl transition-all shadow-sm border border-orange-400/30"
              title="Descargar Guía de Apoyo de la Actividad"
            >
              <FileText size={15} />
              <span className="hidden sm:inline">Descargar Guía</span>
            </a>
          )}

          {/* Botón Pantalla Completa */}
          {!isClosed && (
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </header>

      {/* Contenedor Iframe o Bloqueo por Plazo Vencido */}
      {isClosed ? (
        <div className="flex-grow w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950">
          <div className="max-w-md p-8 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Lock size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Actividad Cerrada (Plazo Vencido)</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                El plazo para realizar esta actividad interactiva ha vencido. La calificación registrada en tu planilla escolar es definitiva y ya no se admiten intentos ni modificaciones.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/80 px-5 py-2.5 rounded-xl border border-slate-700/80 w-full justify-center">
              <Trophy size={20} className="text-yellow-400" />
              <span className="text-xs text-slate-300 font-medium">Calificación oficial:</span>
              <strong className="text-lg text-emerald-400">{currentGrade !== null ? currentGrade.toFixed(1) : "1.0"}</strong>
              <span className="text-xs text-slate-400">/ 5.0</span>
            </div>
            <Link
              href={`/estudiante/cursos/${task.courseId}`}
              className="mt-3 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Volver a la Asignatura</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-grow w-full h-full relative bg-slate-950">
          <iframe
            ref={iframeRef}
            src={activityUrl}
            title={task.title}
            className="w-full h-full border-0 absolute inset-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            allow="fullscreen"
            onLoad={() => {
              setTimeout(() => {
                handleManualSync(false);
              }, 1000);
            }}
          />
        </div>
      )}
    </div>
  );
}
