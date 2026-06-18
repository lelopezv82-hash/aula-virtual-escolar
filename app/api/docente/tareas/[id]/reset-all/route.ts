import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

/**
 * POST /api/docente/tareas/[id]/reset-all
 * Body (JSON, optional): { groupId: string }
 *   - If groupId is provided, only students in that group are reset.
 *   - If omitted, ALL students assigned to the task are reset.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Verify the task belongs to this teacher
    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: {
        course: true,
        groups: true,
      }
    });

    if (!task || task.course.teacherId !== (payload.id as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Parse optional groupId from body
    let groupId: string | undefined;
    try {
      const body = await request.json();
      groupId = body?.groupId;
    } catch {
      // no body or invalid JSON → reset all groups
    }

    // Determine which students to reset
    const studentWhereClause: any = { role: "STUDENT" };
    if (groupId) {
      // Only reset students from the specified group
      const groupBelongsToTask = task.groups.some(g => g.id === groupId);
      if (!groupBelongsToTask) {
        return NextResponse.json({ error: 'El grupo no pertenece a este examen' }, { status: 400 });
      }
      studentWhereClause.groupId = groupId;
    } else if (task.groups && task.groups.length > 0) {
      studentWhereClause.groupId = { in: task.groups.map(g => g.id) };
    }

    const students = await prisma.user.findMany({
      where: studentWhereClause,
      select: { id: true }
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No hay estudiantes en este grupo/tarea' }, { status: 404 });
    }

    const now = new Date();
    const isLate = now > new Date(task.dueDate);

    // Upsert every student: reset their submission to clean PENDING state
    const operations = students.map(student =>
      prisma.submission.upsert({
        where: {
          taskId_studentId: {
            taskId: resolvedParams.id,
            studentId: student.id,
          }
        },
        update: {
          status: "PENDING",
          grade: null,
          fileUrl: null,
          submittedAt: null,
          startedAt: null,
          attempt: 1,
          unlockedAnswers: false,
          answers: {},
          allowLateSubmission: isLate ? true : false,
          lateSubmissionUntil: null,
        },
        create: {
          taskId: resolvedParams.id,
          studentId: student.id,
          status: "PENDING",
          grade: null,
          fileUrl: null,
          submittedAt: null,
          startedAt: null,
          attempt: 1,
          unlockedAnswers: false,
          answers: {},
          allowLateSubmission: isLate ? true : false,
          lateSubmissionUntil: null,
        }
      })
    );

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, resetCount: students.length });
  } catch (error) {
    console.error("Error resetting all submissions:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
