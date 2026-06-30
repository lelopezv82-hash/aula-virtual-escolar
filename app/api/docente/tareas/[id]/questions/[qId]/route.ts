import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

async function verifyTeacherAndTask(taskId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) throw new Error('401');

  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.role !== "TEACHER") {
    throw new Error('401');
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { course: true }
  });

  if (!task) {
    throw new Error('404');
  }

  if (task.course.teacherId !== payload.id) {
    throw new Error('403');
  }

  return { payload, task };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string, qId: string }> }) {
  try {
    const resolvedParams = await params;
    const { id: taskId, qId } = resolvedParams;
    await verifyTeacherAndTask(taskId);

    const body = await request.json();
    const { text, type, points, order, options } = body;

    if (!text || !type) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Use a transaction to safely update the question and replace options
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      // Delete existing options
      await tx.option.deleteMany({
        where: { questionId: qId }
      });

      // Update question and create new options
      return await tx.question.update({
        where: { id: qId },
        data: {
          text,
          type,
          points: points !== undefined ? parseFloat(points) : 1.0,
          order: order !== undefined ? parseInt(order, 10) : 0,
          options: {
            create: options ? options.map((opt: any) => ({
              text: opt.text,
              isCorrect: !!opt.isCorrect
            })) : []
          }
        },
        include: {
          options: true
        }
      });
    });

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (err: any) {
    if (err.message === '401') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (err.message === '403') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (err.message === '404') return NextResponse.json({ error: 'Pregunta o Tarea no encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, qId: string }> }) {
  try {
    const resolvedParams = await params;
    const { id: taskId, qId } = resolvedParams;
    await verifyTeacherAndTask(taskId);

    await prisma.question.delete({
      where: { id: qId }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === '401') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (err.message === '403') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (err.message === '404') return NextResponse.json({ error: 'Pregunta o Tarea no encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
