import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';


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
    const file = formData.get('file') as File;

    if (!taskId || !file) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let fileUrl = "";

    // Find the teacher ID for this task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        course: {
          select: {
            teacherId: true
          }
        }
      }
    });

    const teacherId = task?.course.teacherId;

    if (teacherId) {
      // Try uploading to Google Drive first if teacher has it connected
      const gAccessToken = await getGoogleAccessToken(teacherId);
      if (gAccessToken) {
        try {
          fileUrl = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, "Entregas");
        } catch (driveError) {
          console.error("Google Drive upload error for student submission, falling back to Supabase:", driveError);
        }
      }
    }

    // Fallback to Supabase if not uploaded to Drive
    if (!fileUrl) {
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniqueFilename = `submissions/${studentId}_${taskId}_${Date.now()}_${safeFilename}`;
      
      const { data, error: uploadError } = await supabase.storage
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

    // Upsert submission in database
    const submission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      },
      update: {
        fileUrl,
        status: "SUBMITTED",
        submittedAt: new Date()
      },
      create: {
        taskId,
        studentId,
        fileUrl,
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, submission });

  } catch (error) {
    console.error('Error in submission upload:', error);
    return NextResponse.json({ error: 'Error interno del servidor al subir archivo' }, { status: 500 });
  }
}
