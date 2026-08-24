import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
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
    const students = Array.from(studentMap.values());
    const studentIds = students.map(s => s.id);

    // Active periods
    const activePeriodsFromDb = await prisma.period.findMany({ where: { active: true } });
    activePeriodsFromDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const activePeriodNames = activePeriodsFromDb.map(p => p.name);

    const now = new Date();

    // Fetch all tasks for this course in active periods
    const tasks = await prisma.task.findMany({
      where: {
        courseId,
        active: true,
        OR: [{ period: null }, { period: { in: activePeriodNames } }],
        AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      },
      select: {
        id: true,
        type: true,
        period: true,
        dueDate: true,
        duration: true,
        groups: { select: { id: true } },
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, status: true, grade: true, startedAt: true, submittedAt: true },
        },
      },
    });

    // Note: SER/FINAL grades come from Task submissions — no additionalGrade needed.

    // Compute grades per student per period
    const result = students.map(student => {
      const periodsData: Record<string, {
        saber: number | null;
        hacer: number | null;
        ser: number | null;
        final: number | null;
      }> = {};

      for (const periodName of activePeriodNames) {
        const periodTasks = tasks.filter(t =>
          t.period === periodName &&
          (t.groups.length === 0 || t.groups.some(g =>
            course.groups.some(cg => cg.id === g.id && cg.students.some(s => s.id === student.id))
          ))
        );

        const examTasks = periodTasks.filter(t => t.type === 'EXAM');
        const taskTasks = periodTasks.filter(t => t.type === 'TASK');
        const serTasks = periodTasks.filter(t => t.type === 'SER');
        const finalTasks = periodTasks.filter(t => t.type === 'FINAL');

        // For EXAM: auto-assign 1.0 when closed without submission.
        // For TASK (HACER): only return grade if explicitly entered by the teacher (no auto-1.0).
        // For SER/FINAL/ATTEND: only return grade if explicitly entered (no auto-1.0).
        const getGrade = (task: typeof tasks[0]) => {
          const isManual = ['SER', 'FINAL', 'ATTEND', 'TASK'].includes(task.type);
          const sub = task.submissions.find(s => s.studentId === student.id);
          const isClosed = task.dueDate ? new Date(task.dueDate) < now : false;
          const isTimerExpired = sub?.startedAt && task.duration
            ? (new Date(sub.startedAt).getTime() + task.duration * 60 * 1000 + 30000 < now.getTime())
            : false;
          if (sub) {
            if (sub.status === 'GRADED') return sub.grade ?? null;
            if (!isManual && sub.status === 'PENDING' && (isClosed || isTimerExpired)) return 1.0;
            return null;
          }
          if (!isManual && isClosed) return 1.0;
          return null;
        };

        const examGrades = examTasks.map(getGrade).filter((g): g is number => g !== null);
        const taskGrades = taskTasks.map(getGrade).filter((g): g is number => g !== null);
        const serGrades = serTasks.map(getGrade).filter((g): g is number => g !== null);
        const finalGrades = finalTasks.map(getGrade).filter((g): g is number => g !== null);

        const saber = examGrades.length > 0 ? examGrades.reduce((a, b) => a + b, 0) / examGrades.length : null;
        const hacer = taskGrades.length > 0 ? taskGrades.reduce((a, b) => a + b, 0) / taskGrades.length : null;
        const ser = serGrades.length > 0 ? serGrades.reduce((a, b) => a + b, 0) / serGrades.length : null;
        const finalVal = finalGrades.length > 0 ? finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length : null;

        const sp = course.saberPercent / 100;
        const hp = course.hacerPercent / 100;
        const ep = course.serPercent / 100;
        const fp = course.finalPercent / 100;

        // Weighted final = saber*sp + hacer*hp + ser*ep + finalExam*fp
        // (same formula as PlanillaExcelEditor)
        const hasAny = saber !== null || hacer !== null || ser !== null || finalVal !== null;
        const final = hasAny
          ? (saber    !== null ? saber    * sp : 0)
          + (hacer    !== null ? hacer    * hp : 0)
          + (ser      !== null ? ser      * ep : 0)
          + (finalVal !== null ? finalVal * fp : 0)
          : null;

        periodsData[periodName] = { saber, hacer, ser, final };
      }

      return {
        id: student.id,
        name: student.name,
        groupName: student.groupName,
        periods: periodsData,
      };
    });

    return NextResponse.json({
      course: { id: course.id, name: course.name },
      students: result,
      periods: activePeriodNames,
      saberPercent: course.saberPercent,
      hacerPercent: course.hacerPercent,
      serPercent: course.serPercent,
      finalPercent: course.finalPercent,
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
