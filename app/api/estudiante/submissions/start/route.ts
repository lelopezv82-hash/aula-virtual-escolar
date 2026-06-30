import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;
    const body = await request.json();
    const taskId = body.taskId;

    if (!taskId) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Comprobar si el examen tiene timeLimit
    if (!task.timeLimit) {
      return NextResponse.json({ error: 'Este examen no tiene límite de tiempo' }, { status: 400 });
    }

    // Crear o actualizar la entrega con startedAt
    const submission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      },
      update: {
        // Solo actualizamos startedAt si no estaba ya seteado
        startedAt: undefined // This means we don't update it if it exists. Wait, Prisma doesn't have an easy "set if null". We'll do a check first.
      },
      create: {
        taskId,
        studentId,
        status: "PENDING",
        startedAt: new Date()
      }
    });

    // Si ya existía, verificamos si startedAt está vacío
    if (!submission.startedAt) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { startedAt: new Date() }
      });
      submission.startedAt = new Date();
    }

    return NextResponse.json({ success: true, startedAt: submission.startedAt });

  } catch (error) {
    console.error('Error starting exam:', error);
    return NextResponse.json({ error: 'Error interno del servidor al iniciar examen' }, { status: 500 });
  }
}
