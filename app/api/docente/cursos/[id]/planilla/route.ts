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
    const { period, rows, fileName } = body;
    // rows: any[][] — the full 2D spreadsheet to store

    if (!period) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });
    if (!Array.isArray(rows) || rows.length < 2) {
      return NextResponse.json({ error: 'Datos de planilla inválidos' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        groups: { select: { id: true } }
      }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const cleanTitle = (cellVal: string): { type: string; title: string } => {
      const str = String(cellVal || "").trim();
      const match = str.match(/^(SABER|HACER|SER|EXAMEN FINAL|ASISTENCIA)\s+\d+\s*-\s*(.*)$/i);
      if (match) {
        const typeLabel = match[1].toUpperCase();
        const type = typeLabel === "SABER" ? "EXAM" : typeLabel === "HACER" ? "TASK" : typeLabel === "SER" ? "SER" : typeLabel === "EXAMEN FINAL" ? "FINAL" : "ATTEND";
        return { type, title: match[2].trim() };
      }
      return { type: "", title: str };
    };

    // ── 1. Sync tasks based on columns ────────────────────────────────────
    const headerIds = rows[0] || [];
    const headerTitles = rows[1] || [];
    const updatedIds = [...headerIds];
    const updatedTitles = [...headerTitles];

    if (headerIds[0] === "STUDENT_ID") {
      const activeTasks = await prisma.task.findMany({
        where: { courseId, period, active: true }
      });

      // Count existing tasks by type to generate N prefixes correctly
      const getTaskCount = (type: string) => {
        return activeTasks.filter(t => t.type === type).length;
      };
      let addedExam = 0, addedTask = 0, addedSer = 0;

      for (let ci = 3; ci < headerIds.length; ci++) {
        const id = String(headerIds[ci] || "");
        const rawTitle = String(headerTitles[ci] || "Nueva Actividad");
        const parsed = cleanTitle(rawTitle);

        if (id.startsWith("NEW_")) {
          // Determine type from ID prefix
          const taskType = id.startsWith("NEW_EXAM_") ? "EXAM" : id.startsWith("NEW_SER_") ? "SER" : "TASK";
          const title = parsed.title || "Nueva Actividad";

          // Create the task in database
          const newTask = await prisma.task.create({
            data: {
              title,
              type: taskType,
              period,
              courseId,
              dueDate: new Date(),
              isExternal: true,
              active: true,
              weight: 0,
              groups: { connect: course.groups.map(g => ({ id: g.id })) }
            }
          });

          // Update header cell values
          updatedIds[ci] = newTask.id;
          const catLabel = taskType === "EXAM" ? "SABER" : taskType === "TASK" ? "HACER" : "SER";
          const currentCount = getTaskCount(taskType) + (taskType === "EXAM" ? ++addedExam : taskType === "SER" ? ++addedSer : ++addedTask);
          updatedTitles[ci] = `${catLabel} ${currentCount} - ${title}`;
        } else if (id && id.length > 10) {
          // Existing task: Check if title was updated in spreadsheet
          const existingTask = activeTasks.find(t => t.id === id);
          if (existingTask && parsed.title && parsed.title !== existingTask.title) {
            await prisma.task.update({
              where: { id },
              data: { title: parsed.title }
            });
          }
        }
      }

      // Update rows with new IDs and clean titles
      rows[0] = updatedIds;
      rows[1] = updatedTitles;
    }

    // ── 2. Persist the spreadsheet rows ───────────────────────────────────
    const existing = (course.planillaData as Record<string, any> | null) || {};
    await prisma.course.update({
      where: { id: courseId },
      data: {
        planillaData: {
          ...existing,
          [period]: { rows, fileName: fileName || "", savedAt: new Date().toISOString() }
        }
      }
    });

    // ── 3. Extract and save student grades ────────────────────────────────
    let saved = 0;
    let cleared = 0;

    if (rows[0] && rows[0][0] === "STUDENT_ID") {
      const taskIds = rows[0].slice(3);
      const dbTasks = await prisma.task.findMany({
        where: { id: { in: taskIds.filter(id => id && !id.startsWith("NEW_")) } }
      });
      const dbStudents = await prisma.user.findMany({
        where: { role: 'STUDENT' }
      });

      for (let ri = 2; ri < rows.length; ri++) {
        const row = rows[ri] || [];
        const studentId = row[0];
        if (!studentId || !dbStudents.some(s => s.id === studentId)) continue;

        for (let ci = 3; ci < row.length; ci++) {
          const taskId = rows[0][ci];
          if (!taskId || !dbTasks.some(t => t.id === taskId)) continue;

          const cellVal = row[ci];
          if (cellVal === "" || cellVal === null || cellVal === undefined) {
            await prisma.submission.deleteMany({
              where: { taskId, studentId }
            });
            cleared++;
          } else {
            const g = parseFloat(String(cellVal).replace(",", "."));
            if (!isNaN(g) && g >= 1.0 && g <= 5.0) {
              const roundedGrade = parseFloat(g.toFixed(1));
              await prisma.submission.upsert({
                where: { taskId_studentId: { taskId, studentId } },
                update: { grade: roundedGrade, status: 'GRADED', updatedAt: new Date() },
                create: { taskId, studentId, grade: roundedGrade, status: 'GRADED', createdAt: new Date(), updatedAt: new Date() }
              });
              saved++;
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
