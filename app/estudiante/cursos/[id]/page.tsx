import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import MoodleSection from "./MoodleSection";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CursoDescripcionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  // Get student group
  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true },
  });
  const studentGroupId = studentRecord?.groupId || null;

  // Get active periods sorted
  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = periodsDb.map(p => p.name);

  const now = new Date();

  // Fetch resources
  const resources = await prisma.resource.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch tasks and exams
  const tasks = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: { submissions: { where: { studentId } } },
    orderBy: { dueDate: "asc" },
  });

  // Build sections per period
  const sections = activePeriodNames.map((periodName, idx) => {
    const periodResources = resources
      .filter(r => r.period === periodName)
      .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

    const periodTasks = tasks
      .filter(t => t.period === periodName)
      .map(t => {
        const submission = t.submissions[0];
        const isSubmitted = !!(submission && submission.status !== "PENDING");
        const isGraded = !!(submission && submission.status === "GRADED");
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          dueDate: t.dueDate.toISOString(),
          publishAt: t.publishAt ? t.publishAt.toISOString() : null,
          isSubmitted,
          isGraded,
          grade: isGraded && submission?.grade != null ? Number(submission.grade) : null,
        };
      });

    return {
      key: periodName,
      title: `${periodName}`,
      resources: periodResources,
      tasks: periodTasks,
      defaultOpen: idx === 0,
    };
  });

  // Items without a period (general section)
  const generalResources = resources
    .filter(r => !r.period || !activePeriodNames.includes(r.period))
    .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

  const generalTasks = tasks
    .filter(t => !t.period || !activePeriodNames.includes(t.period))
    .map(t => {
      const submission = t.submissions[0];
      const isSubmitted = !!(submission && submission.status !== "PENDING");
      const isGraded = !!(submission && submission.status === "GRADED");
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        dueDate: t.dueDate.toISOString(),
        publishAt: t.publishAt ? t.publishAt.toISOString() : null,
        isSubmitted,
        isGraded,
        grade: isGraded && submission?.grade != null ? Number(submission.grade) : null,
      };
    });

  const hasGeneral = generalResources.length > 0 || generalTasks.length > 0;

  return (
    <div>
      {/* General section (no period) */}
      {hasGeneral && (
        <MoodleSection
          title="General"
          resources={generalResources}
          tasks={generalTasks}
          defaultOpen={true}
        />
      )}

      {/* Period sections */}
      {sections.map((s, idx) => (
        <MoodleSection
          key={s.key}
          title={s.title}
          resources={s.resources}
          tasks={s.tasks}
          defaultOpen={idx === 0 && !hasGeneral}
        />
      ))}

      {sections.length === 0 && !hasGeneral && (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "6px",
          padding: "3rem",
          textAlign: "center",
          color: "#6c757d",
          fontSize: "0.95rem",
        }}>
          No hay contenido disponible en este curso todavía.
        </div>
      )}
    </div>
  );
}
