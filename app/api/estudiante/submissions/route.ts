import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';
import { enqueueFailedDriveUpload } from '@/lib/driveQueue';

import { getTaskDeadlineStatus } from '@/lib/dateUtils';
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

    if (!taskId) {
      return NextResponse.json({ error: 'Falta taskId' }, { status: 400 });
    }

    // Collect all files sent (supports single file or multiple/folder files)
    let filesToProcess: Array<{ file: File; relativePath: string }> = [];
    const multiFiles = formData.getAll('files') as File[];
    const multiPaths = formData.getAll('paths') as string[];

    if (multiFiles && multiFiles.length > 0 && multiFiles.some(f => f && f.size > 0)) {
      multiFiles.forEach((f, idx) => {
        if (f && f.size > 0) {
          filesToProcess.push({
            file: f,
            relativePath: multiPaths[idx] || f.name
          });
        }
      });
    } else {
      const singleFile = formData.get('file') as File | null;
      if (singleFile && singleFile.size > 0) {
        filesToProcess.push({
          file: singleFile,
          relativePath: singleFile.name
        });
      }
    }

    let fileUrl = "";
    let gdriveEmail: string | null = null;
    const uploadedFileItems: Array<{
      name: string;
      url: string;
      size: number;
      mimeType: string;
      relativePath: string;
      gdriveEmail?: string | null;
    }> = [];

    // Find the task, include groups, assignedStudents and course details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        groups: true,
        assignedStudents: {
          select: { id: true }
        },
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

    if (task.groups.length > 0 && !task.groups.some(g => g.id === student?.groupId) && !task.assignedStudents.some(s => s.id === studentId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta tarea.' }, { status: 403 });
    }

    // Check if task is restricted to specific activated students
    if (!task.assignedStudents.some((s: any) => s.id === studentId)) {
      return NextResponse.json({ error: 'Esta actividad no fue activada para ti por inasistencia a clase.' }, { status: 403 });
    }

    const isGoogleFormExam = task.type === "EXAM" && !!(task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));

    // Fetch existing submission early so we can reuse it
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      }
    });

    // Check if task has a timer limit
    if (task.duration) {
      if (!existingSubmission || !existingSubmission.startedAt) {
        return NextResponse.json({ error: 'Debe iniciar el examen antes de entregar.' }, { status: 400 });
      }

      const timeLimitInMs = (task.duration * 60 * 1000) + 30000; // 30 seconds grace period
      const timeElapsed = now.getTime() - new Date(existingSubmission.startedAt).getTime();

      if (timeElapsed > timeLimitInMs) {
        if (!isGoogleFormExam) {
          return NextResponse.json({ error: 'El tiempo límite para este examen ha vencido.' }, { status: 400 });
        }
      }
    }

    const { isClosed } = getTaskDeadlineStatus(task, existingSubmission);
    if (isClosed && task.type !== "EXAM") {
      return NextResponse.json({ error: 'El plazo de entrega ha vencido para esta tarea.' }, { status: 400 });
    }

    const teacherId = task.course.teacherId;

    if (filesToProcess.length > 0) {
      const gradeName = student?.group?.grade?.name || "Sin Grado";
      const groupName = student?.group?.name || "Sin Grupo";
      const studentName = student?.name || "Estudiante";
      const taskPeriod = task.period || "Sin Periodo";
      const baseFolderPath = `${taskPeriod}/${task.course.name}/${gradeName}/${groupName}/Tareas/${task.title}/Entregas/${studentName}`;

      let gAccessToken: string | null = null;
      if (teacherId) {
        try {
          gAccessToken = await getGoogleAccessToken(teacherId);
        } catch (err) {
          console.warn("Could not get Google Access Token for teacher:", err);
        }
      }

      for (let i = 0; i < filesToProcess.length; i++) {
        const item = filesToProcess[i];
        const fileObj = item.file;
        const bytes = await fileObj.arrayBuffer();
        const buffer = Buffer.from(bytes);
        let uploadedUrl = "";
        let uploadedEmail: string | null = null;

        const cleanRelPath = item.relativePath.replace(/^\/+/, '');
        const driveFileName = filesToProcess.length > 1
          ? cleanRelPath.split('/').pop() || fileObj.name
          : `${studentName} - ${fileObj.name}`;

        if (teacherId && gAccessToken) {
          try {
            const subfolder = cleanRelPath.includes('/')
              ? `${baseFolderPath}/${cleanRelPath.substring(0, cleanRelPath.lastIndexOf('/'))}`
              : baseFolderPath;

            const uploadResult = await uploadToGoogleDrive(
              buffer,
              driveFileName,
              fileObj.type || 'application/octet-stream',
              teacherId,
              subfolder
            );
            uploadedUrl = uploadResult.url;
            uploadedEmail = uploadResult.email;
          } catch (driveError) {
            console.error(`Google Drive upload error for ${fileObj.name}, falling back to Supabase:`, driveError);
          }
        }

        if (!uploadedUrl) {
          const safeFilename = fileObj.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const uniqueFilename = `submissions/${studentId}_${taskId}_${Date.now()}_${i}_${safeFilename}`;
          
          const { error: uploadError } = await supabase.storage
            .from('aula-virtual')
            .upload(uniqueFilename, fileObj, {
              contentType: fileObj.type || 'application/octet-stream'
            });

          if (uploadError) {
            console.error(`Supabase upload error for ${fileObj.name}:`, uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('aula-virtual')
              .getPublicUrl(uniqueFilename);
            uploadedUrl = publicUrl;
          }
        }

        if (uploadedUrl) {
          uploadedFileItems.push({
            name: fileObj.name,
            url: uploadedUrl,
            size: fileObj.size,
            mimeType: fileObj.type || 'application/octet-stream',
            relativePath: cleanRelPath,
            gdriveEmail: uploadedEmail
          });
        }
      }

      if (uploadedFileItems.length > 0) {
        fileUrl = uploadedFileItems[0].url;
        gdriveEmail = uploadedFileItems[0].gdriveEmail || null;
      }
    } else {
      fileUrl = existingSubmission?.fileUrl || "";
      gdriveEmail = existingSubmission?.gdriveEmail || null;
    }

    // Determine status and grade for saving
    let statusToSave = "SUBMITTED";
    let gradeToSave: number | undefined = undefined;

    if (isGoogleFormExam) {
      statusToSave = "GRADED";
      if (existingSubmission && existingSubmission.status === "GRADED") {
        gradeToSave = existingSubmission.grade !== null && existingSubmission.grade !== undefined 
          ? Math.max(existingSubmission.grade, 1.0) 
          : 1.0;
      } else {
        gradeToSave = 1.0;
      }
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
        fileUrls: uploadedFileItems.length > 0 ? (uploadedFileItems as any) : ((existingSubmission as any)?.fileUrls ? (existingSubmission as any).fileUrls : Prisma.DbNull),
        gdriveEmail,
        status: statusToSave,
        grade: gradeToSave,
        submittedAt: new Date()
      },
      create: {
        taskId,
        studentId,
        fileUrl: fileUrl || null,
        fileUrls: uploadedFileItems.length > 0 ? (uploadedFileItems as any) : Prisma.DbNull,
        gdriveEmail,
        status: statusToSave,
        grade: gradeToSave !== undefined ? gradeToSave : null,
        submittedAt: new Date()
      }
    });

    // If any file was uploaded to Supabase instead of Drive, enqueue for sync retry
    if (uploadedFileItems.length > 0 && teacherId) {
      const gradeName = student?.group?.grade?.name || "Sin Grado";
      const groupName = student?.group?.name || "Sin Grupo";
      const studentName = student?.name || "Estudiante";
      const taskPeriod = task.period || "Sin Periodo";
      const baseFolderPath = `${taskPeriod}/${task.course.name}/${gradeName}/${groupName}/Tareas/${task.title}/Entregas/${studentName}`;

      for (const item of uploadedFileItems) {
        if (!item.gdriveEmail && item.url && item.url.includes('supabase')) {
          const supabasePath = item.url.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
          const driveFileName = filesToProcess.length > 1 ? item.name : `${studentName} - ${item.name}`;

          await enqueueFailedDriveUpload({
            recordType: 'SUBMISSION',
            recordId: submission.id,
            supabaseUrl: item.url,
            supabasePath,
            teacherId: teacherId,
            filename: driveFileName,
            mimeType: item.mimeType,
            folderPath: baseFolderPath,
          });
        }
      }
    }

    return NextResponse.json({ success: true, submission });

  } catch (error) {
    console.error('Error in submission upload:', error);
    return NextResponse.json({ error: 'Error interno del servidor al subir archivo' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Falta taskId' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        submissions: {
          where: { studentId }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const submission = task.submissions[0];
    if (!submission) {
      return NextResponse.json({ error: 'No existe una entrega para eliminar' }, { status: 404 });
    }

    if (submission.status === "GRADED") {
      return NextResponse.json({ error: 'No puedes eliminar una entrega calificada' }, { status: 400 });
    }

    const { isClosed } = getTaskDeadlineStatus(task, submission);
    if (isClosed) {
      return NextResponse.json({ error: 'El plazo de entrega ha vencido, no puedes eliminar la entrega' }, { status: 400 });
    }

    if (task.duration && submission.startedAt) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          fileUrl: null,
          fileUrls: Prisma.DbNull,
          submittedAt: null,
          status: "PENDING"
        }
      });
    } else {
      await prisma.submission.delete({
        where: { id: submission.id }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in submission delete:', error);
    return NextResponse.json({ error: 'Error interno del servidor al eliminar la entrega' }, { status: 500 });
  }
}
