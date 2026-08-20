import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET assigned students for a task and the list of available students in the course
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
        course: {
          include: {
            groups: true
          }
        },
        groups: true,
        assignedStudents: {
          select: {
            id: true,
            name: true,
            username: true,
            groupName: true,
            groupId: true,
            grade: true
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

    // Get all groups related to this course (or task groups)
    const targetGroupIds = task.course.groups.map(g => g.id);

    // Fetch all students belonging to these groups
    const availableStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(targetGroupIds.length > 0 ? { groupId: { in: targetGroupIds } } : {})
      },
      select: {
        id: true,
        name: true,
        username: true,
        groupName: true,
        groupId: true,
        grade: true,
        group: {
          select: {
            id: true,
            name: true,
            grade: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { groupName: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({
      taskId: task.id,
      assignedStudents: task.assignedStudents,
      availableStudents,
      taskGroups: task.groups
    });
  } catch (error) {
    console.error('Error fetching assigned students:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT update the assigned students list
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds)) {
      return NextResponse.json({ error: 'studentIds debe ser un arreglo de IDs' }, { status: 400 });
    }

    const updatedTask = await prisma.task.update({
      where: { id: resolvedParams.id },
      data: {
        assignedStudents: {
          set: studentIds.map((id: string) => ({ id }))
        }
      },
      include: {
        assignedStudents: {
          select: {
            id: true,
            name: true,
            username: true,
            groupName: true,
            groupId: true,
            grade: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      assignedStudents: updatedTask.assignedStudents
    });
  } catch (error) {
    console.error('Error updating assigned students:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
