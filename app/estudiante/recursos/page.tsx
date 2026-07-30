import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { BookOpen, Download, Link as LinkIcon, AlertCircle } from "lucide-react";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default async function RecursosEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  if (!studentGroupId) {
    return (
      <div className="animate-fade-in">
        <div className="dashboard-header">
          <h1>Materiales de Clase</h1>
          <p>Consulta los recursos y materiales de estudio compartidos por tus docentes.</p>
        </div>
        <div className="card text-center py-10 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No estás asignado a ningún grado o grupo todavía.</p>
        </div>
      </div>
    );
  }

  // Fetch active resources assigned to student's group
  const resources = await prisma.resource.findMany({
    where: {
      active: true,
      course: {
        groups: {
          some: {
            id: studentGroupId
          }
        }
      },
      OR: [
        { groups: { none: {} } },
        { groups: { some: { id: studentGroupId } } }
      ]
    },
    include: {
      course: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  activePeriodsFromDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);

  const now = new Date();
  const activeResources = resources.filter(r => 
    (!r.period || activePeriodNames.includes(r.period)) && 
    (!r.publishAt || new Date(r.publishAt) <= now)
  );

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Materiales de Clase</h1>
        <p>Consulta los recursos y materiales de estudio compartidos por tus docentes para cada periodo.</p>
      </div>

      {activeResources.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p>No hay materiales de clase compartidos en periodos académicos activos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[...activePeriodNames, "Otros"].map(periodName => {
            const periodResources = activeResources.filter(r => {
              if (periodName === "Otros") {
                return !r.period || !activePeriodNames.includes(r.period);
              }
              return r.period === periodName;
            });

            if (periodResources.length === 0) return null;

            return (
              <div key={periodName} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h2 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  {periodName}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {periodResources.map(resource => (
                    <div key={resource.id} className="card flex items-center gap-4" style={{ background: "var(--bg-primary)" }}>
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800" style={{ fontSize: "1.5rem" }}>
                        {TYPE_ICONS[resource.type] || "📁"}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-600 mb-1 inline-block">
                          {resource.course.name}
                        </span>
                        <h3 className="font-bold text-sm truncate" title={resource.title}>
                          {resource.title}
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          {resource.type} {resource.theme ? `• ${resource.theme}` : ""}
                        </p>
                      </div>

                      <div>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary p-2 rounded-full hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
                          style={{ color: "var(--primary-color)" }}
                          title={resource.type === "LINK" ? "Abrir enlace" : "Descargar"}
                        >
                          {resource.type === "LINK" ? <LinkIcon size={16} /> : <Download size={16} />}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
