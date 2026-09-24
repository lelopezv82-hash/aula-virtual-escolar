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
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'Solo los estudiantes pueden enviar calificaciones de actividades' }, { status: 403 });
    }

    const studentId = payload.id as string;
    const body = await request.json();
    const { grade, currentLevel, totalLevels, mistakes, isFinal, activityTitle } = body;

    // Validar y limitar nota entre 1.0 y 5.0
    const rawGrade = typeof grade === 'number' ? grade : parseFloat(grade);
    if (isNaN(rawGrade)) {
      return NextResponse.json({ error: 'Nota inválida' }, { status: 400 });
    }
    const clampedGrade = Math.max(1.0, Math.min(5.0, parseFloat(rawGrade.toFixed(1))));

    // Obtener la tarea y verificar acceso
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        groups: true,
        assignedStudents: {
          select: { id: true }
        }
      }
    });

    if (!task || !task.active) {
      return NextResponse.json({ error: 'Tarea no encontrada o inactiva' }, { status: 404 });
    }

    // Buscar entrega existente
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      }
    });

    // Validar plazos de entrega
    const { isClosed } = getTaskDeadlineStatus(task, existingSubmission);
    if (isClosed && !existingSubmission?.allowLateSubmission && !task.allowLateSubmission) {
      return NextResponse.json({ error: 'El plazo de entrega para esta actividad ha vencido' }, { status: 403 });
    }

    // Regla de Mejor Nota (Best Score): nunca reducir una nota superior previamente obtenida
    const finalGrade = existingSubmission?.grade !== null && existingSubmission?.grade !== undefined
      ? Math.max(existingSubmission.grade, clampedGrade)
      : clampedGrade;

    const feedbackText = isFinal
      ? ((currentLevel || 0) >= (totalLevels || 20)
          ? `Completó todos los ${totalLevels || 20} niveles de ${activityTitle || 'la actividad'} con ${mistakes || 0} error(es).`
          : `Entregó avance: ${currentLevel || 0}/${totalLevels || 20} niveles de ${activityTitle || 'la actividad'} con ${mistakes || 0} error(es).`)
      : `Progreso en curso: Nivel ${currentLevel || 0}/${totalLevels || 20} (Nota actual: ${finalGrade.toFixed(1)})`;

    const answersPayload = {
      currentLevel: currentLevel || 0,
      totalLevels: totalLevels || 20,
      mistakes: mistakes || 0,
      isFinal: !!isFinal,
      activityTitle: activityTitle || 'Actividad Interactiva',
      lastReportedGrade: clampedGrade,
      highestGrade: finalGrade,
      updatedAt: new Date().toISOString()
    };

    let updatedSubmission;
    if (existingSubmission) {
      updatedSubmission = await prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          grade: finalGrade,
          status: "GRADED",
          submittedAt: isFinal ? new Date() : (existingSubmission.submittedAt || new Date()),
          answers: answersPayload,
          feedback: feedbackText
        }
      });
    } else {
      updatedSubmission = await prisma.submission.create({
        data: {
          taskId,
          studentId,
          grade: finalGrade,
          status: "GRADED",
          submittedAt: new Date(),
          answers: answersPayload,
          feedback: feedbackText
        }
      });
    }

    return NextResponse.json({
      success: true,
      grade: finalGrade,
      isFinal: !!isFinal,
      submissionId: updatedSubmission.id,
      message: isFinal
        ? `¡Calificación de ${finalGrade.toFixed(1)} registrada con éxito!`
        : `Progreso guardado (Nota actual: ${finalGrade.toFixed(1)})`
    });

  } catch (error) {
    console.error("Error en API de actividad interactiva:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
