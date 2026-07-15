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

  // Get active periods
  const periodsDb = await prisma.period.findMany({ where: { active: true } });
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

  // Fetch tasks and exams (only from active periods)
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

  // Collect all unique themes (preserving order of first appearance)
  const themeOrder: string[] = [];
  const seenThemes = new Set<string>();

  for (const r of resources) {
    const t = r.theme?.trim() || "";
    if (t && !seenThemes.has(t)) { seenThemes.add(t); themeOrder.push(t); }
  }
  for (const t of tasks) {
    const th = t.theme?.trim() || "";
    if (th && !seenThemes.has(th)) { seenThemes.add(th); themeOrder.push(th); }
  }

  // Sort themes naturally (Tema 1, Tema 2, Actividad I, Actividad II, etc.)
  themeOrder.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Build sections by theme
  const sections = themeOrder.map((theme, idx) => {
    const sectionResources = resources
      .filter(r => r.theme?.trim() === theme)
      .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

    const sectionTasks = tasks
      .filter(t => t.theme?.trim() === theme)
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
          description: t.description || null,
          isSubmitted,
          isGraded,
          grade: isGraded && submission?.grade != null ? Number(submission.grade) : null,
        };
      });

    return { theme, sectionResources, sectionTasks, defaultOpen: idx === 0 };
  });

  // Items without a theme — show as "General" section
  const generalResources = resources
    .filter(r => !r.theme?.trim())
    .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

  const generalTasks = tasks
    .filter(t => !t.theme?.trim())
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
        description: t.description || null,
        isSubmitted,
        isGraded,
        grade: isGraded && submission?.grade != null ? Number(submission.grade) : null,
      };
    });

  const hasGeneral = generalResources.length > 0 || generalTasks.length > 0;

  return (
    <div>
      {/* Theme sections */}
      {sections.map((s, idx) => (
        <MoodleSection
          key={s.theme}
          title={s.theme}
          resources={s.sectionResources}
          tasks={s.sectionTasks}
          defaultOpen={idx === 0 && !hasGeneral}
        />
      ))}

      {/* General section (items without theme) */}
      {hasGeneral && (
        <MoodleSection
          title="General"
          resources={generalResources}
          tasks={generalTasks}
          defaultOpen={sections.length === 0}
        />
      )}

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
