import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET: Return saved planilla data for a course+period
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'TEACHER') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    if (!period) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true, planillaData: true }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const planillaMap = (course.planillaData as Record<string, any> | null) || {};
    const data = planillaMap[period] || null;

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

// POST: Save planilla rows + extract grades into DB
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'TEACHER') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const body = await request.json();
    const { period, rows, base64File, fileName, gradeSubmissions } = body;
    // rows: any[][] — the full 2D spreadsheet to store
    // gradeSubmissions: Array<{ studentId, taskId, grade: number|null }> — extracted grades

    if (!period) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true, planillaData: true }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // ── 1. Persist the spreadsheet rows ───────────────────────────────────
    const existing = (course.planillaData as Record<string, any> | null) || {};
    await prisma.course.update({
      where: { id: courseId },
      data: {
        planillaData: {
          ...existing,
          [period]: { rows, base64File: base64File || "", fileName: fileName || "", savedAt: new Date().toISOString() }
        }
      }
    });

    // ── 2. Apply grade submissions to DB ──────────────────────────────────
    let saved = 0;
    let cleared = 0;
    if (Array.isArray(gradeSubmissions)) {
      for (const sub of gradeSubmissions) {
        if (!sub.studentId || !sub.taskId) continue;
        if (sub.grade === null || sub.grade === undefined) {
          await prisma.submission.deleteMany({
            where: { taskId: sub.taskId, studentId: sub.studentId }
          });
          cleared++;
        } else {
          const g = parseFloat(sub.grade);
          if (isNaN(g)) continue;
          await prisma.submission.upsert({
            where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
            update: { grade: g, status: 'GRADED', updatedAt: new Date() },
            create: { taskId: sub.taskId, studentId: sub.studentId, grade: g, status: 'GRADED', createdAt: new Date(), updatedAt: new Date() }
          });
          saved++;
        }
      }
    }

    return NextResponse.json({ success: true, saved, cleared });
  } catch (err: any) {
    console.error('Error saving planilla:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
