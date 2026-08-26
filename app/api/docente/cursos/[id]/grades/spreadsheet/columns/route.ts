import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;

    // Verify course ownership
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId },
      include: { groups: true }
    });

    if (!course) return NextResponse.json({ error: 'Curso no encontrado o no te pertenece' }, { status: 403 });

    const body = await request.json();
    const {
      title,
      type,
      period,
      description,
      dueDate,
      isExternal,
      duration,
      weight,
      groupIds,
      studentIds,
      theme,
      publishAt,
      allowLateSubmission
    } = body;

    if (!title || !type || !period) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios: title, type, period' }, { status: 400 });
    }

    if (course.groups.length === 0) {
      return NextResponse.json({ error: 'El curso no tiene grupos asignados.' }, { status: 400 });
    }

    // Parse dates
    let parsedDueDate = new Date();
    if (dueDate) {
      parsedDueDate = new Date(dueDate);
    } else {
      parsedDueDate.setHours(23, 59, 59, 999);
    }

    let parsedPublishAt = null;
    if (publishAt) {
      parsedPublishAt = new Date(publishAt);
    }

    // Determine group connections
    let targetGroups = course.groups.map(g => ({ id: g.id }));
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      targetGroups = groupIds.map(id => ({ id }));
    }

    const task = await prisma.task.create({
      data: {
        title,
        type,
        period,
        courseId,
        theme: theme || null,
        description: description || null,
        dueDate: parsedDueDate,
        publishAt: parsedPublishAt,
        isExternal: isExternal !== undefined ? Boolean(isExternal) : true,
        allowLateSubmission: allowLateSubmission !== undefined ? Boolean(allowLateSubmission) : false,
        active: true,
        weight: weight ? parseInt(weight) || 0 : 0,
        duration: duration ? parseInt(duration) || null : null,
        groups: {
          connect: targetGroups
        },
        assignedStudents: studentIds && Array.isArray(studentIds) && studentIds.length > 0
          ? { connect: studentIds.map((id: string) => ({ id })) }
          : undefined
      }
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error("Error creating dynamic column:", error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;

    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) return NextResponse.json({ error: 'Falta taskId' }, { status: 400 });

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        course: { id: courseId, teacherId }
      }
    });

    if (!task) return NextResponse.json({ error: 'Tarea no encontrada o acceso denegado' }, { status: 403 });

    await prisma.task.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting dynamic column:", error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
