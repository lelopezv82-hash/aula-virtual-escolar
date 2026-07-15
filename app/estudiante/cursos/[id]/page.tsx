import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import MoodleSection, { MoodleItem } from "./MoodleSection";

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

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true },
  });
  const studentGroupId = studentRecord?.groupId || null;

  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  const activePeriodNames = periodsDb.map(p => p.name);

  const now = new Date();

  // Fetch all resources
  const resources = await prisma.resource.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch all tasks and exams (active periods only)
  const tasks = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ period: null }, { period: { in: activePeriodNames } }],
      AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    include: {
      submissions: { where: { studentId } },
      resources: true
    },
    orderBy: { dueDate: "asc" },
  });

  // Collect linked resource IDs to avoid duplicates on the main sections
  const linkedResourceIds = new Set<string>();
  tasks.forEach(t => {
    t.resources.forEach(r => linkedResourceIds.add(r.id));
  });

  // Standalone resources (not connected directly to tasks)
  const standaloneResources = resources.filter(r => !linkedResourceIds.has(r.id));

  // Build MoodleItem representation
  const resourceItems: MoodleItem[] = standaloneResources.map(r => ({
    isResource: true as const,
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    createdAt: r.createdAt.toISOString()
  }));

  const taskItems: MoodleItem[] = tasks.map(t => {
    const submission = t.submissions[0];
    const isSubmitted = !!(submission && submission.status !== "PENDING");
    const isGraded = !!(submission && submission.status === "GRADED");
    return {
      isResource: false as const,
      id: t.id,
      title: t.title,
      type: t.type,
      dueDate: t.dueDate.toISOString(),
      publishAt: t.publishAt ? t.publishAt.toISOString() : null,
      description: t.description || null,
      isSubmitted,
      isGraded,
      grade: isGraded && submission?.grade != null ? Number(submission.grade) : null,
      createdAt: t.createdAt.toISOString(),
      attachmentUrl: t.attachmentUrl,
      resources: t.resources.map(res => ({
        id: res.id,
        title: res.title,
        type: res.type,
        url: res.url
      }))
    };
  });

  const allItems = [...resourceItems, ...taskItems];

  // Group all items by their theme field
  const themeMap = new Map<string, MoodleItem[]>();

  allItems.forEach(item => {
    let themeValue = "";
    if (item.isResource) {
      const originalResource = standaloneResources.find(r => r.id === item.id);
      themeValue = originalResource?.theme?.trim() || "";
    } else {
      const originalTask = tasks.find(t => t.id === item.id);
      themeValue = originalTask?.theme?.trim() || "";
    }

    if (themeValue) {
      if (!themeMap.has(themeValue)) {
        themeMap.set(themeValue, []);
      }
      themeMap.get(themeValue)!.push(item);
    }
  });

  // Natural sort for themes (Tema 1, Tema 2, etc.)
  const sortedThemeNames = Array.from(themeMap.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // General items (without theme assigned)
  const generalItems = allItems.filter(item => {
    let themeValue = "";
    if (item.isResource) {
      const originalResource = standaloneResources.find(r => r.id === item.id);
      themeValue = originalResource?.theme?.trim() || "";
    } else {
      const originalTask = tasks.find(t => t.id === item.id);
      themeValue = originalTask?.theme?.trim() || "";
    }
    return !themeValue;
  });

  const hasGeneral = generalItems.length > 0;
  const hasRealContent = sortedThemeNames.length > 0 || hasGeneral;

  return (
    <div>
      {/* Render theme sections */}
      {sortedThemeNames.map((themeName) => {
        const themeItems = themeMap.get(themeName) || [];
        return (
          themeItems.length > 0 && (
            <MoodleSection
              key={themeName}
              title={themeName}
              items={themeItems}
              defaultOpen={false}
            />
          )
        );
      })}

      {/* General section for items without a theme */}
      {hasGeneral && (
        <MoodleSection
          title="General"
          items={generalItems}
          defaultOpen={false}
        />
      )}

      {/* Empty course state */}
      {!hasRealContent && (
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
