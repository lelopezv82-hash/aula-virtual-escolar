import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { getTaskDeadlineStatus } from '@/lib/dateUtils';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    const { isClosed } = getTaskDeadlineStatus(task, submission);
    if (isClosed) {
      return NextResponse.json({ error: 'El plazo de entrega ha vencido. No puedes iniciar un segundo intento.' }, { status: 400 });
    }

    if (submission.attempt !== 1) {
      return NextResponse.json({ error: 'Ya has realizado un segundo intento' }, { status: 400 });
    }

    if (submission.unlockedAnswers) {
      return NextResponse.json({ error: 'No puedes realizar un segundo intento si ya has visto las respuestas' }, { status: 400 });
    }

    const now = new Date();
    const isLate = now > new Date(task.dueDate);

    // Reset submission state for second attempt
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "PENDING",
        grade: null,
        feedback: null,
        fileUrl: null,
        submittedAt: null,
        startedAt: null,
        attempt: 2,
        answers: {},
        allowLateSubmission: isLate ? true : submission.allowLateSubmission,
        lateSubmissionUntil: null
      }
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error('Error starting second attempt:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
