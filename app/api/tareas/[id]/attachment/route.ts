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

  // 2. Función para reiniciar la partida completamente desde cero
  window.resetInteractiveActivity = function() {
    try {
      var commonKeys = ['mision_flowgorithm_progress', 'progress', 'game_progress', 'partida_guardada', 'saved_game'];
      commonKeys.forEach(function(k) {
        try { localStorage.removeItem(k); } catch(e) {}
        if (taskKeyPrefix) {
          try { localStorage.removeItem(taskKeyPrefix + k); } catch(e) {}
        }
      });
      if (taskKeyPrefix) {
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var kName = localStorage.key(i);
            if (kName && kName.indexOf(taskKeyPrefix) === 0) {
              localStorage.removeItem(kName);
            }
          }
        } catch(e) {}
      }
      if (typeof window.clearSavedProgress === 'function') {
        try { window.clearSavedProgress(); } catch(e) {}
      }
    } catch(err) {}
    window.location.reload();
  };

  // Escuchar mensaje de reinicio desde el visor de la plataforma
  window.addEventListener('message', function(ev) {
    if (ev.data && (ev.data.type === 'REINICIAR_ACTIVIDAD' || ev.data.type === 'RESET_ACTIVITY')) {
      window.resetInteractiveActivity();
    }
  });

  // 3. Inyectar botón de "Empezar de nuevo (Nivel 1)" en el banner de partida guardada si existe
  window.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      var resumeBanner = document.getElementById('resume-banner') || document.querySelector('[id*="resume"]');
      if (resumeBanner && !document.getElementById('btn-reiniciar-desde-cero')) {
        var restartBtn = document.createElement('button');
        restartBtn.id = 'btn-reiniciar-desde-cero';
        restartBtn.type = 'button';
        restartBtn.innerHTML = '🔄 Empezar de nuevo (Nivel 1)';
        restartBtn.style.cssText = 'width: 100%; margin-top: 8px; background: #ef4444; color: #fff; font-weight: bold; padding: 9px 14px; border-radius: 8px; font-size: 13px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: background 0.2s;';
        restartBtn.onmouseover = function() { restartBtn.style.background = '#dc2626'; };
        restartBtn.onmouseout = function() { restartBtn.style.background = '#ef4444'; };
        restartBtn.onclick = function(e) {
          e.preventDefault();
          if (confirm('¿Estás seguro de que deseas empezar de nuevo desde el Nivel 1? Se borrará el progreso anterior.')) {
            window.resetInteractiveActivity();
          }
        };
        resumeBanner.appendChild(restartBtn);
      }
    }, 200);
  });

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
    var norm = normalizeGrade(grade);
    if (norm === null) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: isFinal ? 'ACTIVIDAD_COMPLETADA' : 'ACTIVIDAD_PROGRESO',
        grade: norm,
        isFinal: !!isFinal,
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

  // Escuchar si la actividad envía un postMessage propio con su nota (incluyendo Gemini Canvas / Antigravity)
  window.addEventListener('message', function(ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    var d = ev.data;
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

  // Detección únicamente si la actividad escribe su propia nota en el DOM o en variables globales
  function checkExplicitActivityGrade() {
    // 1. Variables globales asignadas por la actividad
    var gCurrent = [window.currentGrade, window.notaActual];
    for (var u = 0; u < gCurrent.length; u++) {
      var nCur = normalizeGrade(gCurrent[u]);
      if (nCur !== null) {
        sendGradeToPlatform(nCur, false);
      }
    }
    var gFinal = [window.finalGrade, window.notaFinal, window.calificacion, window.nota];
    for (var v = 0; v < gFinal.length; v++) {
      var nVar = normalizeGrade(gFinal[v]);
      if (nVar !== null) {
        sendGradeToPlatform(nVar, true);
        return;
      }
    }

    // 2. Elementos DOM de Nota Actual visible en pantalla
    var curSelectors = ['#current-grade', '#nota-actual', '#currentGrade', '#calificacion-actual', '#nota-en-vivo', '[id*="current-grade"]', '[id*="nota-actual"]', '.current-grade', '.nota-actual', '.nota-en-vivo'];
    for (var c = 0; c < curSelectors.length; c++) {
      var cEl = document.querySelector(curSelectors[c]);
      if (cEl && isElementVisible(cEl)) {
        var cTxt = (cEl.textContent || cEl.innerText || '').trim();
        var nCEl = normalizeGrade(cTxt);
        if (nCEl !== null) {
          sendGradeToPlatform(nCEl, false);
          break;
        }
      }
    }

    // 3. Elementos DOM donde la actividad escribe su nota final (únicamente si son visibles)
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
