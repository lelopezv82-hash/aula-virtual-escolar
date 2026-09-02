import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { fromColombiaLocalStringToDate } from '@/lib/dateUtils';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceTaskId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const body = await request.json();
    const { targetCourseId, targetGroupIds, targetPeriod, title, dueDate } = body;

    if (!targetCourseId || !targetGroupIds || !Array.isArray(targetGroupIds) || targetGroupIds.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar la asignatura y al menos un grupo de destino' }, { status: 400 });
    }

    // 1. Verify target course ownership
    const targetCourse = await prisma.course.findFirst({
      where: { id: targetCourseId, teacherId },
      include: { groups: true }
    });
    if (!targetCourse) {
      return NextResponse.json({ error: 'Asignatura de destino no encontrada o no te pertenece' }, { status: 403 });
    }

    // 2. Fetch source task with full details (questions, options, resources)
    const sourceTask = await prisma.task.findUnique({
      where: { id: sourceTaskId },
      include: {
        course: { select: { teacherId: true } },
        questions: {
          include: { options: true },
          orderBy: { order: 'asc' }
        },
        resources: true,
        themes: true
      }
    });

    if (!sourceTask || sourceTask.course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Actividad original no encontrada o no te pertenece' }, { status: 404 });
    }

    const newPeriod = targetPeriod || sourceTask.period || "Periodo 1";
    const newTitle = (title && title.trim()) ? title.trim() : sourceTask.title;

    // Determine clean new due date: use provided dueDate, or default to tomorrow at 23:59
    let newDueDate: Date;
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 1);
    defaultDue.setHours(23, 59, 0, 0);

    if (dueDate) {
      const parsed = typeof dueDate === "string" ? fromColombiaLocalStringToDate(dueDate) : new Date(dueDate);
      newDueDate = parsed || defaultDue;
    } else {
      newDueDate = defaultDue;
    }

    // 3. Find matching themes in target course if any
    const sourceThemeTitles = sourceTask.themes.map(t => t.title);
    const targetThemes = sourceThemeTitles.length > 0
      ? await prisma.theme.findMany({
          where: { courseId: targetCourseId, title: { in: sourceThemeTitles } }
        })
      : [];

    // 3.1 Fetch all students belonging to the target groups for auto-attendance activation
    const targetStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        groupId: { in: targetGroupIds }
      },
      select: { id: true }
    });

    // 4. Create cloned task
    const newTask = await prisma.task.create({
      data: {
        title: newTitle,
        description: sourceTask.description,
        dueDate: newDueDate,
        courseId: targetCourseId,
        theme: sourceTask.theme,
        period: newPeriod,
        attachmentUrl: sourceTask.attachmentUrl,
        gdriveEmail: sourceTask.gdriveEmail,
        weight: sourceTask.weight,
        duration: sourceTask.duration,
        type: sourceTask.type,
        isExternal: sourceTask.isExternal,
        allowLateSubmission: sourceTask.allowLateSubmission,
        lateSubmissionUntil: sourceTask.lateSubmissionUntil,
        active: true,
        groups: {
          connect: targetGroupIds.map(id => ({ id }))
        },
        assignedStudents: {
          connect: targetStudents.map(s => ({ id: s.id }))
        },
        resources: {
          connect: sourceTask.resources.map(r => ({ id: r.id }))
        },
        themes: {
          connect: targetThemes.map(t => ({ id: t.id }))
        },
        // Deep copy questions and options
        questions: {
          create: sourceTask.questions.map(q => ({
            text: q.text,
            type: q.type,
            points: q.points,
            order: q.order,
            options: {
              create: q.options.map(opt => ({
                text: opt.text,
                isCorrect: opt.isCorrect
              }))
            }
          }))
        }
      }
    });

    return NextResponse.json({ success: true, task: newTask });
  } catch (error) {
    console.error("Error duplicating task:", error);
    return NextResponse.json({ error: 'Error interno al duplicar la actividad' }, { status: 500 });
  }
}
