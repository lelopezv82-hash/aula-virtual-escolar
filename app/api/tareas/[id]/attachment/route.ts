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

  // API pública disponible para que la actividad reporte su propia nota
  window.aulaVirtual = {
    reportGrade: function(g, isFinal, extra) {
      sendGradeToPlatform(g, isFinal, extra);
    }
  };
  window.reportGrade = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };
  window.guardarNota = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };
  window.setGrade = function(g, isFinal, extra) {
    sendGradeToPlatform(g, isFinal, extra);
  };

  // Escuchar si la actividad envía un postMessage propio con su nota
  window.addEventListener('message', function(ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    var d = ev.data;
    var raw = d.grade !== undefined ? d.grade : (d.nota !== undefined ? d.nota : (d.calificacion !== undefined ? d.calificacion : (d.score !== undefined ? d.score : null)));
    if (raw !== null) {
      sendGradeToPlatform(raw, d.isFinal || d.type === 'ACTIVIDAD_COMPLETADA' || d.type === 'ACTIVIDAD_FINALIZADA', d);
    }
  });

  // Detección únicamente si la actividad escribe su propia nota en el DOM o en variables globales
  function checkExplicitActivityGrade() {
    // 1. Variables globales asignadas por la actividad
    var gVars = [window.finalGrade, window.notaFinal, window.calificacion, window.currentGrade, window.nota];
    for (var v = 0; v < gVars.length; v++) {
      var nVar = normalizeGrade(gVars[v]);
      if (nVar !== null) {
        sendGradeToPlatform(nVar, true);
        return;
      }
    }

    // 2. Elementos del DOM donde la actividad escribe su nota final
    var selectors = ['#final-grade', '#nota-final', '#calificacion', '#nota', '[id*="final-grade"]', '[id*="nota-final"]', '.nota-final', '.calificacion-final'];
    for (var s = 0; s < selectors.length; s++) {
      var el = document.querySelector(selectors[s]);
      if (el) {
        var txt = (el.textContent || el.innerText || '').trim();
        var nEl = normalizeGrade(txt);
        if (nEl !== null) {
          sendGradeToPlatform(nEl, true);
          return;
        }
      }
    }
  }

  // Observador en el DOM para cuando la actividad escriba la nota en el elemento final
  try {
    var observer = new MutationObserver(function() {
      checkExplicitActivityGrade();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch(e) {}

  setTimeout(checkExplicitActivityGrade, 1500);
  setInterval(checkExplicitActivityGrade, 4000);
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
