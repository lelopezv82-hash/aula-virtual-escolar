import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { getGoogleAccessToken, getGoogleAccessTokenForAccount } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-educational-key-2026'
);

function isGoogleDriveUrl(url: string): boolean {
  return (
    url.includes('drive.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('sites.google.com/d/') ||
    url.includes('drive.usercontent.google.com')
  );
}

function extractDriveFileId(url: string): string | null {
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

function injectBridgeScript(html: string, taskId: string = ''): string {
  const safeTaskId = taskId ? taskId.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const bridgeScript = `
<script id="aula-virtual-bridge">
(function() {
  var currentTaskId = '${safeTaskId}';
  var taskKeyPrefix = currentTaskId ? 'task_' + currentTaskId + '_' : '';

  // 1. Aislar y encapsular localStorage por cada tarea individual:
  // Evita que tareas nuevas o recreadas hereden partidas de sesiones anteriores.
  if (taskKeyPrefix) {
    try {
      var _origGet = Storage.prototype.getItem;
      var _origSet = Storage.prototype.setItem;
      var _origRemove = Storage.prototype.removeItem;

      Storage.prototype.getItem = function(k) {
        if (typeof k === 'string' && k.indexOf('task_') !== 0) {
          var scopedVal = _origGet.call(this, taskKeyPrefix + k);
          if (scopedVal !== null) return scopedVal;
          // Si no existe progreso guardado para esta tarea específica, nunca heredar partidas globales
          return null;
        }
        return _origGet.call(this, k);
      };

      Storage.prototype.setItem = function(k, v) {
        if (typeof k === 'string' && k.indexOf('task_') !== 0) {
          return _origSet.call(this, taskKeyPrefix + k, v);
        }
        return _origSet.call(this, k, v);
      };

      Storage.prototype.removeItem = function(k) {
        if (typeof k === 'string' && k.indexOf('task_') !== 0) {
          return _origRemove.call(this, taskKeyPrefix + k);
        }
        return _origRemove.call(this, k);
      };
    } catch(e) {}
  }

  // 2. Ocultar botones de "Jugar de nuevo" en la pantalla de victoria
  function purgeRestartElements() {
    // Ocultar botones dentro de la pantalla de victoria o fin de juego
    var victoryButtons = document.querySelectorAll('#screen-victory button, .screen-victory button, [id*="victory"] button, [id*="victoria"] button');
    for (var v = 0; v < victoryButtons.length; v++) {
      victoryButtons[v].style.setProperty('display', 'none', 'important');
      victoryButtons[v].remove();
    }

    var candidates = document.querySelectorAll('button, a, input[type="button"], div[role="button"]');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var text = (el.textContent || el.innerText || '').toLowerCase().trim();
      // NUNCA eliminar botones de inicio, continuación o guardado en plataforma
      if (text.indexOf('iniciar') !== -1 || text.indexOf('comenzar') !== -1 || text.indexOf('continuar') !== -1 || text.indexOf('guardar') !== -1) {
        continue;
      }
      if (
        text.indexOf('jugar de nuevo') !== -1 ||
        text.indexOf('volver a jugar') !== -1 ||
        text.indexOf('reiniciar juego') !== -1 ||
        text.indexOf('reiniciar actividad') !== -1 ||
        text.indexOf('intentar de nuevo') !== -1 ||
        text.indexOf('volver a intentar') !== -1 ||
        text.indexOf('reintentar') !== -1
      ) {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    }
  }

  try {
    setInterval(purgeRestartElements, 250);
  } catch(e) {}
  document.addEventListener('DOMContentLoaded', purgeRestartElements);
  window.addEventListener('load', purgeRestartElements);

  function normalizeGrade(val) {
    if (typeof val === 'string') {
      var match = val.match(/([0-9]+(?:[\.,][0-9]+)?)/);
      if (match) val = parseFloat(match[1].replace(',', '.'));
      else val = parseFloat(val.replace(',', '.'));
    }
    if (typeof val !== 'number' || isNaN(val)) return null;
    if (val > 5.0 && val <= 10.0) val = 1.0 + (val / 10.0) * 4.0;
    else if (val > 10.0 && val <= 100.0) val = 1.0 + (val / 100.0) * 4.0;
    return Math.max(1.0, Math.min(5.0, parseFloat(val.toFixed(1))));
  }

  function sendGradeToPlatform(grade, isFinal, extra) {
    if (!isFinal) return; // Registrar exclusivamente la nota definitiva al final de la actividad
    var norm = normalizeGrade(grade);
    if (norm === null) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ACTIVIDAD_COMPLETADA',
        grade: norm,
        isFinal: true,
        activityTitle: document.title || 'Actividad Interactiva',
        feedback: extra && extra.feedback ? extra.feedback : undefined
      }, '*');
    }
  }

  // API pública disponible para que la actividad reporte su propia nota (actual o final)
  window.aulaVirtual = {
    reportGrade: function(g, isFinal, extra) {
      sendGradeToPlatform(g, isFinal, extra);
    },
    updateGrade: function(g, extra) {
      sendGradeToPlatform(g, false, extra);
    }
  };
  window.AntigravityPlatform = {
    submitGrade: function(g, maxG, extra) {
      var norm = normalizeGrade(g);
      if (typeof g === 'number' && typeof maxG === 'number' && maxG > 0 && maxG !== 5.0) {
        norm = 1.0 + (g / maxG) * 4.0;
        norm = Math.max(1.0, Math.min(5.0, parseFloat(norm.toFixed(1))));
      }
      sendGradeToPlatform(norm, true, extra);
    },
    updateCurrentGrade: function(g, maxG, extra) {
      var norm = normalizeGrade(g);
      if (typeof g === 'number' && typeof maxG === 'number' && maxG > 0 && maxG !== 5.0) {
        norm = 1.0 + (g / maxG) * 4.0;
        norm = Math.max(1.0, Math.min(5.0, parseFloat(norm.toFixed(1))));
      }
      sendGradeToPlatform(norm, false, extra);
    }
  };
  window.reportGrade = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };
  window.actualizarNota = function(g, extra) {
    sendGradeToPlatform(g, false, extra);
  };
  window.guardarNota = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };
  window.setGrade = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };

  // Interceptar showResults si existe en el entorno global
  try {
    if (typeof window.showResults === 'function') {
      var origShowResults = window.showResults;
      window.showResults = function() {
        var res = origShowResults.apply(this, arguments);
        setTimeout(checkExplicitActivityGrade, 100);
        return res;
      };
    }
  } catch(e) {}

  // Escuchar si la actividad o el visor envían un postMessage propio
  window.addEventListener('message', function(ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    var d = ev.data;
    if (d.type === 'AULA_REQUEST_PROGRESS') {
      checkExplicitActivityGrade();
      return;
    }
    if (d.type === 'ANTIGRAVITY_GRADE_SUBMISSION' && d.grade !== undefined) {
      sendGradeToPlatform(d.grade, true, d);
      return;
    }
    if ((d.type === 'ANTIGRAVITY_CURRENT_GRADE' || d.type === 'NOTA_ACTUAL') && (d.grade !== undefined || d.currentGrade !== undefined || d.nota !== undefined)) {
      var gVal = d.currentGrade !== undefined ? d.currentGrade : (d.grade !== undefined ? d.grade : d.nota);
      sendGradeToPlatform(gVal, false, d);
      return;
    }
    var raw = d.currentGrade !== undefined ? d.currentGrade : (d.grade !== undefined ? d.grade : (d.notaActual !== undefined ? d.notaActual : (d.nota !== undefined ? d.nota : (d.calificacion !== undefined ? d.calificacion : (d.score !== undefined ? d.score : null)))));
    if (raw !== null) {
      sendGradeToPlatform(raw, d.isFinal || d.type === 'ACTIVIDAD_COMPLETADA' || d.type === 'ACTIVIDAD_FINALIZADA', d);
    }
  });

  function isElementVisible(el) {
    if (!el) return false;
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (cur.classList && (cur.classList.contains('hidden') || cur.hasAttribute('hidden'))) return false;
      if (cur.style && (cur.style.display === 'none' || cur.style.visibility === 'hidden' || cur.style.opacity === '0')) return false;
      try {
        var s = window.getComputedStyle(cur);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      } catch(e) {}
      cur = cur.parentElement;
    }
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) {
      return false;
    }
    return true;
  }

  // Detección cuando la actividad escribe su propia nota en el DOM o en variables globales
  function checkExplicitActivityGrade() {
    // 1. Variables globales asignadas por la actividad al finalizar
    var gFinal = [window.finalGrade, window.notaFinal, window.calificacion, window.nota];
    for (var v = 0; v < gFinal.length; v++) {
      var nVar = normalizeGrade(gFinal[v]);
      if (nVar !== null) {
        sendGradeToPlatform(nVar, true);
        return;
      }
    }

    // 2. Pantalla de victoria o resultados final visible (#result-screen, #screen-victory, etc.)
    var resultEl = document.querySelector('#result-screen, .result-screen, [id*="result-screen"], #screen-victory, .screen-victory, [id*="victory"], [class*="victory"], [id*="victoria"]');
    if (resultEl && isElementVisible(resultEl)) {
      var fgEl = document.querySelector('#final-grade, .final-grade, [id*="final-grade"], [class*="final-grade"], #nota-final, [id*="nota-final"], #calificacion, #nota');
      var fGrade = null;
      if (fgEl) {
        var fgText = (fgEl.textContent || fgEl.innerText || '').trim();
        fGrade = normalizeGrade(fgText);
      }
      if (fGrade === null) {
        var rawScoreEl = document.querySelector('#raw-score-text, [id*="raw-score"]');
        var finalScorePctEl = document.querySelector('#final-score, [id*="final-score"]');
        var totalQuestions = 30;
        if (window.quizData && window.quizData.length) totalQuestions = window.quizData.length;
        if (rawScoreEl) {
          var rawVal = parseInt(rawScoreEl.textContent || rawScoreEl.innerText || '0', 10);
          if (!isNaN(rawVal)) {
            fGrade = 1.0 + (rawVal / totalQuestions) * 4.0;
            fGrade = normalizeGrade(fGrade);
          }
        } else if (finalScorePctEl) {
          var pctVal = parseFloat((finalScorePctEl.textContent || finalScorePctEl.innerText || '').replace('%', '').trim());
          if (!isNaN(pctVal)) {
            fGrade = 1.0 + (pctVal / 100.0) * 4.0;
            fGrade = normalizeGrade(fGrade);
          }
        }
      }

      if (fGrade !== null) {
        sendGradeToPlatform(fGrade, true);
        return;
      }
    }

    // 3. Elementos de nota final visibles
    var selectors = ['#final-grade', '#nota-final', '#calificacion', '#nota', '[id*="final-grade"]', '[id*="nota-final"]', '.nota-final', '.calificacion-final'];
    for (var s = 0; s < selectors.length; s++) {
      var el = document.querySelector(selectors[s]);
      if (el && isElementVisible(el)) {
        var txt = (el.textContent || el.innerText || '').trim();
        var nEl = normalizeGrade(txt);
        if (nEl !== null) {
          sendGradeToPlatform(nEl, true);
          return;
        }
      }
    }
  }

  // Observador en el DOM para cuando la actividad cambie o escriba la nota
  try {
    var observer = new MutationObserver(function() {
      checkExplicitActivityGrade();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch(e) {}

  setTimeout(checkExplicitActivityGrade, 1500);
  setInterval(checkExplicitActivityGrade, 2500);
})();
</script>
<style id="aula-virtual-clean-ui">
  #screen-victory button:not(#btn-guardar-plataforma-injected),
  .screen-victory button:not(#btn-guardar-plataforma-injected),
  [id*="victory"] button:not(#btn-guardar-plataforma-injected),
  [id*="victoria"] button:not(#btn-guardar-plataforma-injected),
  #result-screen button[onclick*="restart"],
  button[onclick*="restartQuiz"],
  .btn-restart, .btn-replay, .btn-reiniciar, #btn-restart, #btn-replay, #btn-reiniciar {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
</style>
`;

  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + bridgeScript);
  }
  if (html.includes('<html>')) {
    return html.replace('<html>', '<html><head>' + bridgeScript + '</head>');
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', bridgeScript + '</body>');
  }
  return bridgeScript + html;
}

/**
 * GET /api/tareas/[id]/attachment
 *
 * Proxy endpoint: fetches the task's attachmentUrl from Google Drive using
 * the teacher's stored OAuth token and streams it to the student.
 * For non-Drive URLs it redirects directly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Auth: any logged-in user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    await jwtVerify(token, JWT_SECRET);

    // Load task + teacher info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        attachmentUrl: true,
        interactiveUrl: true,
        type: true,
        gdriveEmail: true,
        title: true,
        course: { select: { teacherId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target');

    const url = (target === 'interactive' || (task.type === 'INTERACTIVE' && target !== 'guide'))
      ? (task.interactiveUrl || task.attachmentUrl)
      : task.attachmentUrl;

    if (!url) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // --- Non-Drive URL ---
    if (!isGoogleDriveUrl(url)) {
      if (url.startsWith('/')) {
        return NextResponse.redirect(new URL(url, request.url));
      }
      if (url.toLowerCase().includes('.html') || url.toLowerCase().includes('.htm')) {
        try {
          const fetchRes = await fetch(url);
          if (fetchRes.ok) {
            let htmlText = await fetchRes.text();
            if (!htmlText.includes('aula-virtual-bridge')) {
              htmlText = injectBridgeScript(htmlText, taskId);
            }
            return new Response(htmlText, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': 'inline',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            });
          }
        } catch {}
      }
      return NextResponse.redirect(url);
    }

    // --- Google Drive URL: proxy through our server ---
    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return NextResponse.redirect(url);
    }

    const teacherId = task.course.teacherId;
    let accessToken: string | null = null;
    if (teacherId) {
      accessToken = await getGoogleAccessToken(teacherId);
    }
    if (!accessToken && task.gdriveEmail) {
      const gAcc = await prisma.googleDriveAccount.findFirst({
        where: { email: task.gdriveEmail },
      });
      if (gAcc) {
        accessToken = await getGoogleAccessTokenForAccount(gAcc.id);
      }
    }
    if (!accessToken) {
      const anyAcc = await prisma.googleDriveAccount.findFirst();
      if (anyAcc) {
        accessToken = await getGoogleAccessTokenForAccount(anyAcc.id);
      }
    }

    if (!accessToken) {
      // No token — redirect as fallback
      return NextResponse.redirect(url);
    }

    // Fetch metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaRes.ok) {
      console.warn(`Drive metadata failed for task ${taskId} attachment:`, await metaRes.text());
      return NextResponse.redirect(url);
    }

    const meta = await metaRes.json();
    const mimeType: string = meta.mimeType || 'application/octet-stream';
    const originalName: string = meta.name || task.title || 'archivo';
    const isNativeSheet = mimeType === 'application/vnd.google-apps.spreadsheet';
    const isNativeDoc = mimeType === 'application/vnd.google-apps.document';
    const isNativePres = mimeType === 'application/vnd.google-apps.presentation';
    const isHtml =
      mimeType === 'text/html' ||
      originalName.toLowerCase().endsWith('.html') ||
      originalName.toLowerCase().endsWith('.htm') ||
      (meta.name && meta.name.toLowerCase().endsWith('.html'));

    let downloadUrl: string;
    let serveMimeType: string = isHtml ? 'text/html; charset=utf-8' : mimeType;

    if (isNativeSheet) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (isNativeDoc) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (isNativePres) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.presentationml.presentation`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileRes.ok) {
      console.warn(`Drive download failed for task ${taskId} attachment:`, await fileRes.text());
      return NextResponse.redirect(url);
    }

    const isInline =
      serveMimeType.startsWith('image/') || serveMimeType === 'application/pdf' || isHtml;
    const disposition = isInline
      ? `inline; filename="${originalName}"`
      : `attachment; filename="${originalName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;

    if (isHtml) {
      let htmlText = await fileRes.text();
      if (!htmlText.includes('aula-virtual-bridge')) {
        htmlText = injectBridgeScript(htmlText, taskId);
      }
      return new Response(htmlText, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': disposition,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const body = await fileRes.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': serveMimeType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error en proxy de adjunto de tarea:', error);
    return NextResponse.json({ error: 'Error interno al abrir el archivo' }, { status: 500 });
  }
}
