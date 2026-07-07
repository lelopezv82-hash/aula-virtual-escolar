import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { getGoogleAccessToken, getAccountsWithSpace, resolveDriveFolderPath } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

// POST: Upload a local Excel file to Google Drive as the sync file
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const gAccessToken = await getGoogleAccessToken(teacherId);

    if (!gAccessToken) {
      return NextResponse.json({ error: 'Google Drive no vinculado' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const courseId = formData.get('courseId') as string | null;
    const period = formData.get('period') as string | null;

    if (!file || !courseId || !period) {
      return NextResponse.json({ error: 'Faltan parámetros (file, courseId, period)' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos Excel (.xlsx, .xls)' }, { status: 400 });
    }

    // Fetch course details
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        groups: { include: { grade: true } }
      }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Get the proper account token (same selection logic as sync)
    const accounts = await getAccountsWithSpace(teacherId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No se encontraron cuentas de Google Drive vinculadas.' }, { status: 400 });
    }
    accounts.sort((a, b) => b.freeSpace - a.freeSpace);
    const selectedAccount = accounts[0];
    const accountToken = selectedAccount?.accessToken || gAccessToken;

    // Resolve the Drive folder path
    const gradeName = course.groups[0]?.grade?.name || "Sin Grado";
    const folderPath = `${gradeName}/${course.name}/${period}`;
    const filename = `Sincro_Planilla_${course.name}_${period}.xlsx`;

    const folderId = await resolveDriveFolderPath(accountToken, teacherId, folderPath);

    // Read the file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Check if a stored file already exists for this period — if so, update it
    const existingSyncFiles = (course.gDriveSyncFiles as Record<string, string> | null) || {};
    const storedFileId = existingSyncFiles[period];

    let finalFileId: string;
    let finalWebViewLink: string;

    if (storedFileId) {
      // Try to update existing file
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${storedFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accountToken}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
          body: fileBuffer as any,
        }
      );

      if (patchRes.ok) {
        finalFileId = storedFileId;
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${storedFileId}?fields=id,webViewLink`,
          { headers: { Authorization: `Bearer ${accountToken}` } }
        );
        const meta = metaRes.ok ? await metaRes.json() : {};
        finalWebViewLink = meta.webViewLink || '';
      } else {
        // Stored file gone — upload fresh
        const uploadRes = await uploadFileToDrive(accountToken, fileBuffer, filename, folderId);
        finalFileId = uploadRes.id;
        finalWebViewLink = uploadRes.webViewLink;
      }
    } else {
      // No stored file — upload new
      const uploadRes = await uploadFileToDrive(accountToken, fileBuffer, filename, folderId);
      finalFileId = uploadRes.id;
      finalWebViewLink = uploadRes.webViewLink;
    }

    // Save the file ID to DB
    if (!finalFileId) {
      throw new Error('El archivo fue subido pero no se pudo obtener su ID de Google Drive. Intente nuevamente.');
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        gDriveSyncFiles: { ...existingSyncFiles, [period]: finalFileId }
      }
    });

    const drivePath = `Aula Virtual Escolar / ${gradeName} / ${course.name} / ${period}`;

    return NextResponse.json({
      success: true,
      message: 'Archivo subido a Google Drive correctamente.',
      webViewLink: finalWebViewLink,
      fileId: finalFileId,
      drivePath,
    });

  } catch (error: any) {
    console.error('Error uploading file to Drive:', error);
    return NextResponse.json({ error: 'Error interno: ' + (error?.message || error) }, { status: 500 });
  }
}

// Helper: Upload a file buffer to Drive inside a specific folder
async function uploadFileToDrive(
  accessToken: string,
  buffer: Buffer,
  filename: string,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const boundary = 'drive_upload_boundary';
  const metaStr = JSON.stringify(metadata);
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaStr}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
  ];

  const part1 = Buffer.from(bodyParts[0]);
  const part2 = Buffer.from(bodyParts[1]);
  const part3 = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([part1, part2, buffer, part3]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body as any,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload file to Drive: ${errText}`);
  }

  const data = await res.json();
  return { id: data.id, webViewLink: data.webViewLink || '' };
}
