import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

/**
 * GET /api/docente/cursos/[id]/grades/spreadsheet?period=…&groupId=…
 *
 * Returns students + tasks for the given course/period.
 * If groupId is provided, filters students to that group only.
 * groupId="all" or omitted → all students across all groups.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const { searchParams } = new URL(request.url);
    const period  = searchParams.get("period");
    const groupId = searchParams.get("groupId") || "all";

    if (!period) {
      return NextResponse.json({ error: 'Falta el período' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        groups: {
          include: {
            students: {
              where: { role: 'STUDENT' },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
            grade: { select: { name: true } },
          }
        }
      }
    });

    if (!course || course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Build groups list for the selector UI
    const groupsList = course.groups.map(g => ({
      id: g.id,
      name: g.grade?.name ? `${g.grade.name} - ${g.name}` : g.name,
    }));

    // Collect students, filtered by groupId
    const studentMap = new Map<string, { id: string; name: string; groupName: string; groupId: string }>();
    for (const group of course.groups) {
      if (groupId !== "all" && group.id !== groupId) continue;
      for (const student of group.students) {
        if (!studentMap.has(student.id)) {
          const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel, groupId: group.id });
        }
      }
    }
    const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const studentIds = students.map(s => s.id);

    // Fetch all tasks for this course+period
    let tasks = await prisma.task.findMany({
      where: { courseId, active: true, period },
      select: {
        id: true, title: true, type: true, dueDate: true, duration: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, status: true, grade: true, id: true },
        },
      },
      orderBy: { createdAt: 'asc' }
    });

    // Auto-create default SER tasks if none exist for this period
    if (!tasks.some(t => t.type === "SER") && course.groups.length > 0) {
      const groupConnect = course.groups.map(g => ({ id: g.id }));
      for (const title of ["Autoevaluación", "Coevaluación", "Heteroevaluación"]) {
        const newTask = await prisma.task.create({
          data: {
            title, type: "SER", period, courseId,
            dueDate: new Date(), isExternal: true, active: true, weight: 0,
            groups: { connect: groupConnect }
          }
        });
        tasks.push({ id: newTask.id, title: newTask.title, type: newTask.type, dueDate: newTask.dueDate, duration: newTask.duration, submissions: [] });
      }
    }

    // Auto-create FINAL task if needed
    const finalPercent = (course as any).finalPercent ?? 0;
    if (finalPercent > 0 && !tasks.some(t => t.type === "FINAL") && course.groups.length > 0) {
      const newTask = await prisma.task.create({
        data: {
          title: "Examen Final", type: "FINAL", period, courseId,
          dueDate: new Date(), isExternal: true, active: true, weight: 0,
          groups: { connect: course.groups.map(g => ({ id: g.id })) }
        }
      });
      tasks.push({ id: newTask.id, title: newTask.title, type: newTask.type, dueDate: newTask.dueDate, duration: newTask.duration, submissions: [] });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: { name: true }
    });

    return NextResponse.json({
      course: { id: course.id, name: course.name },
      teacherName: teacher?.name || 'Docente',
      groups: groupsList,
      students,
      tasks,
      saberPercent: course.saberPercent,
      hacerPercent: course.hacerPercent,
      serPercent:   course.serPercent,
      finalPercent,
    });
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/docente/cursos/[id]/grades/spreadsheet
 * Bulk-save grades for a period (used by old spreadsheet component).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { period, submissions } = body;

    if (!period) return NextResponse.json({ error: 'Periodo es obligatorio' }, { status: 400 });

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, teacherId: true } });
    if (!course || course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(submissions)) {
        for (const sub of submissions) {
          const { studentId, taskId, grade } = sub;
          if (grade === null || grade === undefined) {
            await tx.submission.deleteMany({ where: { taskId, studentId } });
          } else {
            const parsedGrade = parseFloat(grade);
            if (isNaN(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 5.0) continue;
            await tx.submission.upsert({
              where: { taskId_studentId: { taskId, studentId } },
              update: { grade: parsedGrade, status: 'GRADED', updatedAt: new Date() },
              create: { taskId, studentId, grade: parsedGrade, status: 'GRADED', createdAt: new Date(), updatedAt: new Date() }
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving spreadsheet grades:', error);
    return NextResponse.json({ error: 'Error al guardar calificaciones' }, { status: 500 });
  }
}
