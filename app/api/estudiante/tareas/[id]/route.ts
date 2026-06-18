import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { groupId: true, name: true }
    });

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: {
        groups: true,
        submissions: {
          where: { studentId }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Security & Scheduling checks
    if (task.active === false) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const now = new Date();
    if (task.publishAt && new Date(task.publishAt) > now) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (task.period) {
      const period = await prisma.period.findUnique({
        where: { name: task.period }
      });
      if (period && !period.active) {
        return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
      }
    }

    if (task.groups.length > 0 && !task.groups.some(g => g.id === student?.groupId)) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Fetch feedbackTemplate if the student has finished and unlocked answers
    let feedbackTemplate = null;
    const submission = task.submissions[0];
    const isGoogleForm = !!(task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));
    
    const canSeeAnswers = submission && submission.status !== "PENDING" && (submission.attempt > 1 || submission.unlockedAnswers === true);

    if (isGoogleForm && canSeeAnswers) {
      const templateSub = await prisma.submission.findFirst({
        where: {
          taskId: task.id,
          feedback: { not: null }
        },
        select: { feedback: true }
      });
      feedbackTemplate = templateSub?.feedback || null;
    }

    // Strip feedback from submission if locked
    if (submission && !canSeeAnswers) {
      submission.feedback = null;
    }

    // Remove groups from response to keep payload clean if needed, or keep it
    const { groups: _groups, ...taskData } = task;

    return NextResponse.json({ 
      task: taskData, 
      studentName: student?.name || "Estudiante",
      feedbackTemplate
    });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
