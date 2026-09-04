import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import JSZip from 'jszip';
import { getGoogleAccessToken, downloadDriveFile } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

function extractDriveFileId(url: string): string | null {
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

function getFileExtension(url: string, contentType?: string | null): string {
  try {
    const cleanUrl = url.split('?')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    if (match) return `.${match[1]}`;
  } catch {}

  if (contentType) {
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return '.xlsx';
    if (contentType.includes('pdf')) return '.pdf';
    if (contentType.includes('word') || contentType.includes('document')) return '.docx';
    if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '.pptx';
    if (contentType.includes('zip')) return '.zip';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('text/plain')) return '.txt';
  }
  return '.bin';
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

    // Prepare Google Drive access token if any file is in drive
    let gdriveToken: string | null = null;
    const hasDriveFile = studentsWithFiles.some(s => s.submission?.fileUrl?.includes('drive.google.com'));
    if (hasDriveFile) {
      try {
        gdriveToken = await getGoogleAccessToken(task.course.teacherId);
      } catch (e) {
        console.warn('Could not obtain Google Drive token:', e);
      }
    }

    const zip = new JSZip();
    const isSingleGroup = filterGroupId && filterGroupId !== "all";

    // Download each file in parallel with concurrency or Promise.all
    await Promise.all(
      studentsWithFiles.map(async (student, idx) => {
        const fileUrl = student.submission!.fileUrl!;
        const indexStr = String(idx + 1).padStart(2, '0');
        const safeStudentName = student.name.trim().replace(/[\\/:*?"<>|]/g, '_');
        const safeGroupLabel = student.groupLabel.replace(/[\\/:*?"<>|]/g, '_');

        try {
          let buffer: Buffer | null = null;
          let ext = '.bin';

          if (fileUrl.includes('drive.google.com')) {
            const driveFileId = extractDriveFileId(fileUrl);
            if (driveFileId && gdriveToken) {
              buffer = await downloadDriveFile(gdriveToken, driveFileId);
              ext = '.xlsx'; // Native sheets or files default
            } else if (driveFileId) {
              const res = await fetch(`https://drive.google.com/uc?export=download&id=${driveFileId}`);
              if (res.ok) {
                buffer = Buffer.from(await res.arrayBuffer());
                ext = getFileExtension(fileUrl, res.headers.get('content-type'));
              }
            }
          }

          if (!buffer) {
            const res = await fetch(fileUrl);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            ext = getFileExtension(fileUrl, res.headers.get('content-type'));
            buffer = Buffer.from(await res.arrayBuffer());
          }

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
