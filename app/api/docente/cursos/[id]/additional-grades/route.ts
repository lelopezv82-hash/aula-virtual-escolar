import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const groupId = searchParams.get('groupId');
    if (!period) return NextResponse.json({ error: 'El período es requerido' }, { status: 400 });

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { groups: true }
    });

    if (!course || course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const allowedGroupIds = course.groups.map(g => g.id);
    const targetGroupIds = groupId ? [groupId] : allowedGroupIds;

    if (groupId && !allowedGroupIds.includes(groupId)) {
      return NextResponse.json({ error: 'Grupo no asignado a esta asignatura' }, { status: 400 });
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        groupId: { in: targetGroupIds }
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, username: true }
    });

    const additionalGrades = await prisma.additionalGrade.findMany({
      where: {
        courseId,
        period,
        studentId: { in: students.map(s => s.id) }
      }
    });

    const gradesMap = new Map(additionalGrades.map(g => [g.studentId, g.grade]));

    const studentsWithGrades = students.map(s => ({
      id: s.id,
      name: s.name,
      username: s.username,
      grade: gradesMap.get(s.id) ?? null
    }));

    return NextResponse.json({ students: studentsWithGrades });
  } catch (error) {
    console.error("Error fetching additional grades:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { period, grades } = await request.json();
    if (!period || !Array.isArray(grades)) {
      return NextResponse.json({ error: 'Datos inválidos o faltantes' }, { status: 400 });
    }

    for (const item of grades) {
      const { studentId, grade } = item;
      if (grade === null || grade === undefined || grade === "" || isNaN(Number(grade))) {
        await prisma.additionalGrade.deleteMany({
          where: { studentId, courseId, period }
        });
      } else {
        const numGrade = Math.max(1.0, Math.min(5.0, Number(grade)));
        await prisma.additionalGrade.upsert({
          where: {
            studentId_courseId_period: {
              studentId, courseId, period
            }
          },
          update: { grade: numGrade },
          create: {
            studentId,
            courseId,
            period,
            grade: numGrade
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving additional grades:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
