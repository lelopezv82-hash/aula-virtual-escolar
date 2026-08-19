import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { BookOpen } from "lucide-react";
import RecursosTemaSection, { ResourceItem } from "./RecursosTemaSection";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getCleanFileType(url: string, rawType?: string): string {
  if (!url) return (rawType && rawType.length <= 6) ? rawType.toUpperCase() : "ARCHIVO";
  const upperUrl = url.toUpperCase();
  if (upperUrl.includes("DRIVE.GOOGLE.COM") || upperUrl.includes("DOCS.GOOGLE.COM")) {
    if (upperUrl.includes("SPREADSHEET") || upperUrl.includes("/SHEETS")) return "EXCEL";
    if (upperUrl.includes("DOCUMENT") || upperUrl.includes("/DOCS")) return "DOCUMENTO";
    if (upperUrl.includes("PRESENTATION")) return "PPT";
    return "DRIVE";
  }
  if (upperUrl.includes("YOUTUBE.COM") || upperUrl.includes("YOU_TU.BE")) return "VIDEO";
  if (rawType && rawType.length <= 6 && !rawType.includes("/") && !rawType.includes(".")) {
    return rawType.toUpperCase();
  }
  const cleanPath = url.split("?")[0].split("#")[0];
  const extension = cleanPath.split(".").pop()?.toUpperCase();
  if (extension && extension.length <= 5 && /^[A-Z0-9]+$/.test(extension)) {
    return extension;
  }
  if (url.startsWith("http")) return "ENLACE";
  return (rawType && rawType.length <= 6) ? rawType.toUpperCase() : "ARCHIVO";
}

export default async function CursoRecursosPage({
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
      const cleanType = getCleanFileType(r.url, r.type);
      unifiedList.push({
        id: r.id,
        title: r.title,
        type: cleanType,
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
      const cleanType = getCleanFileType(t.attachmentUrl, "GUIA");
      unifiedList.push({
        id: `task-att-${t.id}`,
        title: `Guía: ${t.title}`,
        type: cleanType,
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
        const cleanType = getCleanFileType(res.url, res.type);
        unifiedList.push({
          id: `task-res-${res.id}`,
          title: res.title,
          type: cleanType,
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

  // Group resources by Theme
  const themeMap = new Map<string, ResourceItem[]>();
  const generalResources: ResourceItem[] = [];

  for (const item of unifiedList) {
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
    <div className="flex flex-col gap-5">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <BookOpen size={22} className="text-orange-600" />
          Recursos y Materiales de Estudio
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Archivos, guías y enlaces organizados por tema para complementar tu aprendizaje.
        </p>
      </div>

      {/* Resources grouped by Theme */}
      {!hasContent ? (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "3rem",
          textAlign: "center",
          color: "#6c757d"
        }}>
          <BookOpen size={44} style={{ margin: "0 auto 0.75rem auto", opacity: 0.4 }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#333", marginBottom: "0.25rem" }}>
            No hay materiales disponibles en esta asignatura
          </h3>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
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
