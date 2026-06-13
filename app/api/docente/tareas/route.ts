import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';
import { enqueueFailedDriveUpload } from '@/lib/driveQueue';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacherId = payload.id as string;

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const dueDate = formData.get('dueDate') as string;
    const courseId = formData.get('courseId') as string;
    const file = formData.get('file') as File | null;
    const theme = formData.get('theme') as string | null;
    const period = formData.get('period') as string | null;
    const weightRaw = formData.get('weight') as string | null;
    const weight = weightRaw ? parseInt(weightRaw, 10) : 0;
    const groupIdsJson = formData.get('groupIds') as string | null;
    const publishAtRaw = formData.get('publishAt') as string | null;
    const publishAt = publishAtRaw && publishAtRaw.trim() !== "" ? new Date(publishAtRaw) : null;
    const durationRaw = formData.get('duration') as string | null;
    const duration = durationRaw && durationRaw.trim() !== "" ? parseInt(durationRaw, 10) : null;

    let groupIds: string[] = [];
    if (groupIdsJson) {
      try {
        groupIds = JSON.parse(groupIdsJson);
      } catch {
        groupIds = [groupIdsJson];
      }
    }

    if (!title || !dueDate || !courseId || !theme || !period || !groupIds || groupIds.length === 0) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, fecha límite, curso, tema, periodo y al menos un grupo)' }, { status: 400 });
    }

    // Verify course belongs to teacher
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId }
    });

    if (!course) {
      return NextResponse.json({ error: 'Curso no encontrado o no te pertenece' }, { status: 403 });
    }

    let attachmentUrl = null;
    let gdriveEmail: string | null = null;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Try uploading to Google Drive first if teacher has it connected
      const gAccessToken = await getGoogleAccessToken(teacherId);
      if (gAccessToken) {
        try {
          const selectedGroups = await prisma.gradeGroup.findMany({
            where: { id: { in: groupIds } },
            include: { grade: true }
          });
          const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
          const groupName = selectedGroups[0]?.name || "Sin Grupo";
          const folderPath = `${period}/${course.name}/${gradeName}/${groupName}/Tareas/${title}`;
          const uploadResult = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, folderPath);
          attachmentUrl = uploadResult.url;
          gdriveEmail = uploadResult.email;
        } catch (driveError) {
          console.error("Google Drive task upload error, falling back to Supabase:", driveError);
        }
      }

      // Fallback to Supabase if not uploaded to Drive
      if (!attachmentUrl) {
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueFilename = `tareas/${courseId}_${Date.now()}_${safeFilename}`;

        const { error: uploadError } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueFilename, buffer, {
            contentType: file.type,
            duplex: 'half'
          });

        if (uploadError) {
          console.error("Supabase task upload error:", uploadError);
          return NextResponse.json({ error: 'Error al subir el archivo adjunto a almacenamiento en la nube' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueFilename);

        attachmentUrl = publicUrl;
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        attachmentUrl,
        gdriveEmail,
        courseId,
        theme,
        period,
        publishAt,
        groups: {
          connect: groupIds.map(id => ({ id }))
        },
        weight: isNaN(weight) ? 0 : weight,
        duration: duration && !isNaN(duration) ? duration : null
      }
    });

    // Si el archivo adjunto quedó en Supabase (gdrive falló), encolar para reintento
    if (file && file.size > 0 && !gdriveEmail && attachmentUrl && attachmentUrl.includes('supabase')) {
      const supabasePath = attachmentUrl.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
      const selectedGroups = await prisma.gradeGroup.findMany({
        where: { id: { in: groupIds } },
        include: { grade: true }
      });
      const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
      const groupName = selectedGroups[0]?.name || "Sin Grupo";
      const folderPath = `${period}/${course.name}/${gradeName}/${groupName}/Tareas/${title}`;

      await enqueueFailedDriveUpload({
        recordType: 'TASK',
        recordId: task.id,
        supabaseUrl: attachmentUrl,
        supabasePath,
        teacherId,
        filename: file.name,
        mimeType: file.type,
        folderPath,
      });
    }

    return NextResponse.json({ success: true, task });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
