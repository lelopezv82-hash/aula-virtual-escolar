import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { PrismaClient } from '@prisma/client';
import { supabase } from '@/lib/supabase';

const prisma = new PrismaClient();
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

    const formData = await request.formData();
    const courseId = formData.get('courseId') as string;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const link = formData.get('link') as string | null;
    const file = formData.get('file') as File | null;

    if (!courseId || !title || !type) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    let url = link || '';

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
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

    if (!url) return NextResponse.json({ error: 'Debes adjuntar un archivo o un enlace' }, { status: 400 });

    const resource = await prisma.resource.create({
      data: { title, type, url, courseId }
    });

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error("Error creating resource:", error);
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
