import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { BookOpen, Download, Link as LinkIcon } from "lucide-react";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄",
  WORD: "📝",
  DOC: "📝",
  DOCX: "📝",
  PPT: "📊",
  PPTX: "📊",
  EXCEL: "📈",
  XLS: "📈",
  XLSX: "📈",
  IMAGE: "🖼️",
  PNG: "🖼️",
  JPG: "🖼️",
  JPEG: "🖼️",
  VIDEO: "🎬",
  LINK: "🔗",
  ENLACE: "🔗",
  DRIVE: "📁",
  ZIP: "📦",
  RAR: "📦"
};

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
    include: { groups: true },
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
      resources: true
    },
    orderBy: { createdAt: "desc" }
  });

  type SimpleResource = {
    id: string;
    title: string;
    type: string;
    url: string;
    createdAt: Date;
  };

  const unifiedList: SimpleResource[] = [];
  const seenUrls = new Set<string>();

  // Add standalone resources
  for (const r of standaloneResources) {
    if (r.url && !seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      const cleanType = getCleanFileType(r.url, r.type);
      unifiedList.push({
        id: r.id,
        title: r.title,
        type: cleanType,
        url: r.url,
        createdAt: r.createdAt
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
        createdAt: t.createdAt
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
          createdAt: res.createdAt
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <BookOpen size={22} className="text-orange-600" />
          Recursos y Materiales de Estudio
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Archivos, guías y enlaces compartidos para apoyar tu aprendizaje.
        </p>
      </div>

      {/* Direct Resources List */}
      {unifiedList.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "10px",
          padding: "3rem",
          textAlign: "center",
          color: "#6c757d",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          <BookOpen size={44} style={{ margin: "0 auto 0.75rem auto", opacity: 0.4 }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#333", marginBottom: "0.25rem" }}>
            No hay materiales disponibles en esta asignatura
          </h3>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            Los documentos, guías de actividades y enlaces que asigne el docente aparecerán aquí.
          </p>
        </div>
      ) : (
        <div style={{
          background: "#ffffff",
          border: "1px solid #dee2e6",
          borderRadius: "10px",
          overflow: "hidden",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          {unifiedList.map((resource) => {
            const isLink = resource.type.toUpperCase() === "LINK" ||
              resource.type.toUpperCase() === "ENLACE" ||
              resource.type.toUpperCase() === "DRIVE" ||
              resource.url.startsWith("http");

            const iconChar = TYPE_ICONS[resource.type.toUpperCase()] || "📄";

            return (
              <div
                key={resource.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.85rem 1.15rem",
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                  background: "#fcfcfd"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                    flexShrink: 0
                  }}>
                    {iconChar}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        color: "#1e293b",
                        lineHeight: 1.4,
                        wordBreak: "break-word"
                      }}
                      title={resource.title}
                    >
                      {resource.title}
                    </h4>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.45rem",
                      padding: "0.5rem 0.95rem",
                      borderRadius: "6px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      textDecoration: "none",
                      border: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                    title={isLink ? "Abrir enlace" : "Descargar archivo"}
                  >
                    {isLink ? <LinkIcon size={14} color="#ffffff" /> : <Download size={14} color="#ffffff" />}
                    <span style={{ color: "#ffffff" }}>{isLink ? "Abrir enlace" : "Descargar"}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
