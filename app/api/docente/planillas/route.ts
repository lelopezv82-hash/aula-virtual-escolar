import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (payload.role !== "TEACHER" && payload.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const period = searchParams.get("period");
    const groupId = searchParams.get("groupId");

    if (!courseId || !period || !groupId) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    // Fetch course config
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...(payload.role === "TEACHER" ? { teacherId: payload.id as string } : {}) },
      select: {
        id: true,
        name: true,
        saberPercent: true,
        hacerPercent: true,
        serPercent: true,
        finalPercent: true
      }
    });

    if (!course) {
      return NextResponse.json({ error: "Curso no encontrado o no pertenece al docente" }, { status: 404 });
    }

    // 1. Fetch Students in the given groupId
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", groupId: groupId },
      select: {
        id: true,
        name: true,
        group: {
          select: {
            name: true,
            grade: { select: { name: true } }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const studentIds = students.map(s => s.id);

    // 2. Fetch Tasks for this course & period that are assigned to this group
    // SABER = EXAM, HACER = TASK, SER = SER, FINAL = FINAL, ATTEND = ATTEND
    const tasks = await prisma.task.findMany({
      where: {
        courseId: courseId,
        period: period,
        OR: [
          { groups: { some: { id: groupId } } },
          { assignedStudents: { some: { id: { in: studentIds } } } }
        ]
      },
      select: {
        id: true,
        title: true,
        type: true,
        active: true,
        isExternal: true,
        dueDate: true,
        allowLateSubmission: true,
        lateSubmissionUntil: true,
        duration: true,
        assignedStudents: {
          select: { id: true }
        },
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { 
            studentId: true, 
            grade: true, 
            status: true,
            fileUrl: true,
            submittedAt: true,
            allowLateSubmission: true,
            lateSubmissionUntil: true,
            startedAt: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ students, tasks, course });
  } catch (error) {
    console.error("Error in planillas API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST: Save grades manually from planillas view
export async function POST(req: Request) {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (payload.role !== "TEACHER" && payload.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { courseId, submissions } = body;

    if (!courseId || !Array.isArray(submissions)) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Verify course ownership
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...(payload.role === "TEACHER" ? { teacherId: payload.id as string } : {}) },
      select: { id: true }
    });
    if (!course) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    // Upsert submissions
    await prisma.$transaction(async (tx) => {
      for (const sub of submissions) {
        const { studentId, taskId, grade } = sub;
        if (!studentId || !taskId) continue;

        if (grade === null || grade === undefined || grade === "") {
          // Delete submission if grade cleared
          await tx.submission.deleteMany({ where: { taskId, studentId } });
        } else {
          const parsedGrade = parseFloat(grade);
          if (isNaN(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 5.0) continue;

          await tx.submission.upsert({
            where: { taskId_studentId: { taskId, studentId } },
            update: { grade: parsedGrade, status: "GRADED", updatedAt: new Date() },
            create: {
              taskId,
              studentId,
              grade: parsedGrade,
              status: "GRADED",
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving planillas grades:", error);
    return NextResponse.json({ error: "Error al guardar calificaciones" }, { status: 500 });
  }
}
