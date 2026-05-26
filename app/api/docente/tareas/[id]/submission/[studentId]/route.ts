import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: resolvedParams.id },
      include: { course: true }
    });

    if (!task || task.course.teacherId !== (payload.id as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId: resolvedParams.id,
          studentId: resolvedParams.studentId,
        },
      },
      include: { student: true },
    });

    return NextResponse.json({ task, submission });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
