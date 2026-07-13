import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-educational-key-2026'
);

/**
 * GET /api/docente/cursos/[id]/planilla?period=…&groupId=…
 *
 * Planilla data is stored as:
 *   course.planillaData[period][groupId] = { rows, fileName, savedAt }
 *
 * groupId defaults to "all" when not provided.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'TEACHER') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period  = searchParams.get('period');
    const groupId = searchParams.get('groupId') || 'all';
    if (!period) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true, planillaData: true },
    });

    if (!course || course.teacherId !== (payload.id as string)) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const root = (course.planillaData as Record<string, any> | null) ?? {};
    // Support both old format (root[period] = {rows}) and new (root[period][groupId] = {rows})
    const periodData = root[period];
    let data: any = null;
    if (periodData) {
      if (periodData.rows) {
        // Old format — migrate: treat as "all"
        data = groupId === 'all' ? periodData : null;
      } else {
        data = periodData[groupId] ?? null;
      }
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/docente/cursos/[id]/planilla
 * Body: { period, groupId?, rows, fileName }
 *
 * 1. Create DB tasks for any NEW_* placeholder column IDs
 * 2. Update task title if changed in spreadsheet
 * 3. Persist rows under planillaData[period][groupId]
 * 4. Upsert / delete Submission records
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'TEACHER') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const body = await request.json() as {
      period: string;
      groupId?: string;
      rows: any[][];
      fileName?: string;
    };
    const { period, rows, fileName } = body;
    const groupId = body.groupId || 'all';

    if (!period) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });
    if (!Array.isArray(rows) || rows.length < 2) {
      return NextResponse.json({ error: 'Planilla vacía o inválida' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { groups: { select: { id: true } } },
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Groups to associate new tasks with
    const groupConnect = groupId === 'all'
      ? course.groups.map(g => ({ id: g.id }))
      : course.groups.filter(g => g.id === groupId).map(g => ({ id: g.id }));

    const isPlatform = Array.isArray(rows[0]) && rows[0][0] === 'STUDENT_ID';

    // ── 1. Process column headers (create / rename tasks) ─────────────
    const headerIds: any[]    = isPlatform ? [...(rows[0] ?? [])] : [];
    const headerTitles: any[] = isPlatform ? [...(rows[1] ?? [])] : [];

    if (isPlatform) {
      const existingTasks = await prisma.task.findMany({
        where: { courseId, period, active: true },
        select: { id: true, title: true, type: true },
      });

      let addedExam = 0, addedTask = 0, addedSer = 0;
      const countExisting = (type: string) => existingTasks.filter(t => t.type === type).length;

      for (let ci = 3; ci < headerIds.length; ci++) {
        const id  = String(headerIds[ci] ?? '');
        const raw = String(headerTitles[ci] ?? 'Nueva Actividad').trim();

        if (id.startsWith('NEW_')) {
          const taskType =
            id.startsWith('NEW_EXAM_') ? 'EXAM' :
            id.startsWith('NEW_SER_')  ? 'SER'  : 'TASK';

          // Strip label prefix if present (e.g. "SABER 2 - Algebra" → "Algebra")
          const titleMatch = raw.match(/^(?:SABER|HACER|SER|EXAMEN FINAL|ASISTENCIA)\s+\d+\s*-\s*(.+)$/i);
          const title = (titleMatch ? titleMatch[1].trim() : raw) || 'Nueva Actividad';

          const newTask = await prisma.task.create({
            data: {
              title, type: taskType, period, courseId,
              dueDate: new Date(), isExternal: true, active: true, weight: 0,
              groups: { connect: groupConnect },
            },
          });

          const cat = taskType === 'EXAM' ? 'SABER' : taskType === 'TASK' ? 'HACER' : 'SER';
          const n = countExisting(taskType) + (taskType === 'EXAM' ? ++addedExam : taskType === 'SER' ? ++addedSer : ++addedTask);
          headerIds[ci]    = newTask.id;
          headerTitles[ci] = `${cat} ${n} - ${title}`;
        } else if (id && id.length > 10) {
          // Rename if teacher edited the header
          const existing = existingTasks.find(t => t.id === id);
          if (existing) {
            const titleMatch = raw.match(/^(?:SABER|HACER|SER|EXAMEN FINAL|ASISTENCIA)\s+\d+\s*-\s*(.+)$/i);
            const parsedTitle = (titleMatch ? titleMatch[1].trim() : raw) || '';
            if (parsedTitle && parsedTitle !== existing.title) {
              await prisma.task.update({ where: { id }, data: { title: parsedTitle } });
            }
          }
        }
      }

      rows[0] = headerIds;
      rows[1] = headerTitles;
    }

    // ── 2. Persist rows under planillaData[period][groupId] ───────────
    const root = (course.planillaData as Record<string, any> | null) ?? {};
    // Ensure period bucket is new-format (nested by groupId)
    const periodBucket = (root[period] && !root[period].rows) ? { ...root[period] } : {};
    periodBucket[groupId] = { rows, fileName: fileName ?? '', savedAt: new Date().toISOString() };

    await prisma.course.update({
      where: { id: courseId },
      data: { planillaData: { ...root, [period]: periodBucket } },
    });

    // ── 3. Sync grades from cells ──────────────────────────────────────
    let saved = 0;
    let cleared = 0;

    if (isPlatform) {
      const taskIds: string[] = headerIds.slice(3).filter(
        (id: string) => id && id.length > 10 && !id.startsWith('NEW_')
      );

      if (taskIds.length > 0) {
        const dbTasks = await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true },
        });
        const validTaskIds = new Set(dbTasks.map(t => t.id));

        const rowStudentIds: string[] = rows.slice(2).map((r: any[]) => String(r[0] ?? '')).filter(Boolean);
        const dbStudents = await prisma.user.findMany({
          where: { id: { in: rowStudentIds }, role: 'STUDENT' },
          select: { id: true },
        });
        const validStudentIds = new Set(dbStudents.map(s => s.id));

        for (let ri = 2; ri < rows.length; ri++) {
          const row = rows[ri] ?? [];
          const studentId = String(row[0] ?? '');
          if (!validStudentIds.has(studentId)) continue;

          for (let ci = 3; ci < row.length; ci++) {
            const taskId = String(headerIds[ci] ?? '');
            if (!validTaskIds.has(taskId)) continue;

            const cellVal = row[ci];
            const isEmpty = cellVal === '' || cellVal == null;

            if (isEmpty) {
              const del = await prisma.submission.deleteMany({ where: { taskId, studentId } });
              if (del.count > 0) cleared++;
            } else {
              const g = parseFloat(String(cellVal).replace(',', '.'));
              if (!isNaN(g) && g >= 1.0 && g <= 5.0) {
                await prisma.submission.upsert({
                  where: { taskId_studentId: { taskId, studentId } },
                  update: { grade: parseFloat(g.toFixed(1)), status: 'GRADED', updatedAt: new Date() },
                  create: { taskId, studentId, grade: parseFloat(g.toFixed(1)), status: 'GRADED', createdAt: new Date(), updatedAt: new Date() },
                });
                saved++;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, saved, cleared, updatedRows: rows });
  } catch (err: any) {
    console.error('Error saving planilla:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
