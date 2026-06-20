import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

async function getStudentAndTask(taskId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) throw new Error('401');

  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.role !== "STUDENT") {
    throw new Error('401');
  }

  const studentId = payload.id as string;
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { groups: true }
  });

  if (!task || !task.active) {
    throw new Error('404');
  }

  if (task.groups.length > 0 && !task.groups.some(g => g.id === student?.groupId)) {
    throw new Error('403');
  }

  return { studentId, task };
}

// PUT: Save/update partial answers in real time
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { studentId, task } = await getStudentAndTask(resolvedParams.id);

    const body = await request.json();
    const { answers } = body;

    if (answers === undefined) {
      return NextResponse.json({ error: 'Falta el campo answers' }, { status: 400 });
    }

    const submission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId: task.id,
          studentId
        }
      },
      update: {
        answers: answers || {}
      },
      create: {
        taskId: task.id,
        studentId,
        status: "PENDING",
        startedAt: new Date(),
        answers: answers || {}
      }
    });

    return NextResponse.json({ success: true, submission });
  } catch (err: any) {
    if (err.message === '401') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (err.message === '403') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (err.message === '404') return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    console.error('Error saving answers:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST: Submit the exam and calculate grade automatically
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { studentId, task } = await getStudentAndTask(resolvedParams.id);

    // Get answers from either body or from the database
    let answers: Record<string, any> = {};
    try {
      const body = await request.json();
      answers = body.answers || {};
    } catch {
      // Body might be empty, we will read saved answers from DB instead
    }

    const submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId: task.id,
          studentId
        }
      }
    });

    const finalAnswers = {
      ...(submission && typeof submission.answers === 'object' ? (submission.answers as Record<string, any>) : {}),
      ...answers
    };

    // Retrieve questions and options to perform grading
    const questions = await prisma.question.findMany({
      where: { taskId: task.id },
      include: { options: true }
    });

    let totalPoints = 0;
    let earnedPoints = 0;
    const details: any[] = [];

    for (const q of questions) {
      totalPoints += q.points;
      const studentAns = finalAnswers[q.id];
      let isCorrect = false;

      if (q.type === 'MULTIPLE_CHOICE') {
        const correctOpt = q.options.find(o => o.isCorrect);
        // studentAns is the selected option ID
        if (correctOpt && studentAns === correctOpt.id) {
          isCorrect = true;
          earnedPoints += q.points;
        }
        details.push({
          questionId: q.id,
          questionText: q.text,
          studentAnswer: studentAns,
          correctOptionId: correctOpt?.id,
          correctOptionText: correctOpt?.text || '',
          isCorrect,
          points: isCorrect ? q.points : 0,
          maxPoints: q.points
        });
      } else {
        // TEXT question
        const correctOpt = q.options.find(o => o.isCorrect);
        const correctText = correctOpt?.text || '';
        if (correctText && typeof studentAns === 'string' && studentAns.trim().toLowerCase() === correctText.trim().toLowerCase()) {
          isCorrect = true;
          earnedPoints += q.points;
        }
        details.push({
          questionId: q.id,
          questionText: q.text,
          studentAnswer: studentAns,
          correctText,
          isCorrect,
          points: isCorrect ? q.points : 0,
          maxPoints: q.points
        });
      }
    }

    // Grade: scale 0.0 to 5.0. If no questions exist, default to 5.0
    const rawGrade = totalPoints > 0 ? (earnedPoints / totalPoints) * 5.0 : 5.0;
    const finalGrade = parseFloat(rawGrade.toFixed(1));

    const updatedSubmission = await prisma.submission.upsert({
      where: {
        taskId_studentId: {
          taskId: task.id,
          studentId
        }
      },
      update: {
        answers: finalAnswers,
        grade: finalGrade,
        status: "GRADED",
        submittedAt: new Date(),
        feedback: JSON.stringify(details)
      },
      create: {
        taskId: task.id,
        studentId,
        answers: finalAnswers,
        grade: finalGrade,
        status: "GRADED",
        submittedAt: new Date(),
        startedAt: new Date(),
        feedback: JSON.stringify(details)
      }
    });

    return NextResponse.json({ success: true, submission: updatedSubmission });
  } catch (err: any) {
    if (err.message === '401') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (err.message === '403') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (err.message === '404') return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    console.error('Error submitting answers:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
