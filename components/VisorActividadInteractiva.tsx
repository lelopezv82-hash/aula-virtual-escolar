"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, CheckCircle2, Trophy, Sparkles, RefreshCw, AlertCircle, FileText } from "lucide-react";

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
}

export default function VisorActividadInteractiva({
  task,
  initialSubmission,
  onSubmissionUpdated
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

  const submitGrade = async (grade: number, isFinal: boolean, extraData?: any) => {
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

        if (isFinal) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 5000);
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

  // Función de sincronización manual / directa desde el iframe
  const handleManualSync = (isFinal = false) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'AULA_REQUEST_PROGRESS', isFinal }, '*');
    }

    // Inspección directa del DOM del iframe como respaldo inmediato (mismo origen)
    try {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow as any;
      if (doc) {
        const gradeEl = doc.getElementById('final-grade') || doc.getElementById('live-grade');
        let parsedGrade: number | null = null;
        if (gradeEl) {
          const val = parseFloat((gradeEl.textContent || "").trim());
          if (!isNaN(val) && val >= 1.0 && val <= 5.0) parsedGrade = val;
        }

        const curLvl = win?.currentLevelIndex ?? null;
        const lvlArr = win?.levels ?? null;
        const errs = win?.mistakes ?? 0;

        if (parsedGrade === null && curLvl !== null && Array.isArray(lvlArr) && lvlArr.length > 0) {
          const progressRatio = curLvl / lvlArr.length;
          let g = 1.0 + (progressRatio * 4.0) - (errs * 0.1);
          if (g < 1.0) g = 1.0;
          if (g > 5.0) g = 5.0;
          parsedGrade = parseFloat(g.toFixed(1));
        }

        if (parsedGrade === null) {
          const progEl = doc.getElementById('progress-text') || doc.querySelector('.progress-text');
          if (progEl) {
            const match = (progEl.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
              const cur = parseInt(match[1], 10);
              const tot = parseInt(match[2], 10);
              if (tot > 0) {
                const completed = Math.max(0, cur - 1);
                let g = 1.0 + ((completed / tot) * 4.0);
                if (g > 5.0) g = 5.0;
                parsedGrade = parseFloat(g.toFixed(1));
              }
            }
          }
        }

        if (parsedGrade !== null) {
          submitGrade(parsedGrade, isFinal, {
            currentLevel: curLvl,
            totalLevels: lvlArr?.length,
            mistakes: errs
          });
        }
      }
    } catch {}
  };

  // Escuchar mensajes del juego o actividad interactiva
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "ACTIVIDAD_PROGRESO" || data.type === "ACTIVIDAD_COMPLETADA") {
        const isFinal = data.type === "ACTIVIDAD_COMPLETADA" || !!data.isFinal;
        await submitGrade(data.grade, isFinal, data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [task.id, task.title, onSubmissionUpdated]);

  // Sincronización periódica automática en segundo plano
  useEffect(() => {
    const timer = setInterval(() => {
      handleManualSync(false);
    }, 10000);
    return () => clearInterval(timer);
  }, [task.id]);

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
              <span className="text-[11px] text-emerald-400 font-medium">Actividad Interactiva con Calificación Automática</span>
            </div>
          </div>
        </div>

        {/* Notificaciones de guardado y Badge de Nota */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Estado de guardado en vivo */}
          {savingStatus !== "idle" && (
            <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-all ${
              savingStatus === "saving" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
              savingStatus === "saved" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
              "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            }`}>
              {savingStatus === "saving" && <RefreshCw size={13} className="animate-spin" />}
              {savingStatus === "saved" && <CheckCircle2 size={13} />}
              {savingStatus === "error" && <AlertCircle size={13} />}
              <span>{statusMessage}</span>
            </div>
          )}

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

          {/* Botón Guardar Avance */}
          <button
            type="button"
            onClick={() => handleManualSync(true)}
            disabled={savingStatus === "saving"}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded-xl transition-all shadow-sm border border-blue-400/40"
            title="Guardar y registrar mi avance actual en la planilla escolar"
          >
            <CheckCircle2 size={15} className="text-blue-200" />
            <span className="hidden sm:inline">Guardar Avance</span>
          </button>

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
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Banner de Celebración cuando finaliza */}
      {showCelebration && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-bounce">
          <Sparkles className="text-yellow-300 animate-spin" size={24} />
          <div>
            <p className="font-bold text-sm md:text-base">¡Excelente trabajo!</p>
            <p className="text-xs text-emerald-100">Tu calificación de <strong>{currentGrade?.toFixed(1)}</strong> ha sido registrada en tu planilla escolar.</p>
          </div>
        </div>
      )}

      {/* Contenedor Iframe con Sandbox seguro */}
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
    </div>
  );
}
