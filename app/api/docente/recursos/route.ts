import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';
import { enqueueFailedDriveUpload } from '@/lib/driveQueue';


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
    const groupIdsJson = formData.get('groupIds') as string | null;
    const publishAtRaw = formData.get('publishAt') as string | null;
    const publishAt = publishAtRaw && publishAtRaw.trim() !== "" ? new Date(publishAtRaw) : null;

    let groupIds: string[] = [];
    if (groupIdsJson) {
      try {
        groupIds = JSON.parse(groupIdsJson);
      } catch {
        groupIds = [groupIdsJson];
      }
    }

    if (!courseId || !title || !type || !theme || !period || !groupIds || groupIds.length === 0) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (título, tipo, tema, periodo y al menos un grupo)' }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId }
    });

    if (!course) {
      return NextResponse.json({ error: 'Curso no encontrado o no te pertenece' }, { status: 403 });
    }

    let url = link || '';
    let gdriveEmail: string | null = null;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      let driveErrorMessage = "No Drive account";
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
          const folderPath = `${period}/${course.name}/${gradeName}/${groupName}/Materiales`;
          const uploadResult = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, folderPath);
          url = uploadResult.url;
          gdriveEmail = uploadResult.email;
        } catch (driveError: any) {
          console.error("Google Drive upload error, falling back to Supabase:", driveError);
          driveErrorMessage = driveError.message || String(driveError);
        }
      }

      // Fallback to Supabase if not uploaded to Drive
      if (!url) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `recursos/${Date.now()}_${safeName}`;
        
        const { error } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueName, file, {
            contentType: file.type
          });

        if (error) {
          console.error("Supabase upload error:", error);
          return NextResponse.json({ error: `[GDRIVE]: ${driveErrorMessage} | [SUPABASE]: ${error.message || JSON.stringify(error)}` }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueName);

        url = publicUrl;
        // Guardar en cola para reintento a Drive cuando haya conexión
        // (el resourceId aún no existe; se actualizará después del create)
        // Se encola después del create — ver más abajo
      }
    }

    if (!url) return NextResponse.json({ error: 'Debes adjuntar un archivo o un enlace' }, { status: 400 });

    const resource = await prisma.resource.create({
      data: { 
        title, 
        type, 
        url, 
        gdriveEmail,
        courseId, 
        theme: legacyThemeString, 
        period,
        publishAt,
        groups: {
          connect: groupIds.map(id => ({ id }))
        },
        themes: {
          connect: (await prisma.theme.findMany({
            where: {
              courseId,
              title: { in: themeTitles }
            }
          })).map(t => ({ id: t.id }))
        }
      }
    });

    // Si el archivo quedó en Supabase (gdrive falló), encolar para reintento
    if (file && file.size > 0 && !gdriveEmail && url && url.includes('supabase')) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      // Extraer el path relativo de la URL pública
      const supabasePath = url.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
      const selectedGroups = await prisma.gradeGroup.findMany({
        where: { id: { in: groupIds } },
        include: { grade: true }
      });
      const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
      const groupName = selectedGroups[0]?.name || "Sin Grupo";
      const folderPath = `${period}/${(await prisma.course.findUnique({ where: { id: courseId } }))?.name || ''}/${gradeName}/${groupName}/Materiales`;
      await enqueueFailedDriveUpload({
        recordType: 'RESOURCE',
        recordId: resource.id,
        supabaseUrl: url,
        supabasePath,
        teacherId,
        filename: file.name,
        mimeType: file.type,
        folderPath,
      });
    }

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

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const { id, active } = await request.json();
      if (!id) return NextResponse.json({ error: 'Falta el id del recurso' }, { status: 400 });
      const updated = await prisma.resource.update({
        where: { id },
        data: { active }
      });
      return NextResponse.json({ success: true, resource: updated });
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const link = formData.get('link') as string | null;
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
    const groupIdsJson = formData.get('groupIds') as string | null;
    const publishAtRaw = formData.get('publishAt') as string | null;
    const publishAt = publishAtRaw && publishAtRaw.trim() !== "" ? new Date(publishAtRaw) : null;

    let groupIds: string[] = [];
    if (groupIdsJson) {
      try {
        groupIds = JSON.parse(groupIdsJson);
      } catch {
        groupIds = [groupIdsJson];
      }
    }

    if (!id || !title || !type || !theme || !period || !groupIds || groupIds.length === 0) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (id, título, tipo, tema, periodo y al menos un grupo)' }, { status: 400 });
    }

    const existingResource = await prisma.resource.findUnique({
      where: { id },
      include: { course: true }
    });

    if (!existingResource) {
      return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 });
    }

    let url = existingResource.url;
    let gdriveEmail: string | null = existingResource.gdriveEmail;

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
          const selectedGroups = await prisma.gradeGroup.findMany({
            where: { id: { in: groupIds } },
            include: { grade: true }
          });
          const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
          const groupName = selectedGroups[0]?.name || "Sin Grupo";
          const folderPath = `${period}/${existingResource.course.name}/${gradeName}/${groupName}/Materiales`;
          const uploadResult = await uploadToGoogleDrive(buffer, file.name, file.type, teacherId, folderPath);
          url = uploadResult.url;
          gdriveEmail = uploadResult.email;
        } catch (driveError) {
          console.error("Google Drive upload error, falling back to Supabase:", driveError);
        }
      }

      if (url === existingResource.url) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `recursos/${Date.now()}_${safeName}`;
        
        const { error } = await supabase.storage
          .from('aula-virtual')
          .upload(uniqueName, file, {
            contentType: file.type
          });

        if (error) {
          console.error("Supabase upload error:", error);
          return NextResponse.json({ error: 'Error al subir el archivo a almacenamiento en la nube' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
          .from('aula-virtual')
          .getPublicUrl(uniqueName);

        url = publicUrl;

        // Encolar para reintento a Drive cuando haya conexión
        const supabasePath = publicUrl.split('/aula-virtual/')[1]?.split('?')[0] ?? '';
        const selectedGroups = await prisma.gradeGroup.findMany({
          where: { id: { in: groupIds } },
          include: { grade: true }
        });
        const gradeName = selectedGroups[0]?.grade?.name || "Sin Grado";
        const groupName = selectedGroups[0]?.name || "Sin Grupo";
        const folderPath = `${period}/${existingResource.course.name}/${gradeName}/${groupName}/Materiales`;
        await enqueueFailedDriveUpload({
          recordType: 'RESOURCE',
          recordId: id,
          supabaseUrl: publicUrl,
          supabasePath,
          teacherId,
          filename: file.name,
          mimeType: file.type,
          folderPath,
        });
      }
    }

    const updatedResource = await prisma.resource.update({
      where: { id },
      data: { 
        title, 
        type, 
        url, 
        gdriveEmail,
        theme: legacyThemeString, 
        period,
        publishAt,
        groups: {
          set: groupIds.map(id => ({ id }))
        },
        themes: {
          set: (await prisma.theme.findMany({
            where: {
              courseId: existingResource.courseId,
              title: { in: themeTitles }
            }
          })).map(t => ({ id: t.id }))
        }
      }
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
