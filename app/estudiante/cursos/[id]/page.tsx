import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import MoodleSection, { MoodleItem } from "./MoodleSection";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// High-fidelity Moodle example sections from screenshot
const exampleSections = [
  {
    title: "Tema 1. Fundamentos básicos de la investigación educativa",
    items: [
      {
        isResource: true as const,
        id: "ex-r1",
        title: "Diapositivas clase 1",
        type: "PPTX",
        url: "#",
        createdAt: "2025-03-28T22:50:00.000Z"
      },
      {
        isResource: false as const,
        id: "ex-t1",
        title: "1. Evaluación",
        type: "TASK",
        publishAt: "2025-03-28T23:00:00.000Z",
        dueDate: "2025-04-04T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null,
        createdAt: "2025-03-28T22:55:00.000Z",
        attachmentUrl: null,
        resources: []
      }
    ]
  },
  {
    title: "Tema 2. Modelos y enfoques de investigación en educación",
    items: [
      {
        isResource: true as const,
        id: "ex-r2",
        title: "Diapositivas segunda clase",
        type: "PPTX",
        url: "#",
        createdAt: "2025-04-07T22:50:00.000Z"
      },
      {
        isResource: false as const,
        id: "ex-t2",
        title: "2. Evaluación",
        type: "TASK",
        publishAt: "2025-04-07T23:00:00.000Z",
        dueDate: "2025-04-14T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null,
        createdAt: "2025-04-07T22:55:00.000Z",
        attachmentUrl: null,
        resources: []
      }
    ]
  },
  {
    title: "Tema 3. Análisis de la realidad social",
    items: [
      {
        isResource: true as const,
        id: "ex-r3",
        title: "Diapositivas",
        type: "PPTX",
        url: "#",
        createdAt: "2025-04-16T22:50:00.000Z"
      },
      {
        isResource: false as const,
        id: "ex-t3",
        title: "3. Evaluación",
        type: "TASK",
        publishAt: "2025-04-16T23:00:00.000Z",
        dueDate: "2025-04-23T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null,
        createdAt: "2025-04-16T22:55:00.000Z",
        attachmentUrl: null,
        resources: []
      }
    ]
  },
  {
    title: "Tema 4. Definición de la metodología mixta en la investigación educativa",
    items: [
      {
        isResource: true as const,
        id: "ex-r4",
        title: "Diapositivas",
        type: "PPT",
        url: "#",
        createdAt: "2025-04-25T22:50:00.000Z"
      },
      {
        isResource: false as const,
        id: "ex-t4",
        title: "4. Evaluación",
        type: "TASK",
        publishAt: "2025-04-25T23:00:00.000Z",
        dueDate: "2025-05-02T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null,
        createdAt: "2025-04-25T22:55:00.000Z",
        attachmentUrl: null,
        resources: []
      }
    ]
  }
];

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
      {/* ALWAYS render the high-fidelity mock Moodle examples first */}
      {exampleSections.map((s) => (
        <MoodleSection
          key={s.title}
          title={s.title}
          items={s.items}
          defaultOpen={false}
        />
      ))}

      {/* If there is real database content, render it below grouped by Theme */}
      {hasRealContent && (
        <div style={{ marginTop: "2.5rem", borderTop: "2px dashed #dee2e6", paddingTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#495057", marginBottom: "1rem" }}>
            Contenido de la Asignatura (Plataforma)
          </h3>
          {/* Theme sections */}
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
        </div>
      )}
    </div>
  );
}
