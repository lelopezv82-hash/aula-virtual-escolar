import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import JSZip from 'jszip';
import { getGoogleAccessToken } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

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

function detectExtension(buffer: Buffer, originalName?: string, mimeType?: string): string {
  if (originalName) {
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      if (ext !== 'bin') return `.${ext}`;
    }
  }

  if (buffer.length >= 4) {
    if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return '.pdf';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x43) return '.png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      if (mimeType?.includes('sheet') || mimeType?.includes('spreadsheet')) return '.xlsx';
      if (mimeType?.includes('word') || mimeType?.includes('document')) return '.docx';
      if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return '.pptx';
      const headerSnippet = buffer.subarray(0, Math.min(buffer.length, 3072)).toString('ascii');
      if (headerSnippet.includes('xl/')) return '.xlsx';
      if (headerSnippet.includes('word/')) return '.docx';
      if (headerSnippet.includes('ppt/')) return '.pptx';
      return '.zip';
    }
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return '.xls';
      return '.doc';
    }
  }

  if (mimeType) {
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '.xlsx';
    if (mimeType.includes('pdf')) return '.pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return '.docx';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '.pptx';
    if (mimeType.includes('zip')) return '.zip';
    if (mimeType.includes('png')) return '.png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
    if (mimeType.includes('text/plain')) return '.txt';
  }

  return '';
}

async function fetchGoogleDriveFile(token: string, fileId: string): Promise<{ buffer: Buffer; originalName?: string; mimeType?: string }> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!metaRes.ok) {
    throw new Error(`Drive metadata error: ${await metaRes.text()}`);
  }

  const meta = await metaRes.json();
  const isNativeSheet = meta.mimeType === 'application/vnd.google-apps.spreadsheet';
  const isNativeDoc = meta.mimeType === 'application/vnd.google-apps.document';
  const isNativePres = meta.mimeType === 'application/vnd.google-apps.presentation';

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  if (isNativeSheet) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  } else if (isNativeDoc) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
  } else if (isNativePres) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.presentationml.presentation`;
  }

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Drive download error: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    originalName: meta.name,
    mimeType: meta.mimeType,
  };
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const requestedStudentId = searchParams.get('studentId');

    if (!taskId) {
      return NextResponse.json({ error: 'Falta taskId' }, { status: 400 });
    }

    let targetStudentId = payload.id as string;
    if (payload.role === "TEACHER" || payload.role === "ADMIN") {
      if (requestedStudentId) {
        targetStudentId = requestedStudentId;
      }
    } else if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        course: { select: { teacherId: true, name: true } },
        submissions: {
          where: { studentId: targetStudentId },
          include: {
            student: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const submission = task.submissions[0];
    if (!submission) {
      return NextResponse.json({ error: 'No se encontró la entrega' }, { status: 404 });
    }

    const teacherId = task.course.teacherId;
    let driveToken: string | null = null;
    if (teacherId) {
      try {
        driveToken = await getGoogleAccessToken(teacherId);
      } catch (err) {
        console.warn('Could not fetch Google Drive token for download:', err);
      }
    }

    // Determine files to package
    let itemsToDownload: Array<{ name: string; url: string; relativePath?: string }> = [];

    if (submission.fileUrls && Array.isArray(submission.fileUrls) && submission.fileUrls.length > 0) {
      itemsToDownload = submission.fileUrls.map((item: any) => ({
        name: item.name || 'archivo',
        url: item.url,
        relativePath: item.relativePath || item.name || 'archivo'
      }));
    } else if (submission.fileUrl) {
      itemsToDownload = [{
        name: 'entrega',
        url: submission.fileUrl,
        relativePath: 'entrega'
      }];
    }

    if (itemsToDownload.length === 0) {
      return NextResponse.json({ error: 'No hay archivos adjuntos en esta entrega' }, { status: 404 });
    }

    const zip = new JSZip();
    const studentName = submission.student?.name || 'Estudiante';

    for (const item of itemsToDownload) {
      if (!item.url) continue;

      try {
        let fileBuffer: Buffer | null = null;
        let finalFilename = item.name;

        if (isGoogleDriveUrl(item.url) && driveToken) {
          const fileId = extractDriveFileId(item.url);
          if (fileId) {
            const driveFile = await fetchGoogleDriveFile(driveToken, fileId);
            fileBuffer = driveFile.buffer;
            if (driveFile.originalName) {
              finalFilename = driveFile.originalName;
            } else {
              const detectedExt = detectExtension(fileBuffer, item.name, driveFile.mimeType);
              if (detectedExt && !finalFilename.endsWith(detectedExt)) {
                finalFilename = `${finalFilename}${detectedExt}`;
              }
            }
          }
        }

        if (!fileBuffer) {
          const res = await fetch(item.url);
          if (res.ok) {
            const ab = await res.arrayBuffer();
            fileBuffer = Buffer.from(ab);
            const contentType = res.headers.get('content-type') || '';
            const detectedExt = detectExtension(fileBuffer, item.name, contentType);
            if (detectedExt && !finalFilename.includes('.')) {
              finalFilename = `${finalFilename}${detectedExt}`;
            }
          }
        }

        if (fileBuffer) {
          const zipPath = item.relativePath && item.relativePath.includes('/') 
            ? item.relativePath 
            : finalFilename;
          zip.file(zipPath, fileBuffer);
        }
      } catch (fileErr) {
        console.error(`Error downloading file ${item.name} for zip:`, fileErr);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const safeTitle = (task.title || 'Tarea').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeStudent = studentName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${safeStudent}_-_${safeTitle}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error downloading submission zip:', error);
    return NextResponse.json({ error: 'Error interno al generar el archivo descargable' }, { status: 500 });
  }
}
