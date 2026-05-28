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

    if (!title || !dueDate || !courseId || !theme || !period) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, fecha límite, curso, tema y periodo)' }, { status: 400 });
    }

    // Verify course belongs to teacher
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId }
    });

    if (!course) {
      return NextResponse.json({ error: 'Curso no encontrado o no te pertenece' }, { status: 403 });
    }

    let attachmentUrl = null;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Try uploading to Google Drive first if teacher has it connected
      const gAccessToken = await getGoogleAccessToken(teacherId);
      if (gAccessToken) {
        try {
          attachmentUrl = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, "Tareas");
        } catch (driveError) {
          console.error("Google Drive task upload error, falling back to Supabase:", driveError);
        }
      }

      // Fallback to Supabase if not uploaded to Drive
      if (!attachmentUrl) {
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueFilename = `tareas/${courseId}_${Date.now()}_${safeFilename}`;

        const { data, error: uploadError } = await supabase.storage
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
        courseId,
        theme,
        period,
        weight: isNaN(weight) ? 0 : weight
      }
    });

    return NextResponse.json({ success: true, task });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
