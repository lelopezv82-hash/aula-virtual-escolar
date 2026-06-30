import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        course: { select: { teacherId: true } },
        groups: {
          include: {
            students: {
              where: { role: 'STUDENT' },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
            grade: { select: { name: true } },
          }
        },
        submissions: {
          select: { id: true, studentId: true, status: true, grade: true, feedback: true, submittedAt: true },
        },
      },
    });

    if (!task || task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Collect all students across groups (deduplicated)
    const studentMap = new Map<string, { id: string; name: string; groupName: string }>();
    for (const group of task.groups) {
      for (const student of group.students) {
        if (!studentMap.has(student.id)) {
          const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel });
        }
      }
    }

    const submissionMap = new Map(task.submissions.map(s => [s.studentId, s]));

    const students = Array.from(studentMap.values()).map(s => ({
      ...s,
      submission: submissionMap.get(s.id) ?? null,
    }));

    return NextResponse.json({ students, taskType: task.type, taskTitle: task.title });
  } catch (error) {
    console.error("Error fetching task students:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
