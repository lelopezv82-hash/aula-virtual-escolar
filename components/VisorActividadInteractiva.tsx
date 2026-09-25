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

  // Función de sincronización manual / directa desde el iframe
  const handleManualSync = (isManualClick = false) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'AULA_REQUEST_PROGRESS', isFinal: false }, '*');
    }

    // Inspección directa del DOM del iframe como respaldo inmediato (mismo origen)
    try {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow as any;
      if (doc) {
        const isVisible = (el: Element | null): boolean => {
          if (!el) return false;
          const htmlEl = el as HTMLElement;
          if (htmlEl.classList?.contains('hidden')) return false;
          if (htmlEl.hasAttribute('hidden')) return false;
          if (htmlEl.style?.display === 'none' || htmlEl.style?.visibility === 'hidden') return false;
          try {
            const w = doc.defaultView || win || window;
            if (w?.getComputedStyle) {
              const s = w.getComputedStyle(htmlEl);
              if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
            }
          } catch {}
          if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) {
            if (htmlEl.getClientRects && htmlEl.getClientRects().length === 0) return false;
          }
          return true;
        };

        // 1. Detección de Victoria / Fin de Actividad
        const victorySelectors = [
          '#screen-victory', '#victory-screen', '.victory-screen',
          '#pantalla-final', '#pantalla-victoria', '.pantalla-victoria',
          '[id*="victory"]', '[id*="victoria"]', '[id*="game-over"]',
          '[id*="gameOver"]', '[id*="congratulation"]', '[id*="felicitacion"]',
          '[id*="pantalla-ganador"]', '[id*="pantalla-exito"]'
        ];

        let isVictory = false;
        for (const sel of victorySelectors) {
          const els = doc.querySelectorAll(sel);
          for (let j = 0; j < els.length; j++) {
            if (isVisible(els[j])) {
              isVictory = true;
              break;
            }
          }
          if (isVictory) break;
        }

        const trophyEl = doc.getElementById('level-display') || doc.getElementById('progress-text') || doc.querySelector('.level-display, .progress-text, [id*="level"]');
        if (trophyEl) {
          const tText = (trophyEl.textContent || '').trim();
          if (tText.includes('🏆') || tText.includes('🎉') || /victoria|completado|ganaste|felicidades/i.test(tText)) {
            isVictory = true;
          }
        }

        const mistakes = typeof win?.mistakes === 'number' ? win.mistakes : (typeof win?.errors === 'number' ? win.errors : 0);

        if (isVictory) {
          let parsedGrade: number | null = null;
          const gradeSelectors = ['#final-grade', '#nota-final', '[id*="final-grade"]', '[id*="nota-final"]'];
          for (const gSel of gradeSelectors) {
            const gEl = doc.querySelector(gSel);
            if (gEl) {
              const val = parseFloat((gEl.textContent || '').trim());
              if (!isNaN(val) && val >= 1.0 && val <= 5.0) {
                parsedGrade = val;
                break;
              }
            }
          }
          if (parsedGrade === null) {
            let vGrade = 5.0 - (mistakes * 0.1);
            if (vGrade < 1.0) vGrade = 1.0;
            if (vGrade > 5.0) vGrade = 5.0;
            parsedGrade = parseFloat(vGrade.toFixed(1));
          }
          submitGrade(parsedGrade, true, {
            currentLevel: 100,
            totalLevels: 100,
            mistakes,
            activityTitle: doc.title || task.title
          }, isManualClick);
          return;
        }

        // 2. Variables globales del juego (ej. Excel Escape: currentLevelIndex, levels)
        const curIdx = typeof win?.currentLevelIndex === 'number' ? win.currentLevelIndex : (typeof win?.currentLevel === 'number' ? win.currentLevel : null);
        const lvlList = Array.isArray(win?.levels) ? win.levels : null;
        if (curIdx !== null && lvlList && lvlList.length > 0) {
          const tot = lvlList.length;
          if (curIdx <= 0) {
            submitGrade(1.0, false, { currentLevel: 0, totalLevels: tot, mistakes, activityTitle: doc.title || task.title }, isManualClick);
            return;
          }
          const pRatio = curIdx / tot;
          let calcG = 1.0 + (pRatio * 4.0) - (mistakes * 0.1);
          if (calcG < 1.0) calcG = 1.0;
          if (calcG > 5.0) calcG = 5.0;
          submitGrade(parseFloat(calcG.toFixed(1)), curIdx >= tot, {
            currentLevel: curIdx,
            totalLevels: tot,
            mistakes,
            activityTitle: doc.title || task.title
          }, isManualClick);
          return;
        }

        // 3. Texto de nivel / progreso en el DOM (ej: "2/7", "Nivel 3 / 10", "4 de 20")
        const textCandidates = [
          doc.getElementById('level-display'),
          doc.getElementById('progress-text'),
          doc.querySelector('.level-display'),
          doc.querySelector('.progress-text'),
          doc.querySelector('[id*="level-display"]'),
          doc.querySelector('[id*="progress-text"]'),
          doc.querySelector('header [id*="level"]'),
          doc.querySelector('header [id*="nivel"]'),
          doc.querySelector('[id*="nivel"]'),
          doc.querySelector('[class*="nivel"]'),
          doc.querySelector('#score'),
          doc.querySelector('.score'),
          doc.querySelector('#puntos'),
          doc.querySelector('.puntos')
        ];

        for (const el of textCandidates) {
          if (!el) continue;
          const content = (el.textContent || '').trim();
          const match = content.match(/(\d+)\s*(?:\/|de|-)\s*(\d+)/i);
          if (match) {
            const cur = parseInt(match[1], 10);
            const tot = parseInt(match[2], 10);
            if (tot > 0) {
              const isPoints = /punto|acierto|correct|score|superad|completad/i.test(content) || /score|punto/i.test(el.id || '') || /score|punto/i.test(el.className || '');
              const completed = isPoints ? cur : Math.max(0, cur - 1);
              if (completed <= 0) {
                submitGrade(1.0, false, { currentLevel: cur, totalLevels: tot, mistakes, activityTitle: doc.title || task.title }, isManualClick);
                return;
              }
              let gCalc = 1.0 + ((completed / tot) * 4.0) - (mistakes * 0.1);
              if (gCalc < 1.0) gCalc = 1.0;
              if (gCalc > 5.0) gCalc = 5.0;
              submitGrade(parseFloat(gCalc.toFixed(1)), completed >= tot, {
                currentLevel: cur,
                totalLevels: tot,
                mistakes,
                activityTitle: doc.title || task.title
              }, isManualClick);
              return;
            }
          }
        }

        // 4. Barra de progreso CSS (ej: style="width: 50%")
        const barEls = doc.querySelectorAll('[role="progressbar"], .progress-bar, [class*="progress-bar"], [id*="progress-bar"], [class*="progress-fill"], [id*="progress-fill"]');
        for (let b = 0; b < barEls.length; b++) {
          const bar = barEls[b] as HTMLElement;
          const wStr = bar.style?.width || '';
          const wMatch = wStr.match(/(\d+(?:\.\d+)?)\s*%/);
          if (wMatch) {
            const pct = parseFloat(wMatch[1]);
            if (!isNaN(pct) && pct > 0) {
              let gBar = 1.0 + ((pct / 100) * 4.0) - (mistakes * 0.1);
              if (gBar < 1.0) gBar = 1.0;
              if (gBar > 5.0) gBar = 5.0;
              submitGrade(parseFloat(gBar.toFixed(1)), pct >= 100, {
                currentLevel: Math.round(pct),
                totalLevels: 100,
                mistakes,
                activityTitle: doc.title || task.title
              }, isManualClick);
              return;
            }
          }
        }

        // 5. Pantallas activas en el DOM (ej: Flowgorithm screen-intro, screen-level1, etc.)
        const screens = doc.querySelectorAll('main[id*="screen"], div[id*="screen"], section[id*="screen"], .screen, .pantalla');
        if (screens && screens.length > 2) {
          let activeIdx = -1;
          for (let s = 0; s < screens.length; s++) {
            if (isVisible(screens[s])) {
              activeIdx = s;
              break;
            }
          }
          if (activeIdx > 0) {
            const totalScreens = screens.length;
            const lastIsVic = /victory|victoria|final|game-over/i.test((screens[totalScreens - 1] as HTMLElement).id || '');
            const denominator = lastIsVic ? (totalScreens - 1) : totalScreens;
            if (activeIdx >= denominator) {
              submitGrade(5.0, true, { currentLevel: denominator, totalLevels: denominator, mistakes, activityTitle: doc.title || task.title }, isManualClick);
              return;
            }
            const sRatio = activeIdx / denominator;
            let gScreen = 1.0 + (sRatio * 4.0);
            if (gScreen > 5.0) gScreen = 5.0;
            submitGrade(parseFloat(gScreen.toFixed(1)), false, {
              currentLevel: activeIdx,
              totalLevels: denominator,
              mistakes,
              activityTitle: doc.title || task.title
            }, isManualClick);
            return;
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

      if (data.type === "ACTIVIDAD_PROGRESO" || data.type === "ACTIVIDAD_COMPLETADA") {
        const isFinal = data.type === "ACTIVIDAD_COMPLETADA" || !!data.isFinal;
        await submitGrade(data.grade, isFinal, data);
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
