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
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;
    const formData = await request.formData();
    const taskId = formData.get('taskId') as string;
    const file = formData.get('file') as File | null;

    if (!taskId) {
      return NextResponse.json({ error: 'Falta taskId' }, { status: 400 });
    }

    let fileUrl = "";
    let gdriveEmail: string | null = null;

    // Find the task, include groups and course details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        groups: true,
        course: {
          select: {
            teacherId: true,
            name: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Security & Scheduling checks
    if (task.active === false) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const now = new Date();
    if (task.publishAt && new Date(task.publishAt) > now) {
      return NextResponse.json({ error: 'Tarea no disponible todavía' }, { status: 403 });
    }

    if (task.period) {
      const period = await prisma.period.findUnique({
        where: { name: task.period }
      });
      if (period && !period.active) {
        return NextResponse.json({ error: 'El periodo de esta tarea no está activo' }, { status: 403 });
      }
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        group: {
          include: {
            grade: true
          }
        }
      }
    });

    if (task.groups.length > 0 && !task.groups.some(g => g.id === student?.groupId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta tarea.' }, { status: 403 });
    }

    // Check if task has a timer limit
    if (task.duration) {
      const existingSubmission = await prisma.submission.findUnique({
        where: {
          taskId_studentId: {
            taskId,
            studentId
          }
        }
      });

      if (!existingSubmission || !existingSubmission.startedAt) {
        return NextResponse.json({ error: 'Debe iniciar el examen antes de entregar.' }, { status: 400 });
      }

      const timeLimitInMs = (task.duration * 60 * 1000) + 30000; // 30 seconds grace period
      const timeElapsed = now.getTime() - new Date(existingSubmission.startedAt).getTime();

      if (timeElapsed > timeLimitInMs) {
        return NextResponse.json({ error: 'El tiempo límite para este examen ha vencido.' }, { status: 400 });
      }
    }

    const isLate = now > new Date(task.dueDate);

    if (isLate) {
      // Comprobar si la entrega tardía general está permitida (indefinidamente o plazo de fecha no vencido)
      const isGeneralLateAllowed = task.allowLateSubmission || (task.lateSubmissionUntil && new Date(task.lateSubmissionUntil) > now);

      if (!isGeneralLateAllowed) {
        // Comprobar si hay un permiso individual extemporáneo para este estudiante
        const existingSubmission = await prisma.submission.findUnique({
          where: {
            taskId_studentId: {
              taskId,
              studentId
            }
          }
        });

        const isStudentLateAllowed = existingSubmission && (
          existingSubmission.allowLateSubmission || 
          (existingSubmission.lateSubmissionUntil && new Date(existingSubmission.lateSubmissionUntil) > now)
        );

        if (!isStudentLateAllowed) {
          return NextResponse.json({ error: 'El plazo de entrega ha vencido para esta tarea.' }, { status: 400 });
        }
      }
    }

    const teacherId = task.course.teacherId;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      let driveFileName = file.name;
      let folderPath = "";

      if (teacherId) {
        const gradeName = student?.group?.grade?.name || "Sin Grado";
        const groupName = student?.group?.name || "Sin Grupo";
        const studentName = student?.name || "Estudiante";
        driveFileName = `${studentName} - ${file.name}`;
        const taskPeriod = task.period || "Sin Periodo";
        folderPath = `${taskPeriod}/${task.course.name}/${gradeName}/${groupName}/Tareas/${task.title}/Entregas/${studentName}`;

        // Try uploading to Google Drive first if teacher has it connected
        const gAccessToken = await getGoogleAccessToken(teacherId);
        if (gAccessToken) {
          try {
            const uploadResult = await uploadToGoogleDrive(buffer, driveFileName, file.type, teacherId, folderPath);
            fileUrl = uploadResult.url;
            gdriveEmail = uploadResult.email;
          } catch (driveError) {
            console.error("Google Drive upload error for student submission, falling back to Supabase:", driveError);
          }
        }
      }

      // Fallback to Supabase if not uploaded to Drive
      if (!fileUrl) {
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueFilename = `submissions/${studentId}_${taskId}_${Date.now()}_${safeFilename}`;
        
        const { error: uploadError } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueFilename, buffer, {
            contentType: file.type,
            duplex: 'half'
          });

        if (uploadError) {
          console.error("Supabase submission upload error:", uploadError);
          return NextResponse.json({ error: 'Error al subir el archivo a almacenamiento en la nube' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueFilename);

        fileUrl = publicUrl;
      }
    } else {
      // Preserve existing fileUrl if no new file is uploaded
      const existingSubmission = await prisma.submission.findUnique({
        where: {
          taskId_studentId: {
            taskId,
            studentId
          }
        }
      });
      fileUrl = existingSubmission?.fileUrl || "";
      gdriveEmail = existingSubmission?.gdriveEmail || null;
    }

    // Upsert submission in database
    const submission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      },
      update: {
        fileUrl: fileUrl || null,
        gdriveEmail,
        status: "SUBMITTED",
        submittedAt: new Date()
      },
      create: {
        taskId,
        studentId,
        fileUrl: fileUrl || null,
        gdriveEmail,
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    // Si la entrega quedó en Supabase y se envió un archivo, la encolamos para reintento en Drive cuando se configure/solucione
    if (file && !gdriveEmail && fileUrl && fileUrl.includes('supabase') && teacherId) {
      const supabasePath = fileUrl.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
      const gradeName = student?.group?.grade?.name || "Sin Grado";
      const groupName = student?.group?.name || "Sin Grupo";
      const studentName = student?.name || "Estudiante";
      const driveFileName = `${studentName} - ${file.name}`;
      const taskPeriod = task.period || "Sin Periodo";
      const folderPath = `${taskPeriod}/${task.course.name}/${gradeName}/${groupName}/Tareas/${task.title}/Entregas/${studentName}`;

      await enqueueFailedDriveUpload({
        recordType: 'SUBMISSION',
        recordId: submission.id,
        supabaseUrl: fileUrl,
        supabasePath,
        teacherId: teacherId,
        filename: driveFileName,
        mimeType: file.type,
        folderPath,
      });
    }

    return NextResponse.json({ success: true, submission });

  } catch (error) {
    console.error('Error in submission upload:', error);
    return NextResponse.json({ error: 'Error interno del servidor al subir archivo' }, { status: 500 });
  }
}
