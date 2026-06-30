import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
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

    // Check if course belongs to teacher (if not admin)
    if (payload.role === "TEACHER") {
      const course = await prisma.course.findFirst({
        where: { id: courseId, teacherId: payload.id as string }
      });
      if (!course) {
        return NextResponse.json({ error: "Curso no encontrado o no pertenece al docente" }, { status: 404 });
      }
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

    // 2. Fetch Tasks for this course & period that are assigned to this group
    const tasks = await prisma.task.findMany({
      where: {
        courseId: courseId,
        period: period,
        groups: { some: { id: groupId } }
      },
      include: {
        submissions: {
          where: { studentId: { in: students.map(s => s.id) } },
          select: { studentId: true, grade: true, status: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ students, tasks });
  } catch (error) {
    console.error("Error in planillas API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
