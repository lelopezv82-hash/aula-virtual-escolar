import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { BookOpen, Download, Link as LinkIcon } from "lucide-react";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

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

  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = periodsDb.map(p => p.name);

  const now = new Date();

  const resources = await prisma.resource.findMany({
    where: {
      courseId: id,
      active: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      groups: studentGroupId ? { some: { id: studentGroupId } } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { groups: true },
  });

  // Filter resources to display
  const filtered = resources.filter(r => {
    if (periodo) return r.period === periodo;
    return !r.period || activePeriodNames.includes(r.period);
  });

  const allEmpty = filtered.length === 0;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">
        Recursos{periodo ? ` — ${periodo}` : ""}
      </h2>

      {allEmpty ? (
        <div className="card text-center py-12 text-muted">
          <BookOpen size={44} className="mx-auto mb-4 opacity-40" />
          <p>No hay materiales disponibles{periodo ? ` para ${periodo}` : ""} en esta asignatura.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(resource => (
            <div
              key={resource.id}
              className="card flex items-center gap-4"
              style={{ background: "var(--bg-primary)", padding: "0.75rem 1rem" }}
            >
              <span style={{ fontSize: "1.5rem" }}>{TYPE_ICONS[resource.type] || "📁"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" title={resource.title}>{resource.title}</p>
                <p className="text-xs text-muted">{resource.type}{resource.theme ? ` • ${resource.theme}` : ""}</p>
              </div>
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary p-2 rounded-full inline-flex items-center justify-center"
                style={{ color: "var(--primary-color)" }}
                title={resource.type === "LINK" ? "Abrir enlace" : "Descargar"}
              >
                {resource.type === "LINK" ? <LinkIcon size={16} /> : <Download size={16} />}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
