import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import RecursosTemaSection, { ResourceItem } from "./RecursosTemaSection";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CursoRecursosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { id } = await params;
  const { periodo } = await searchParams;

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

  const course = await prisma.course.findUnique({
    where: { id },
    select: { name: true, hiddenSections: true }
  });
  const hiddenSections = Array.isArray(course?.hiddenSections) ? (course?.hiddenSections as string[]) : [];

  if (hiddenSections.includes("recursos")) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        padding: "3rem",
        textAlign: "center",
        color: "#6c757d",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#333", marginBottom: "0.25rem" }}>Sección Oculta</h2>
        <p style={{ fontSize: "0.875rem" }}>El docente ha desactivado la visibilidad de la sección de Recursos para este curso.</p>
      </div>
    );
  }

  const periodsDb = await prisma.period.findMany();
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = periodsDb.filter(p => p.active).map(p => p.name);
  const allPeriodNames = periodsDb.map(p => p.name);

  // Fetch course themes
  const themes = await prisma.theme.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" }
  });

  const now = new Date();

  // Fetch standalone course resources
  const standaloneResources = await prisma.resource.findMany({
    where: {
      courseId: id,
      active: true,
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        ...(studentGroupId
          ? [{ OR: [{ groups: { none: {} } }, { groups: { some: { id: studentGroupId } } }] }]
          : [])
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { groups: true, themes: true },
  });

  // Fetch tasks with attached resources or guides
  const tasksWithMaterials = await prisma.task.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [
        { attachmentUrl: { not: null } },
        { resources: { some: {} } }
      ],
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        ...(studentGroupId
          ? [{ OR: [{ groups: { none: {} } }, { groups: { some: { id: studentGroupId } } }] }]
          : [])
      ]
    },
    include: {
      resources: true,
      themes: true
    },
    orderBy: { createdAt: "desc" }
  });

  const unifiedList: ResourceItem[] = [];
  const seenUrls = new Set<string>();

  // Add standalone resources
  for (const r of standaloneResources) {
    if (r.url && !seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      const themeTitle = r.themes?.[0]?.title || r.theme || null;
      unifiedList.push({
        id: r.id,
        title: r.title,
        type: r.type || "FILE",
        url: r.url,
        period: r.period || null,
        themeTitle,
        sourceType: "MATERIAL",
        createdAt: r.createdAt.toISOString()
      });
    }
  }

  // Add task materials / guides
  for (const t of tasksWithMaterials) {
    if (t.attachmentUrl && !seenUrls.has(t.attachmentUrl)) {
      seenUrls.add(t.attachmentUrl);
      const ext = t.attachmentUrl.split('.').pop()?.toUpperCase() || "PDF";
      unifiedList.push({
        id: `task-att-${t.id}`,
        title: `Guía: ${t.title}`,
        type: ext,
        url: t.attachmentUrl,
        period: t.period || null,
        themeTitle: t.themes?.[0]?.title || t.theme || null,
        sourceType: "TASK_GUIDE",
        taskTitle: t.title,
        createdAt: t.createdAt.toISOString()
      });
    }
    for (const res of t.resources) {
      if (res.url && !seenUrls.has(res.url)) {
        seenUrls.add(res.url);
        unifiedList.push({
          id: `task-res-${res.id}`,
          title: res.title,
          type: res.type || "FILE",
          url: res.url,
          period: res.period || t.period || null,
          themeTitle: t.themes?.[0]?.title || t.theme || null,
          sourceType: "TASK_RESOURCE",
          taskTitle: t.title,
          createdAt: res.createdAt.toISOString()
        });
      }
    }
  }

  // Filter resources to display based on selected period or active periods
  let filtered = unifiedList;
  if (periodo && periodo !== "TODOS") {
    filtered = unifiedList.filter(r => r.period?.trim().toLowerCase() === periodo.trim().toLowerCase());
  } else if (!periodo && activePeriodNames.length > 0) {
    const activeFiltered = unifiedList.filter(r => 
      !r.period || activePeriodNames.some(ap => ap.trim().toLowerCase() === r.period?.trim().toLowerCase())
    );
    // If there are resources in active periods, show them; otherwise fallback to showing all resources
    filtered = activeFiltered.length > 0 ? activeFiltered : unifiedList;
  }

  // Group filtered resources by Theme
  const themeMap = new Map<string, ResourceItem[]>();
  const generalResources: ResourceItem[] = [];

  for (const item of filtered) {
    const rawTheme = item.themeTitle?.trim();
    if (rawTheme) {
      if (!themeMap.has(rawTheme)) {
        themeMap.set(rawTheme, []);
      }
      themeMap.get(rawTheme)!.push(item);
    } else {
      generalResources.push(item);
    }
  }

  // Get theme order from DB themes
  const dbThemeTitles = themes.map(t => t.title);
  const dbThemeSet = new Set(dbThemeTitles);
  const extraThemeTitles = Array.from(themeMap.keys())
    .filter(t => !dbThemeSet.has(t))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const orderedThemes = [...dbThemeTitles, ...extraThemeTitles].filter(themeName => {
    const list = themeMap.get(themeName);
    return list && list.length > 0;
  });

  const hasContent = orderedThemes.length > 0 || generalResources.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Period Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen size={22} className="text-orange-600" />
            Recursos y Materiales de Estudio
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Archivos, guías y enlaces organizados por tema para complementar tu aprendizaje.
          </p>
        </div>

        {/* Period filter buttons if periods exist */}
        {allPeriodNames.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            <Link
              href={`/estudiante/cursos/${id}/recursos`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                !periodo
                  ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              Periodo Actual
            </Link>
            {allPeriodNames.map(pName => (
              <Link
                key={pName}
                href={`/estudiante/cursos/${id}/recursos?periodo=${encodeURIComponent(pName)}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  periodo === pName
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                {pName}
              </Link>
            ))}
            <Link
              href={`/estudiante/cursos/${id}/recursos?periodo=TODOS`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                periodo === "TODOS"
                  ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              Todos
            </Link>
          </div>
        )}
      </div>

      {/* Resources grouped by Theme */}
      {!hasContent ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <BookOpen size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
            No hay materiales disponibles {periodo && periodo !== "TODOS" ? `para ${periodo}` : "en esta asignatura"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Los documentos, guías de actividades y enlaces que asigne el docente aparecerán organizados por temas aquí.
          </p>
        </div>
      ) : (
        <div>
          {/* Render each theme section */}
          {orderedThemes.map((themeName) => (
            <RecursosTemaSection
              key={themeName}
              title={themeName}
              resources={themeMap.get(themeName) || []}
              defaultOpen={true}
            />
          ))}

          {/* Render general resources if any without specific theme */}
          {generalResources.length > 0 && (
            <RecursosTemaSection
              title="Materiales Generales"
              resources={generalResources}
              defaultOpen={orderedThemes.length === 0}
            />
          )}
        </div>
      )}
    </div>
  );
}
