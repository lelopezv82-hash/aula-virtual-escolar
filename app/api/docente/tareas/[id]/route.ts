import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';
import { enqueueFailedDriveUpload } from '@/lib/driveQueue';

import { fromColombiaLocalStringToDate } from '@/lib/dateUtils';

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
        groups: true,
        resources: true,
        themes: true,
        assignedStudents: {
          select: {
            id: true,
            name: true,
            username: true,
            groupName: true,
            groupId: true
          }
        }
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
      const { active, allowLateSubmission, lateSubmissionUntil, studentIds } = await request.json();
      const dataToUpdate: any = {};
      if (active !== undefined) dataToUpdate.active = !!active;
      if (allowLateSubmission !== undefined) dataToUpdate.allowLateSubmission = !!allowLateSubmission;
      if (lateSubmissionUntil !== undefined) {
        dataToUpdate.lateSubmissionUntil = fromColombiaLocalStringToDate(lateSubmissionUntil);
      }
      if (studentIds !== undefined && Array.isArray(studentIds)) {
        dataToUpdate.assignedStudents = {
          set: studentIds.map((id: string) => ({ id }))
        };
      }
      
      const updatedTask = await prisma.task.update({
        where: { id: resolvedParams.id },
        data: dataToUpdate,
        include: {
          assignedStudents: {
            select: {
              id: true,
              name: true,
              username: true,
              groupName: true,
              groupId: true
            }
          }
        }
      });
      return NextResponse.json({ success: true, task: updatedTask });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const dueDate = formData.get('dueDate') as string;
    const file = formData.get('file') as File | null;
    const theme = formData.get('theme') as string | null;
    let themeTitles: string[] = [];
    if (theme) {
      try {
        themeTitles = JSON.parse(theme);
        if (!Array.isArray(themeTitles)) {
          themeTitles = [String(theme)];
        }
      } catch {
        themeTitles = [theme];
      }
    }
    const legacyThemeString = themeTitles.join(', ');

    const period = formData.get('period') as string | null;
    const weightRaw = formData.get('weight') as string | null;
    const weight = weightRaw ? parseInt(weightRaw, 10) : 0;
    const groupIdsJson = formData.get('groupIds') as string | null;
    const resourceIdsJson = formData.get('resourceIds') as string | null;
    const publishAtRaw = formData.get('publishAt') as string | null;
    const publishAt = fromColombiaLocalStringToDate(publishAtRaw);
    const durationRaw = formData.get('duration') as string | null;
    const duration = durationRaw && durationRaw.trim() !== "" ? parseInt(durationRaw, 10) : null;
    const type = formData.get('type') as string | null;
    const externalUrl = formData.get('externalUrl') as string | null;
    const isExternalRaw = formData.get('isExternal') as string | null;
    const isExternal = isExternalRaw === 'true';

    const allowLateSubmissionRaw = formData.get('allowLateSubmission') as string | null;
    const allowLateSubmission = allowLateSubmissionRaw === 'true';
    const lateSubmissionUntilRaw = formData.get('lateSubmissionUntil') as string | null;
    const lateSubmissionUntil = allowLateSubmission ? fromColombiaLocalStringToDate(lateSubmissionUntilRaw) : null;

    let groupIds: string[] = [];
    if (groupIdsJson) {
      try {
        groupIds = JSON.parse(groupIdsJson);
      } catch {
        groupIds = [groupIdsJson];
      }
    }

    let resourceIds: string[] = [];
    if (resourceIdsJson) {
      try {
        resourceIds = JSON.parse(resourceIdsJson);
      } catch {
        resourceIds = [resourceIdsJson];
      }
    }

    const studentIdsJson = formData.get('studentIds') as string | null;
    let studentIds: string[] | undefined = undefined;
    if (studentIdsJson !== null) {
      try {
        const parsed = JSON.parse(studentIdsJson);
        if (Array.isArray(parsed)) {
          studentIds = parsed;
        }
      } catch {
        studentIds = [];
      }
    }

    if (!title || (!isExternal && !dueDate) || !theme || !period || !groupIds || groupIds.length === 0) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, fecha límite, tema, periodo y al menos un grupo)' }, { status: 400 });
    }

    const removeAttachmentRaw = formData.get('removeAttachment') as string | null;
    const removeAttachment = removeAttachmentRaw === 'true';

    let attachmentUrl = task.attachmentUrl;
    let gdriveEmail: string | null = task.gdriveEmail;

    if (removeAttachment) {
      attachmentUrl = null;
      gdriveEmail = null;
    }

    if (externalUrl !== null && externalUrl !== undefined && externalUrl.trim() !== "") {
      attachmentUrl = externalUrl.trim();
      gdriveEmail = null;
    }

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

    const parsedDueDate = dueDate && dueDate.trim() !== ""
      ? (fromColombiaLocalStringToDate(dueDate) || new Date())
      : new Date("9999-12-31T23:59:59Z");

    const updatedTask = await prisma.task.update({
      where: { id: resolvedParams.id },
      data: {
        title,
        description,
        dueDate: parsedDueDate,
        attachmentUrl,
        gdriveEmail,
        theme: legacyThemeString,
        period,
        publishAt,
        groups: {
          set: groupIds.map(id => ({ id }))
        },
        resources: {
          set: resourceIds.map(id => ({ id }))
        },
        ...(studentIds !== undefined ? {
          assignedStudents: {
            set: studentIds.map(id => ({ id }))
          }
        } : {}),
        themes: {
          set: (await prisma.theme.findMany({
            where: {
              courseId: task.courseId,
              title: { in: themeTitles }
            }
          })).map(t => ({ id: t.id }))
        },
        weight: isNaN(weight) ? 0 : weight,
        duration: duration && !isNaN(duration) ? duration : null,
        type: type || undefined,
        isExternal: isExternal,
        allowLateSubmission,
        lateSubmissionUntil
      }
    });

    if (allowLateSubmission) {
      await prisma.submission.updateMany({
        where: {
          taskId: resolvedParams.id,
          grade: 1.0,
        },
        data: {
          grade: null,
          status: "PENDING",
        }
      });
    }


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
