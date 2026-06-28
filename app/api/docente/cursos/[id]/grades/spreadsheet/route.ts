import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET spreadsheet data
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    if (!period) {
      return NextResponse.json({ error: 'Falta especificar el período' }, { status: 400 });
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

    // Collect all students across groups (deduplicated)
    const studentMap = new Map<string, { id: string; name: string; groupName: string }>();
    for (const group of course.groups) {
      for (const student of group.students) {
        if (!studentMap.has(student.id)) {
          const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel });
        }
      }
    }
    const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const studentIds = students.map(s => s.id);

    // Fetch all tasks for this course in the specified period
    const tasks = await prisma.task.findMany({
      where: {
        courseId,
        active: true,
        period,
      },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        duration: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, status: true, grade: true, id: true },
        },
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch additional grades (SER) for all students in this course & period
    const additionalGrades = await prisma.additionalGrade.findMany({
      where: { courseId, period, studentId: { in: studentIds } },
      select: { studentId: true, grade: true }
    });

    const teacher = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: { name: true }
    });

    return NextResponse.json({
      course: { id: course.id, name: course.name },
      teacherName: teacher?.name || 'Docente',
      students,
      tasks,
      additionalGrades,
      saberPercent: course.saberPercent,
      hacerPercent: course.hacerPercent,
      serPercent: course.serPercent,
    });
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST bulk save grades from spreadsheet
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { period, submissions, additionalGrades } = body;

    if (!period) {
      return NextResponse.json({ error: 'Periodo es obligatorio' }, { status: 400 });
    }

    // 1. Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true }
    });
    if (!course || course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Run database updates in transaction
    await prisma.$transaction(async (tx) => {
      // Save submissions
      if (submissions && Array.isArray(submissions)) {
        for (const sub of submissions) {
          const { studentId, taskId, grade } = sub;
          
          if (grade === null || grade === undefined) {
            // Delete submission or skip? Let's just update grade to null or delete it if it was dummy
            await tx.submission.deleteMany({
              where: { taskId, studentId }
            });
          } else {
            const parsedGrade = parseFloat(grade);
            if (isNaN(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 5.0) continue;

            await tx.submission.upsert({
              where: { taskId_studentId: { taskId, studentId } },
              update: {
                grade: parsedGrade,
                status: 'GRADED',
                updatedAt: new Date(),
              },
              create: {
                taskId,
                studentId,
                grade: parsedGrade,
                status: 'GRADED',
                createdAt: new Date(),
                updatedAt: new Date(),
              }
            });
          }
        }
      }

      // Save additional grades (SER)
      if (additionalGrades && Array.isArray(additionalGrades)) {
        for (const ag of additionalGrades) {
          const { studentId, grade } = ag;

          if (grade === null || grade === undefined) {
            await tx.additionalGrade.deleteMany({
              where: { studentId, courseId, period }
            });
          } else {
            const parsedGrade = parseFloat(grade);
            if (isNaN(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 5.0) continue;

            await tx.additionalGrade.upsert({
              where: { studentId_courseId_period: { studentId, courseId, period } },
              update: {
                grade: parsedGrade,
                updatedAt: new Date(),
              },
              create: {
                studentId,
                courseId,
                period,
                grade: parsedGrade,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
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
