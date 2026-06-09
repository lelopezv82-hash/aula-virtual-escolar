import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';
import { enqueueFailedDriveUpload } from '@/lib/driveQueue';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET details of a specific task
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { 
        course: true,
        groups: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH update details/attachment of a task
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { course: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const { active, allowLateSubmission, lateSubmissionUntil } = await request.json();
      const dataToUpdate: any = {};
      if (active !== undefined) dataToUpdate.active = !!active;
      if (allowLateSubmission !== undefined) dataToUpdate.allowLateSubmission = !!allowLateSubmission;
      if (lateSubmissionUntil !== undefined) {
        dataToUpdate.lateSubmissionUntil = lateSubmissionUntil ? new Date(lateSubmissionUntil) : null;
      }
      
      const updatedTask = await prisma.task.update({
        where: { id: resolvedParams.id },
        data: dataToUpdate
      });
      return NextResponse.json({ success: true, task: updatedTask });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const dueDate = formData.get('dueDate') as string;
    const file = formData.get('file') as File | null;
    const theme = formData.get('theme') as string | null;
    const period = formData.get('period') as string | null;
    const weightRaw = formData.get('weight') as string | null;
    const weight = weightRaw ? parseInt(weightRaw, 10) : 0;
    const groupIdsJson = formData.get('groupIds') as string | null;
    const publishAtRaw = formData.get('publishAt') as string | null;
    const publishAt = publishAtRaw && publishAtRaw.trim() !== "" ? new Date(publishAtRaw) : null;
    const externalUrl = formData.get('externalUrl') as string | null;

    let groupIds: string[] = [];
    if (groupIdsJson) {
      try {
        groupIds = JSON.parse(groupIdsJson);
      } catch {
        groupIds = [groupIdsJson];
      }
    }

    if (!title || !dueDate || !theme || !period || !groupIds || groupIds.length === 0) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, fecha límite, tema, periodo y al menos un grupo)' }, { status: 400 });
    }

    let attachmentUrl = externalUrl !== null ? externalUrl : task.attachmentUrl;
    let gdriveEmail: string | null = task.gdriveEmail;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Try uploading to Google Drive first if teacher has it connected
      const gAccessToken = await getGoogleAccessToken(payload.id as string);
      if (gAccessToken) {
        try {
          const selectedGroups = await prisma.gradeGroup.findMany({
            where: { id: { in: groupIds } },
            include: { grade: true }
          });
          const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
          const groupName = selectedGroups[0]?.name || "Sin Grupo";
          const folderPath = `${period}/${task.course.name}/${gradeName}/${groupName}/Tareas/${title}`;
          const uploadResult = await uploadToGoogleDrive(buffer, file.name, file.type, payload.id as string, folderPath);
          attachmentUrl = uploadResult.url;
          gdriveEmail = uploadResult.email;
        } catch (driveError) {
          console.error("Google Drive task update upload error, falling back to Supabase:", driveError);
        }
      }

      if (attachmentUrl === task.attachmentUrl) {
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueFilename = `tareas/${task.courseId}_${Date.now()}_${safeFilename}`;

        const { error: uploadError } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueFilename, buffer, {
            contentType: file.type,
            duplex: 'half'
          });

        if (uploadError) {
          console.error("Supabase task edit upload error:", uploadError);
          return NextResponse.json({ error: 'Error al subir el archivo adjunto' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueFilename);

        attachmentUrl = publicUrl;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: resolvedParams.id },
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        attachmentUrl,
        gdriveEmail,
        theme,
        period,
        publishAt,
        groups: {
          set: groupIds.map(id => ({ id }))
        },
        weight: isNaN(weight) ? 0 : weight
      }
    });

    // Si el archivo adjunto cambió y quedó en Supabase (gdrive falló), encolar para reintento
    if (file && file.size > 0 && !gdriveEmail && attachmentUrl && attachmentUrl.includes('supabase') && attachmentUrl !== task.attachmentUrl) {
      const supabasePath = attachmentUrl.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
      const selectedGroups = await prisma.gradeGroup.findMany({
        where: { id: { in: groupIds } },
        include: { grade: true }
      });
      const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
      const groupName = selectedGroups[0]?.name || "Sin Grupo";
      const folderPath = `${period}/${task.course.name}/${gradeName}/${groupName}/Tareas/${title}`;

      await enqueueFailedDriveUpload({
        recordType: 'TASK',
        recordId: updatedTask.id,
        supabaseUrl: attachmentUrl,
        supabasePath,
        teacherId: payload.id as string,
        filename: file.name,
        mimeType: file.type,
        folderPath,
      });
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE a task
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { course: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.task.delete({
      where: { id: resolvedParams.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
