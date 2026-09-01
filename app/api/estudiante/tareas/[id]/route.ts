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
    if (payload.role !== "STUDENT" && payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const isTeacher = payload.role === "TEACHER";
    const studentId = isTeacher ? null : payload.id as string;
    
    let student = null;
    if (studentId) {
      student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { groupId: true, name: true }
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: {
        groups: true,
        assignedStudents: {
          select: { id: true }
        },
        resources: true,
        course: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                profilePic: true
              }
            }
          }
        },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              orderBy: { id: 'asc' }
            }
          }
        },
        submissions: studentId ? {
          where: { studentId }
        } : { take: 1 } // For teacher, just get one submission to extract feedbackTemplate if needed
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

    let isNotActivatedForStudent = false;

    if (!isTeacher) {
      const hasGroupAccess = task.groups.length === 0 || (student?.groupId ? task.groups.some(g => g.id === student.groupId) : false);
      const hasDirectAccess = task.assignedStudents?.some(s => s.id === studentId);
      if (!hasGroupAccess && !hasDirectAccess) {
        return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
      }

      // Check selective activation (if task has specific assigned students and student is not among them)
      if (task.assignedStudents && task.assignedStudents.length > 0 && !hasDirectAccess) {
        isNotActivatedForStudent = true;
      }
    }

    // Fetch feedbackTemplate if the student has finished and unlocked answers
    let feedbackTemplate = null;
    let submission = task.submissions[0] || null;

    // If student was not activated due to inattendance, ensure submission appears closed with grade 1.0
    if (isNotActivatedForStudent) {
      if (!submission) {
        submission = {
          id: `unassigned-${task.id}`,
          taskId: task.id,
          studentId: studentId!,
          status: "GRADED",
          grade: 1.0,
          feedback: "No asistió a la clase (Actividad no habilitada)",
          fileUrl: null,
          submittedAt: null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          allowLateSubmission: false,
          lateSubmissionUntil: null,
          startedAt: null,
          attempt: 1,
          unlockedAnswers: false,
          answers: null,
        } as any;
      } else if (submission.grade === null) {
        submission.grade = 1.0;
        submission.status = "GRADED";
        if (!submission.feedback) {
          submission.feedback = "No asistió a la clase (Actividad no habilitada)";
        }
      }
    }
    const isGoogleForm = !!(task.attachmentUrl && (task.attachmentUrl.includes("docs.google.com/forms") || task.attachmentUrl.includes("forms.gle")));
    
    const isNative = task.questions && task.questions.length > 0;
    const canSeeAnswers = isTeacher || (submission && submission.status !== "PENDING" && (isNative || submission.attempt > 1 || submission.unlockedAnswers === true));

    // Sanitize correct options if student cannot see answers yet
    if (task.questions && task.questions.length > 0 && !canSeeAnswers) {
      (task as any).questions = task.questions.map((q: any) => ({
        ...q,
        options: q.options.map((o: any) => {
          const { isCorrect, ...rest } = o;
          return rest;
        })
      }));
    }

    // For Google Forms: always show template/answers once the exam is GRADED
    const googleFormGraded = isGoogleForm && submission && submission.status === "GRADED";
    if (googleFormGraded || (isGoogleForm && canSeeAnswers)) {
      const templateSub = await prisma.submission.findFirst({
        where: {
          taskId: task.id,
          feedback: { not: null }
        },
        select: { feedback: true }
      });
      feedbackTemplate = templateSub?.feedback || null;
    }

    // Strip feedback from submission if locked (but keep it if already graded)
    if (submission && !canSeeAnswers && submission.status !== "GRADED") {
      submission.feedback = null;
    }

    // Remove groups from response to keep payload clean if needed, or keep it
    const { groups: _groups, ...taskData } = task;

    if (submission) {
      taskData.submissions = [submission];
    }

    return NextResponse.json({ 
      task: taskData, 
      studentName: student?.name || "Estudiante",
      feedbackTemplate,
      canSeeAnswers,
      isNotActivated: isNotActivatedForStudent
    });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
