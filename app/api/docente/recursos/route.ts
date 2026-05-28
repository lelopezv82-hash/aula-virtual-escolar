import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET resources for a course
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await jwtVerify(token, JWT_SECRET);

    const where = courseId ? { courseId } : {};
    const resources = await prisma.resource.findMany({ where, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ resources });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST upload resource (supports file or link)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;

    const formData = await request.formData();
    const courseId = formData.get('courseId') as string;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const link = formData.get('link') as string | null;
    const file = formData.get('file') as File | null;
    const theme = formData.get('theme') as string | null;
    const period = formData.get('period') as string | null;

    if (!courseId || !title || !type || !theme || !period) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, tipo, tema y periodo)' }, { status: 400 });
    }

    let url = link || '';

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Try uploading to Google Drive first if teacher has it connected
      const gAccessToken = await getGoogleAccessToken(teacherId);
      if (gAccessToken) {
        try {
          url = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, "Recursos");
        } catch (driveError) {
          console.error("Google Drive upload error, falling back to Supabase:", driveError);
        }
      }

      // Fallback to Supabase if not uploaded to Drive
      if (!url) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `recursos/${Date.now()}_${safeName}`;
        
        const { data, error } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueName, buffer, {
            contentType: file.type,
            duplex: 'half'
          });

        if (error) {
          console.error("Supabase upload error:", error);
          return NextResponse.json({ error: 'Error al subir el archivo a almacenamiento en la nube' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueName);

        url = publicUrl;
      }
    }

    if (!url) return NextResponse.json({ error: 'Debes adjuntar un archivo o un enlace' }, { status: 400 });

    const resource = await prisma.resource.create({
      data: { title, type, url, courseId, theme, period }
    });

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error("Error creating resource:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH update resource
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const link = formData.get('link') as string | null;
    const file = formData.get('file') as File | null;
    const theme = formData.get('theme') as string | null;
    const period = formData.get('period') as string | null;

    if (!id || !title || !type || !theme || !period) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (id, título, tipo, tema y periodo)' }, { status: 400 });
    }

    const existingResource = await prisma.resource.findUnique({
      where: { id }
    });

    if (!existingResource) {
      return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 });
    }

    let url = existingResource.url;

    if (type === "LINK") {
      if (link) {
        url = link;
      }
    } else if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const gAccessToken = await getGoogleAccessToken(teacherId);
      if (gAccessToken) {
        try {
          url = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, "Recursos");
        } catch (driveError) {
          console.error("Google Drive upload error, falling back to Supabase:", driveError);
        }
      }

      if (url === existingResource.url) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `recursos/${Date.now()}_${safeName}`;
        
        const { data, error } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueName, buffer, {
            contentType: file.type,
            duplex: 'half'
          });

        if (error) {
          console.error("Supabase upload error:", error);
          return NextResponse.json({ error: 'Error al subir el archivo a almacenamiento en la nube' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueName);

        url = publicUrl;
      }
    }

    const updatedResource = await prisma.resource.update({
      where: { id },
      data: { title, type, url, theme, period }
    });

    return NextResponse.json({ success: true, resource: updatedResource });
  } catch (error) {
    console.error("Error updating resource:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


// DELETE resource
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await request.json();
    
    // Optional: We can delete the file from Supabase Storage here too if we want, but keeping it simple for the MVP
    await prisma.resource.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
