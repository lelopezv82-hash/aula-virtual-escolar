import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { course: true }
    });

    if (!task || task.course.teacherId !== (payload.id as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId: resolvedParams.id,
          studentId: resolvedParams.studentId,
        },
      },
      include: { student: true },
    });

    return NextResponse.json({ task, submission });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { course: true }
    });

    if (!task || task.course.teacherId !== (payload.id as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const now = new Date();
    const isLate = now > new Date(task.dueDate);

    // Update the submission record to reset state instead of deleting it
    await prisma.submission.update({
      where: {
        taskId_studentId: {
          taskId: resolvedParams.id,
          studentId: resolvedParams.studentId,
        }
      },
      data: {
        status: "PENDING",
        grade: null,
        feedback: null,
        fileUrl: null,
        submittedAt: null,
        startedAt: null,
        allowLateSubmission: isLate ? true : false,
        lateSubmissionUntil: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting submission:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
