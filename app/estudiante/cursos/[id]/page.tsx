import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import MoodleSection from "./MoodleSection";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// High-fidelity Moodle example sections from screenshot
const exampleSections = [
  {
    title: "Tema 1. Fundamentos básicos de la investigación educativa",
    resources: [
      { id: "ex-r1", title: "Diapositivas clase 1", type: "PPTX", url: "#" }
    ],
    tasks: [
      {
        id: "ex-t1",
        title: "1. Evaluación",
        type: "TASK",
        publishAt: "2025-03-28T23:00:00.000Z",
        dueDate: "2025-04-04T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null
      }
    ]
  },
  {
    title: "Tema 2. Modelos y enfoques de investigación en educación",
    resources: [
      { id: "ex-r2", title: "Diapositivas segunda clase", type: "PPTX", url: "#" }
    ],
    tasks: [
      {
        id: "ex-t2",
        title: "2. Evaluación",
        type: "TASK",
        publishAt: "2025-04-07T23:00:00.000Z",
        dueDate: "2025-04-14T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null
      }
    ]
  },
  {
    title: "Tema 3. Análisis de la realidad social",
    resources: [
      { id: "ex-r3", title: "Diapositivas", type: "PPTX", url: "#" }
    ],
    tasks: [
      {
        id: "ex-t3",
        title: "3. Evaluación",
        type: "TASK",
        publishAt: "2025-04-16T23:00:00.000Z",
        dueDate: "2025-04-23T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null
      }
    ]
  },
  {
    title: "Tema 4. Definición de la metodología mixta en la investigación educativa",
    resources: [
      { id: "ex-r4", title: "Diapositivas", type: "PPT", url: "#" }
    ],
    tasks: [
      {
        id: "ex-t4",
        title: "4. Evaluación",
        type: "TASK",
        publishAt: "2025-04-25T23:00:00.000Z",
        dueDate: "2025-05-02T23:00:00.000Z",
        description: null,
        isSubmitted: false,
        isGraded: false,
        grade: null
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

  // Get active periods sorted naturally
  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = periodsDb.map(p => p.name);

  const now = new Date();

  // Fetch all resources for this course (active + published)
  const resources = await prisma.resource.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch all tasks and exams for this course (active periods + published)
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

  // Helper: map a task to the TaskItem shape
  function mapTask(t: typeof tasks[0]) {
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
  }

  // Build one section per active period
  const sections = activePeriodNames.map((periodName, idx) => {
    const sectionResources = resources
      .filter(r => r.period === periodName)
      .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

    const sectionTasks = tasks
      .filter(t => t.period === periodName)
      .map(mapTask);

    return { periodName, sectionResources, sectionTasks, defaultOpen: idx === 0 };
  });

  // Items without a period → General section
  const generalResources = resources
    .filter(r => !r.period || !activePeriodNames.includes(r.period))
    .map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }));

  const generalTasks = tasks
    .filter(t => !t.period || !activePeriodNames.includes(t.period))
    .map(mapTask);

  const hasGeneral = generalResources.length > 0 || generalTasks.length > 0;
  const hasRealContent = sections.some(s => s.sectionResources.length > 0 || s.sectionTasks.length > 0) || hasGeneral;

  return (
    <div>
      {/* If there is real database content, render it */}
      {hasRealContent ? (
        <>
          {/* Period sections */}
          {sections.map((s, idx) => (
            (s.sectionResources.length > 0 || s.sectionTasks.length > 0) && (
              <MoodleSection
                key={s.periodName}
                title={s.periodName}
                resources={s.sectionResources}
                tasks={s.sectionTasks}
                defaultOpen={idx === 0}
              />
            )
          ))}

          {/* General section */}
          {hasGeneral && (
            <MoodleSection
              title="General"
              resources={generalResources}
              tasks={generalTasks}
              defaultOpen={!sections.some(s => s.sectionResources.length > 0 || s.sectionTasks.length > 0)}
            />
          )}
        </>
      ) : (
        /* If there's no real content in the DB yet, render the high-fidelity mock examples */
        <>
          {exampleSections.map((s, idx) => (
            <MoodleSection
              key={s.title}
              title={s.title}
              resources={s.resources}
              tasks={s.tasks}
              defaultOpen={idx === 0}
            />
          ))}
        </>
      )}
    </div>
  );
}
