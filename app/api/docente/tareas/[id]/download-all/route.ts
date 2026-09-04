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
  // 1. If originalName already has an extension
  if (originalName) {
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      if (ext !== 'bin') return `.${ext}`;
    }
  }

  // 2. Sniff magic bytes from the downloaded buffer
  if (buffer.length >= 4) {
    // PDF: %PDF
    if (buffer.subarray(0, 4).toString('ascii') === '%PDF') {
      return '.pdf';
    }
    // PNG: \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return '.png';
    }
    // JPG: \xff\xd8\xff
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return '.jpg';
    }
    // PK\x03\x04 (ZIP / Office OpenXML: xlsx, docx, pptx)
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
    // Legacy Office OLE2: \xd0\xcf\x11\xe0
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return '.xls';
      return '.doc';
    }
  }

  // 3. Fallback to MIME type
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

  // 4. Default to .xlsx rather than .bin
  return '.xlsx';
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        course: { select: { teacherId: true, name: true } },
        groups: {
          include: {
            students: {
              where: { role: 'STUDENT' },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
            grade: { select: { name: true } },
          }
        },
        assignedStudents: {
          select: {
            id: true,
            name: true,
            groupName: true,
            group: {
              select: {
                id: true,
                name: true,
                grade: { select: { name: true } }
              }
            }
          }
        },
        submissions: {
          where: {
            fileUrl: { not: null }
          },
          select: {
            id: true,
            studentId: true,
            fileUrl: true,
            submittedAt: true,
            gdriveEmail: true,
          }
        }
      }
    });

    if (!task || task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Tarea no encontrada o no autorizada' }, { status: 404 });
    }

    const { searchParams } = new URL(_req.url);
    const filterGroupId = searchParams.get("groupId");

    // Gather groups metadata
    const groupNameMap = new Map<string, string>();
    for (const g of task.groups) {
      const label = g.grade?.name ? `Grado ${g.grade.name} - Grupo ${g.name}` : `Grupo ${g.name}`;
      groupNameMap.set(g.id, label);
    }

    // Build ordered list of students
    interface StudentItem {
      id: string;
      name: string;
      groupId?: string;
      groupLabel: string;
      submission?: {
        fileUrl: string | null;
        submittedAt: Date | null;
        gdriveEmail: string | null;
      };
    }

    const studentsList: StudentItem[] = [];
    const seenStudentIds = new Set<string>();

    for (const g of task.groups) {
      if (filterGroupId && filterGroupId !== "all" && g.id !== filterGroupId) {
        continue;
      }
      const groupLabel = groupNameMap.get(g.id) || g.name;
      for (const s of g.students) {
        if (!seenStudentIds.has(s.id)) {
          seenStudentIds.add(s.id);
          const sub = task.submissions.find(sub => sub.studentId === s.id);
          studentsList.push({
            id: s.id,
            name: s.name,
            groupId: g.id,
            groupLabel,
            submission: sub || undefined,
          });
        }
      }
    }

    if (task.assignedStudents) {
      for (const s of task.assignedStudents) {
        const studentGroupId = (s as any).groupId || s.group?.id;
        if (filterGroupId && filterGroupId !== "all" && studentGroupId !== filterGroupId) {
          continue;
        }
        if (!seenStudentIds.has(s.id)) {
          seenStudentIds.add(s.id);
          const groupLabel = s.group?.grade?.name 
            ? `Grado ${s.group.grade.name} - Grupo ${s.group.name}`
            : (s.groupName || "Asignación Individual");
          const sub = task.submissions.find(sub => sub.studentId === s.id);
          studentsList.push({
            id: s.id,
            name: s.name,
            groupId: studentGroupId,
            groupLabel,
            submission: sub || undefined,
          });
        }
      }
    }

    // Filter only those that actually have a fileUrl
    const studentsWithFiles = studentsList.filter(s => !!s.submission?.fileUrl);

    if (studentsWithFiles.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron entregas con archivos adjuntos en el grupo seleccionado.' },
        { status: 400 }
      );
    }

    // Prepare Google Drive access token if any file is in Google Drive/Docs
    let gdriveToken: string | null = null;
    const hasDriveFile = studentsWithFiles.some(s => s.submission?.fileUrl && isGoogleDriveUrl(s.submission.fileUrl));
    if (hasDriveFile) {
      try {
        gdriveToken = await getGoogleAccessToken(task.course.teacherId);
      } catch (e) {
        console.warn('Could not obtain Google Drive token:', e);
      }
    }

    const zip = new JSZip();
    const isSingleGroup = filterGroupId && filterGroupId !== "all";

    // Download each file in parallel
    await Promise.all(
      studentsWithFiles.map(async (student, idx) => {
        const fileUrl = student.submission!.fileUrl!;
        const indexStr = String(idx + 1).padStart(2, '0');
        const safeStudentName = student.name.trim().replace(/[\\/:*?"<>|]/g, '_');
        const safeGroupLabel = student.groupLabel.replace(/[\\/:*?"<>|]/g, '_');

        try {
          let buffer: Buffer | null = null;
          let originalFileName: string | undefined;
          let mimeType: string | undefined;

          // 1. Google Drive / Google Docs handler
          if (isGoogleDriveUrl(fileUrl)) {
            const driveFileId = extractDriveFileId(fileUrl);
            if (driveFileId && gdriveToken) {
              try {
                const driveData = await fetchGoogleDriveFile(gdriveToken, driveFileId);
                buffer = driveData.buffer;
                originalFileName = driveData.originalName;
                mimeType = driveData.mimeType;
              } catch (driveErr) {
                console.warn(`Error using Google token for ${student.name}, trying export fallback:`, driveErr);
              }
            }

            // Fallback for Drive file if token failed or wasn't available
            if (!buffer && driveFileId) {
              const exportUrls = [
                `https://docs.google.com/spreadsheets/d/${driveFileId}/export?format=xlsx`,
                `https://docs.google.com/document/d/${driveFileId}/export?format=docx`,
                `https://drive.google.com/uc?export=download&id=${driveFileId}`
              ];
              for (const expUrl of exportUrls) {
                try {
                  const res = await fetch(expUrl, { redirect: 'follow' });
                  if (res.ok) {
                    const fetchedBuf = Buffer.from(await res.arrayBuffer());
                    const snippet = fetchedBuf.subarray(0, 100).toString('ascii').toLowerCase();
                    if (!snippet.includes('<!doctype html') && !snippet.includes('<html')) {
                      buffer = fetchedBuf;
                      mimeType = res.headers.get('content-type') || undefined;
                      break;
                    }
                  }
                } catch {}
              }
            }
          }

          // 2. Direct HTTP / Supabase storage handler
          if (!buffer) {
            const res = await fetch(fileUrl);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            mimeType = res.headers.get('content-type') || undefined;
            const contentDisposition = res.headers.get('content-disposition');
            if (contentDisposition && contentDisposition.includes('filename=')) {
              const match = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/);
              if (match) {
                originalFileName = decodeURIComponent(match[1] || match[2] || '');
              }
            }
            if (!originalFileName) {
              const urlParts = fileUrl.split('?')[0].split('/');
              originalFileName = decodeURIComponent(urlParts[urlParts.length - 1] || '');
            }
            buffer = Buffer.from(await res.arrayBuffer());
          }

          const ext = detectExtension(buffer, originalFileName, mimeType);
          const fileName = `${indexStr} - ${safeStudentName}${ext}`;
          const filePathInZip = isSingleGroup
            ? fileName
            : `${safeGroupLabel}/${fileName}`;

          zip.file(filePathInZip, buffer);
        } catch (downloadErr: any) {
          console.error(`Error downloading submission for student ${student.name}:`, downloadErr);
          const errorFileName = `${indexStr} - ${safeStudentName} - ERROR_DESCARGA.txt`;
          const errorPathInZip = isSingleGroup
            ? errorFileName
            : `${safeGroupLabel}/${errorFileName}`;
          zip.file(
            errorPathInZip,
            `No se pudo descargar automáticamente el archivo de entrega de este estudiante.\n` +
            `Estudiante: ${student.name}\n` +
            `URL del archivo: ${fileUrl}\n` +
            `Detalle del error: ${downloadErr.message || 'Error desconocido'}\n`
          );
        }
      })
    );

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const activeGroup = task.groups.find(g => g.id === filterGroupId);
    const activeGroupName = activeGroup 
      ? (activeGroup.grade?.name ? `${activeGroup.grade.name} - ${activeGroup.name}` : activeGroup.name)
      : (filterGroupId && filterGroupId !== "all" ? "Grupo" : "Todos los Grupos");

    const safeTaskTitle = task.title.trim().replace(/[\\/:*?"<>|]/g, '_');
    const safeGroupName = activeGroupName.replace(/[\\/:*?"<>|]/g, '_');
    const zipName = `Entregas - ${safeTaskTitle} - ${safeGroupName}.zip`;

    return new Response(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipName)}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating submissions zip:', error);
    return NextResponse.json({ error: 'Error interno al generar el archivo comprimido' }, { status: 500 });
  }
}
