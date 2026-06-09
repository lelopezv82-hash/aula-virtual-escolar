import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const resolvedParams = await params;
    const { taskId } = resolvedParams;
    const body = await request.json();

    const { studentName, score, rawData } = body;

    if (!studentName) {
      return NextResponse.json({ error: 'Falta el nombre del estudiante' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        groups: {
          include: {
            students: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Find the student by name in the groups assigned to this task
    // Since names might have slight variations, we try to find the best match or exact match (case insensitive)
    let matchedStudent = null;
    const studentsInGroups = task.groups.flatMap(g => g.students);
    
    // 1. Try exact match (case insensitive)
    matchedStudent = studentsInGroups.find(s => s.name.toLowerCase() === studentName.toLowerCase());

    // 2. Try partial match (if studentName contains the full name or vice versa)
    if (!matchedStudent) {
      matchedStudent = studentsInGroups.find(s => 
        studentName.toLowerCase().includes(s.name.toLowerCase()) || 
        s.name.toLowerCase().includes(studentName.toLowerCase())
      );
    }

    if (!matchedStudent) {
      return NextResponse.json({ error: 'Estudiante no encontrado en los grupos de esta tarea', studentName }, { status: 404 });
    }

    // Process score: if it's a number, save it as grade.
    let gradeToSave = null;
    if (score !== undefined && score !== null) {
      gradeToSave = parseFloat(score);
      if (isNaN(gradeToSave)) gradeToSave = null;
    }

    // Create or update submission
    const submission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId: task.id,
          studentId: matchedStudent.id
        }
      },
      update: {
        status: gradeToSave !== null ? "GRADED" : "SUBMITTED",
        grade: gradeToSave,
        feedback: gradeToSave !== null ? `Calificado automáticamente por Google Forms. Puntaje: ${score}` : 'Enviado por Google Forms',
        submittedAt: new Date()
      },
      create: {
        taskId: task.id,
        studentId: matchedStudent.id,
        status: gradeToSave !== null ? "GRADED" : "SUBMITTED",
        grade: gradeToSave,
        feedback: gradeToSave !== null ? `Calificado automáticamente por Google Forms. Puntaje: ${score}` : 'Enviado por Google Forms',
        submittedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, submissionId: submission.id });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Error interno del servidor al procesar el webhook' }, { status: 500 });
  }
}
