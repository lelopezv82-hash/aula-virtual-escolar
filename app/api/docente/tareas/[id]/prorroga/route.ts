import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { fromColombiaLocalStringToDate } from '@/lib/dateUtils';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { course: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { studentIds, allowLateSubmission, lateSubmissionUntil } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar al menos un estudiante' }, { status: 400 });
    }

    const parsedDate = (allowLateSubmission && lateSubmissionUntil)
      ? fromColombiaLocalStringToDate(lateSubmissionUntil)
      : null;

    const isAllowLate = Boolean(allowLateSubmission);

    // Apply updates to all selected students inside a single atomic transaction
    await prisma.$transaction(
      studentIds.map((studentId: string) => {
        return prisma.submission.upsert({
          where: {
            taskId_studentId: {
              taskId,
              studentId,
            }
          },
          update: {
            allowLateSubmission: isAllowLate,
            lateSubmissionUntil: isAllowLate ? parsedDate : null,
          },
          create: {
            taskId,
            studentId,
            status: "PENDING",
            allowLateSubmission: isAllowLate,
            lateSubmissionUntil: isAllowLate ? parsedDate : null,
          }
        });
      })
    );

    return NextResponse.json({ 
      success: true, 
      count: studentIds.length,
      allowLateSubmission: isAllowLate,
      lateSubmissionUntil: parsedDate ? parsedDate.toISOString() : null
    });
  } catch (error) {
    console.error('Error applying bulk late submission extension:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
