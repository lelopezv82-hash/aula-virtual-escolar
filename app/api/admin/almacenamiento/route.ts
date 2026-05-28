import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

function getStoragePathFromUrl(url: string): string | null {
  if (!url) return null;
  const parts = url.split('/public/aula-virtual/');
  if (parts.length > 1) {
    return parts[1];
  }
  return null;
}

// GET storage statistics
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Count submissions with files
    const submissionsCount = await prisma.submission.count({
      where: {
        fileUrl: { not: null }
      }
    });

    // Count teacher resources that are files (not external links)
    const resourcesCount = await prisma.resource.count({
      where: {
        type: { not: "LINK" }
      }
    });

    return NextResponse.json({
      submissionsCount,
      resourcesCount,
      totalFilesCount: submissionsCount + resourcesCount
    });
  } catch (error) {
    console.error("Error fetching storage stats:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST clear storage
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { action } = await request.json();

    if (action === "clearSubmissions") {
      // Find all submissions with files
      const submissions = await prisma.submission.findMany({
        where: { fileUrl: { not: null } },
        select: { fileUrl: true }
      });

      // Extract storage paths and delete files from Supabase
      const pathsToDelete = submissions
        .map(s => getStoragePathFromUrl(s.fileUrl || ''))
        .filter(Boolean) as string[];

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('aula-virtual')
          .remove(pathsToDelete);
        if (storageError) {
          console.error("Error deleting submissions from Supabase storage:", storageError);
        }
      }

      // Update submissions to clear fileUrl
      await prisma.submission.updateMany({
        where: { fileUrl: { not: null } },
        data: {
          fileUrl: null,
          status: "PENDING"
        }
      });

      return NextResponse.json({ success: true, message: `Se limpiaron ${submissions.length} entregas de estudiantes.` });
    }

    if (action === "clearResources") {
      // Find all resource records that are files
      const resources = await prisma.resource.findMany({
        where: { type: { not: "LINK" } },
        select: { id: true, url: true }
      });

      // Extract storage paths and delete files from Supabase
      const pathsToDelete = resources
        .map(r => getStoragePathFromUrl(r.url))
        .filter(Boolean) as string[];

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('aula-virtual')
          .remove(pathsToDelete);
        if (storageError) {
          console.error("Error deleting resources from Supabase storage:", storageError);
        }
      }

      // Delete resources from database
      const idsToDelete = resources.map(r => r.id);
      await prisma.resource.deleteMany({
        where: { id: { in: idsToDelete } }
      });

      return NextResponse.json({ success: true, message: `Se eliminaron ${resources.length} recursos de docentes.` });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error("Error cleaning storage:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
