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
  function getCalculatedGrade() {
    // 1. Verificar si la pantalla de victoria está REALMENTE visible en el juego
    var isVictory = false;
    var victoryEl = document.getElementById('victory-screen') || document.querySelector('.victory-screen, .game-over, #pantalla-final');
    if (victoryEl) {
      var isHidden = victoryEl.classList.contains('hidden') || victoryEl.style.display === 'none' || victoryEl.offsetParent === null;
      if (!isHidden) isVictory = true;
    }

    if (isVictory) {
      // Pantalla de victoria visible: leer nota final de victoria
      var fgEl = document.getElementById('final-grade') || document.getElementById('nota-final');
      if (fgEl) {
        var val = parseFloat((fgEl.textContent || fgEl.innerText || "").trim());
        if (!isNaN(val) && val >= 1.0 && val <= 5.0) return val;
      }
      var vErrs = typeof mistakes !== 'undefined' ? mistakes : 0;
      var gVic = 5.0 - (vErrs * 0.1);
      if (gVic < 1.0) gVic = 1.0;
      if (gVic > 5.0) gVic = 5.0;
      return parseFloat(gVic.toFixed(1));
    }

    // 2. Durante el juego (pantalla de victoria NO visible):
    // Calcular nota proporcional según los niveles REALMENTE superados
    try {
      var curLvl = typeof currentLevelIndex !== 'undefined' ? currentLevelIndex : (typeof currentLevel !== 'undefined' ? currentLevel : null);
      var lvlArr = typeof levels !== 'undefined' && Array.isArray(levels) ? levels : null;
      var errs = typeof mistakes !== 'undefined' ? mistakes : (typeof errors !== 'undefined' ? errors : 0);

      if (curLvl !== null && lvlArr && lvlArr.length > 0) {
        var total = lvlArr.length;
        if (curLvl <= 0) {
          // El estudiante está en el nivel 1 (0 niveles completados)
          return 1.0;
        }
        var progressRatio = curLvl / total;
        var g = 1.0 + (progressRatio * 4.0) - (errs * 0.1);
        if (g < 1.0) g = 1.0;
        if (g > 5.0) g = 5.0;
        return parseFloat(g.toFixed(1));
      }
    } catch(e) {}

    // 3. Respaldo por texto de progreso ("X / Y")
    var progEl = document.getElementById('progress-text') || document.querySelector('.progress-text');
    if (progEl) {
      var match = (progEl.textContent || "").match(/(\\d+)\\s*\\/\\s*(\\d+)/);
      if (match) {
        var cur = parseInt(match[1], 10);
        var tot = parseInt(match[2], 10);
        if (tot > 0) {
          // Si el texto dice "1 / 20", el nivel 1 está en juego: 0 niveles completados
          var completed = Math.max(0, cur - 1);
          if (completed <= 0) return 1.0;
          var gProg = 1.0 + ((completed / tot) * 4.0);
          if (gProg > 5.0) gProg = 5.0;
          return parseFloat(gProg.toFixed(1));
        }
      }
    }

    return 1.0;
  }

  function report(isFinal) {
    var grade = getCalculatedGrade();
    var curLvl = 0;
    var totLvls = 20;
    var errCount = 0;

    try {
      if (typeof currentLevelIndex !== 'undefined') curLvl = currentLevelIndex;
      else if (typeof currentLevel !== 'undefined') curLvl = currentLevel;
      if (typeof levels !== 'undefined' && Array.isArray(levels)) totLvls = levels.length;
      if (typeof mistakes !== 'undefined') errCount = mistakes;
      else if (typeof errors !== 'undefined') errCount = errors;
    } catch(e) {}

    if (curLvl === 0) {
      var progEl = document.getElementById('progress-text') || document.querySelector('.progress-text');
      if (progEl) {
        var match = (progEl.textContent || "").match(/(\\d+)\\s*\\/\\s*(\\d+)/);
        if (match) {
          curLvl = Math.max(0, parseInt(match[1], 10) - 1);
          totLvls = parseInt(match[2], 10);
        }
      }
    }

    var payload = {
      type: isFinal ? 'ACTIVIDAD_COMPLETADA' : 'ACTIVIDAD_PROGRESO',
      grade: grade,
      currentLevel: curLvl,
      totalLevels: totLvls,
      mistakes: errCount,
      isFinal: !!isFinal,
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
    setTimeout(function() { report(false); }, 1000);

    try {
      if (typeof window.showVictory === 'function') {
        var origVictory = window.showVictory;
        window.showVictory = function() {
          var r = origVictory.apply(this, arguments);
          setTimeout(function() { report(true); }, 300);
          return r;
        };
      }
    } catch(e) {}

    document.addEventListener('click', function() {
      setTimeout(function() {
        var isVic = document.getElementById('victory-screen') || document.querySelector('.victory-screen');
        var isDone = isVic && !isVic.classList.contains('hidden') && isVic.offsetParent !== null;
        report(isDone);
      }, 600);
    }, true);

    document.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        setTimeout(function() {
          var isVic = document.getElementById('victory-screen') || document.querySelector('.victory-screen');
          var isDone = isVic && !isVic.classList.contains('hidden') && isVic.offsetParent !== null;
          report(isDone);
        }, 600);
      }
    }, true);

    try {
      var observer = new MutationObserver(function() {
        var isVic = document.getElementById('victory-screen') || document.querySelector('.victory-screen');
        if (isVic && !isVic.classList.contains('hidden') && isVic.offsetParent !== null) {
          report(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    } catch(e) {}
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
