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

    // Check if task exists and student has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { groups: true }
    });

    if (!task || !task.active) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { groupId: true }
    });

    if (task.groups.length > 0 && !task.groups.some(g => g.id === student?.groupId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta tarea.' }, { status: 403 });
    }

    // Check if submission already exists
    let submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      }
    });

    const { isClosed } = getTaskDeadlineStatus(task, submission);
    if (isClosed) {
      return NextResponse.json({ error: 'El plazo de entrega de este examen ha vencido.' }, { status: 400 });
    }

    if (!submission) {
      // Create a pending submission with startedAt = now
      submission = await prisma.submission.create({
        data: {
          taskId,
          studentId,
          status: "PENDING",
          startedAt: new Date()
        }
      });
    } else if (!submission.startedAt) {
      // If it exists but has no startedAt, update it
      submission = await prisma.submission.update({
        where: { id: submission.id },
        data: {
          startedAt: new Date()
        }
      });
    }

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('Error starting exam:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
