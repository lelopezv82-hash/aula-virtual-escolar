import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { getGoogleAccessToken, getGoogleAccessTokenForAccount } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-educational-key-2026'
);

function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function extractDriveFileId(url: string): string | null {
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

function injectBridgeScript(html: string): string {
  const bridgeScript = `
<script id="aula-virtual-bridge">
(function() {
  function isElementVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.hasAttribute && el.hasAttribute('hidden')) return false;
    if (el.style) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
      if (el.style.opacity === '0') return false;
    }
    try {
      if (window.getComputedStyle) {
        var s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      }
    } catch(e) {}
    if (el.offsetWidth === 0 && el.offsetHeight === 0) {
      if (el.getClientRects && el.getClientRects().length === 0) return false;
    }
    return true;
  }

  function detectActivityProgress() {
    var doc = document;
    var win = window;

    // 1. Detección de Victoria / Fin de Actividad
    var victorySelectors = [
      '#screen-victory', '#victory-screen', '.victory-screen',
      '#pantalla-final', '#pantalla-victoria', '.pantalla-victoria',
      '[id*="victory"]', '[id*="victoria"]', '[id*="game-over"]',
      '[id*="gameOver"]', '[id*="congratulation"]', '[id*="felicitacion"]',
      '[id*="pantalla-ganador"]', '[id*="pantalla-exito"]'
    ];

    var isVictory = false;
    for (var i = 0; i < victorySelectors.length; i++) {
      var els = doc.querySelectorAll(victorySelectors[i]);
      for (var j = 0; j < els.length; j++) {
        if (isElementVisible(els[j])) {
          isVictory = true;
          break;
        }
      }
      if (isVictory) break;
    }

    // Indicadores emoji o texto de victoria en cabeceras o displays
    var trophyEl = doc.getElementById('level-display') || doc.getElementById('progress-text') || doc.querySelector('.level-display, .progress-text, [id*="level"]');
    if (trophyEl) {
      var tText = (trophyEl.textContent || trophyEl.innerText || '').trim();
      if (tText.indexOf('🏆') !== -1 || tText.indexOf('🎉') !== -1 || /victoria|completado|ganaste|felicidades/i.test(tText)) {
        isVictory = true;
      }
    }

    var mistakes = 0;
    try {
      if (typeof win.mistakes === 'number') mistakes = win.mistakes;
      else if (typeof win.errors === 'number') mistakes = win.errors;
      else if (typeof win.fallos === 'number') mistakes = win.fallos;
    } catch(e) {}

    if (isVictory) {
      var gradeSelectors = ['#final-grade', '#nota-final', '[id*="final-grade"]', '[id*="nota-final"]', '.final-grade', '.nota-final'];
      for (var g = 0; g < gradeSelectors.length; g++) {
        var gEl = doc.querySelector(gradeSelectors[g]);
        if (gEl) {
          var gText = (gEl.textContent || gEl.innerText || '').trim();
          var gVal = parseFloat(gText);
          if (!isNaN(gVal) && gVal >= 1.0 && gVal <= 5.0) {
            return { grade: gVal, isFinal: true, currentLevel: 100, totalLevels: 100, mistakes: mistakes };
          }
        }
      }
      var vGrade = 5.0 - (mistakes * 0.1);
      if (vGrade < 1.0) vGrade = 1.0;
      if (vGrade > 5.0) vGrade = 5.0;
      return {
        grade: parseFloat(vGrade.toFixed(1)),
        isFinal: true,
        currentLevel: 100,
        totalLevels: 100,
        mistakes: mistakes
      };
    }

    // 2. Variables globales del juego (ej. Excel Escape: currentLevelIndex, levels)
    try {
      var curIdx = typeof win.currentLevelIndex === 'number' ? win.currentLevelIndex : (typeof win.currentLevel === 'number' ? win.currentLevel : null);
      var lvlList = (win.levels && Array.isArray(win.levels)) ? win.levels : null;
      if (curIdx !== null && lvlList && lvlList.length > 0) {
        var tot = lvlList.length;
        if (curIdx <= 0) {
          return { grade: 1.0, isFinal: false, currentLevel: 0, totalLevels: tot, mistakes: mistakes };
        }
        var pRatio = curIdx / tot;
        var calcG = 1.0 + (pRatio * 4.0) - (mistakes * 0.1);
        if (calcG < 1.0) calcG = 1.0;
        if (calcG > 5.0) calcG = 5.0;
        return {
          grade: parseFloat(calcG.toFixed(1)),
          isFinal: curIdx >= tot,
          currentLevel: curIdx,
          totalLevels: tot,
          mistakes: mistakes
        };
      }
    } catch(e) {}

    // 3. Texto de nivel / progreso en el DOM (ej: "2/7", "Nivel 3 / 10", "4 de 20")
    var textCandidates = [
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

    for (var k = 0; k < textCandidates.length; k++) {
      var el = textCandidates[k];
      if (!el) continue;
      var content = (el.textContent || el.innerText || '').trim();
      var match = content.match(/(\\d+)\\s*(?:\\/|de|-)\\s*(\\d+)/i);
      if (match) {
        var cur = parseInt(match[1], 10);
        var tot = parseInt(match[2], 10);
        if (tot > 0) {
          var isPoints = /punto|acierto|correct|score|superad|completad/i.test(content) || /score|punto/i.test(el.id || '') || /score|punto/i.test(el.className || '');
          var completed = isPoints ? cur : Math.max(0, cur - 1);
          if (completed <= 0) {
            return { grade: 1.0, isFinal: false, currentLevel: cur, totalLevels: tot, mistakes: mistakes };
          }
          var gTextCalc = 1.0 + ((completed / tot) * 4.0) - (mistakes * 0.1);
          if (gTextCalc < 1.0) gTextCalc = 1.0;
          if (gTextCalc > 5.0) gTextCalc = 5.0;
          return {
            grade: parseFloat(gTextCalc.toFixed(1)),
            isFinal: completed >= tot,
            currentLevel: cur,
            totalLevels: tot,
            mistakes: mistakes
          };
        }
      }
    }

    // 4. Barra de progreso CSS (ej: style="width: 50%")
    var barEls = doc.querySelectorAll('[role="progressbar"], .progress-bar, [class*="progress-bar"], [id*="progress-bar"], [class*="progress-fill"], [id*="progress-fill"]');
    for (var b = 0; b < barEls.length; b++) {
      var bar = barEls[b];
      var wStr = bar.style && bar.style.width ? bar.style.width : '';
      var wMatch = wStr.match(/(\\d+(?:\\.\\d+)?)\\s*%/);
      if (wMatch) {
        var pct = parseFloat(wMatch[1]);
        if (!isNaN(pct) && pct > 0) {
          var gBar = 1.0 + ((pct / 100) * 4.0) - (mistakes * 0.1);
          if (gBar < 1.0) gBar = 1.0;
          if (gBar > 5.0) gBar = 5.0;
          return {
            grade: parseFloat(gBar.toFixed(1)),
            isFinal: pct >= 100,
            currentLevel: Math.round(pct),
            totalLevels: 100,
            mistakes: mistakes
          };
        }
      }
    }

    // 5. Pantallas activas en el DOM (ej: Flowgorithm screen-intro, screen-level1, etc.)
    var screens = doc.querySelectorAll('main[id*="screen"], div[id*="screen"], section[id*="screen"], .screen, .pantalla');
    if (screens && screens.length > 2) {
      var activeIdx = -1;
      for (var s = 0; s < screens.length; s++) {
        if (isElementVisible(screens[s])) {
          activeIdx = s;
          break;
        }
      }
      if (activeIdx > 0) {
        var totalScreens = screens.length;
        var lastIsVic = /victory|victoria|final|game-over/i.test(screens[totalScreens - 1].id || '');
        var denominator = lastIsVic ? (totalScreens - 1) : totalScreens;
        if (activeIdx >= denominator) {
          return { grade: 5.0, isFinal: true, currentLevel: denominator, totalLevels: denominator, mistakes: mistakes };
        }
        var sRatio = activeIdx / denominator;
        var gScreen = 1.0 + (sRatio * 4.0);
        if (gScreen > 5.0) gScreen = 5.0;
        return {
          grade: parseFloat(gScreen.toFixed(1)),
          isFinal: false,
          currentLevel: activeIdx,
          totalLevels: denominator,
          mistakes: mistakes
        };
      }
    }

    return { grade: 1.0, isFinal: false, currentLevel: 0, totalLevels: 20, mistakes: mistakes };
  }

  function report(isFinalParam) {
    var res = detectActivityProgress();
    var isTrulyFinal = !!isFinalParam || res.isFinal;
    var finalGrade = isTrulyFinal ? Math.max(res.grade, 5.0) : res.grade;

    var payload = {
      type: isTrulyFinal ? 'ACTIVIDAD_COMPLETADA' : 'ACTIVIDAD_PROGRESO',
      grade: finalGrade,
      currentLevel: res.currentLevel,
      totalLevels: res.totalLevels,
      mistakes: res.mistakes,
      isFinal: isTrulyFinal,
      activityTitle: document.title || 'Actividad Interactiva'
    };

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  }

  window.addEventListener('message', function(ev) {
    if (ev.data && ev.data.type === 'AULA_REQUEST_PROGRESS') {
      report(!!ev.data.isFinal);
    }
  });

  function setupHooks() {
    setTimeout(function() { report(false); }, 800);

    // Hook a funciones comunes de actividades
    ['showVictory', 'victory', 'gameWon', 'gameOver', 'winGame', 'finalizarActividad', 'completarActividad', 'finishGame'].forEach(function(fnName) {
      try {
        if (typeof window[fnName] === 'function') {
          var origFn = window[fnName];
          window[fnName] = function() {
            var r = origFn.apply(this, arguments);
            setTimeout(function() { report(true); }, 200);
            return r;
          };
        }
      } catch(e) {}
    });

    // Hook específico para updateLevel(lvl) usado en Flowgorithm y otras actividades
    try {
      if (typeof window.updateLevel === 'function') {
        var origUpdateLevel = window.updateLevel;
        window.updateLevel = function(lvl) {
          var r = origUpdateLevel.apply(this, arguments);
          setTimeout(function() {
            var isVic = lvl === '🏆' || String(lvl).indexOf('🏆') !== -1;
            report(isVic);
          }, 150);
          return r;
        };
      }
    } catch(e) {}

    // Eventos de interacción del usuario
    document.addEventListener('click', function() {
      setTimeout(function() { report(); }, 400);
    }, true);

    document.addEventListener('change', function() {
      setTimeout(function() { report(); }, 400);
    }, true);

    document.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        setTimeout(function() { report(); }, 400);
      }
    }, true);

    // Observador de cambios en el DOM
    try {
      var debounceTimer = null;
      var observer = new MutationObserver(function() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          report();
        }, 500);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    } catch(e) {}

    // Intervalo periódico de seguridad
    setInterval(function() {
      report();
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHooks);
  } else {
    setupHooks();
  }

  window.aulaVirtual = {
    reportGrade: function(g, isFinal) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: isFinal ? 'ACTIVIDAD_COMPLETADA' : 'ACTIVIDAD_PROGRESO',
          grade: g,
          isFinal: !!isFinal
        }, '*');
      }
    }
  };
})();
</script>
`;

  if (html.includes('</body>')) {
    return html.replace('</body>', bridgeScript + '</body>');
  }
  return html + bridgeScript;
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
              htmlText = injectBridgeScript(htmlText);
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
        htmlText = injectBridgeScript(htmlText);
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
