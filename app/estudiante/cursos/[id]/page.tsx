import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft, BookOpen, Download, ClipboardList, Clock, CheckCircle, AlertCircle, FileText, Link as LinkIcon, HelpCircle } from "lucide-react";
import Link from "next/link";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default async function EstudianteCursoDetallePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>, 
  searchParams: Promise<{ periodo?: string }> 
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const selectedPeriodParam = resolvedSearchParams.periodo;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") return null;
    user = payload;
  } catch {
    return null;
  }

  const studentId = user.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  const course = await prisma.course.findUnique({
    where: { id: resolvedParams.id },
    include: {
      teacher: true,
      resources: {
        orderBy: { createdAt: "desc" }
      },
      tasks: {
        orderBy: { dueDate: "asc" },
        include: {
          submissions: {
            where: { studentId }
          }
        }
      }
    }
  });

  if (!course) {
    return (
      <div className="animate-fade-in">
        <div className="alert alert-danger">El curso no existe o no tienes acceso a él.</div>
        <Link href="/estudiante" className="btn btn-secondary mt-4">
          <ArrowLeft size={16} /> Volver a Mis Cursos
        </Link>
      </div>
    );
  }

  // Get active periods
  const activePeriods: string[] = [];
  if (course.period1Active !== false) activePeriods.push("Periodo 1");
  if (course.period2Active !== false) activePeriods.push("Periodo 2");
  if (course.period3Active !== false) activePeriods.push("Periodo 3");
  if (course.period4Active !== false) activePeriods.push("Periodo 4");

  const currentPeriod = activePeriods.includes(selectedPeriodParam || "")
    ? (selectedPeriodParam as string)
    : (activePeriods[0] || "");

  // Filter tasks & resources by selected period, active status, and group assignment
  const filteredTasks = course.tasks.filter(t => 
    t.period === currentPeriod && 
    t.active !== false && 
    (t.groupId === null || t.groupId === studentGroupId)
  );
  const filteredResources = course.resources.filter(r => 
    r.period === currentPeriod && 
    r.active !== false && 
    (r.groupId === null || r.groupId === studentGroupId)
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/estudiante" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <p className="text-muted text-sm">Prof. {course.teacher.name} • {course.teacher.username}</p>
        </div>
      </div>

      {/* Period Selector Tabs */}
      {activePeriods.length > 0 ? (
        <div className="flex gap-2 mb-6 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
          {activePeriods.map(p => {
            const isSelected = p === currentPeriod;
            return (
              <Link
                key={p}
                href={`/estudiante/cursos/${course.id}?periodo=${encodeURIComponent(p)}`}
                className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors"
                style={{
                  borderBottom: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
                  color: isSelected ? 'var(--primary-color)' : 'var(--text-secondary)',
                  background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                }}
              >
                {p}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="alert alert-warning mb-6">
          El docente no ha activado ningún periodo académico para este curso.
        </div>
      )}

      {activePeriods.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }} className="flex-col md:flex-row">
          {/* Main Column: Tasks */}
          <div className="flex flex-col gap-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-2">Descripción del Curso</h2>
              <p style={{ color: "var(--text-secondary)" }}>
                {course.description || "Este curso no tiene una descripción detallada asignada por el docente."}
              </p>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ClipboardList size={22} className="text-blue-600" />
                Tareas - {currentPeriod}
              </h2>

              {filteredTasks.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <HelpCircle size={40} className="mx-auto mb-3 opacity-40" />
                  <p>No hay tareas asignadas para este periodo todavía.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredTasks.map(task => {
                    const submission = task.submissions[0];
                    const isSubmitted = submission && submission.status !== "PENDING";
                    const isGraded = submission && submission.status === "GRADED";
                    const isOverdue = new Date(task.dueDate) < new Date() && !isSubmitted;

                    return (
                      <div
                        key={task.id}
                        className="p-4 rounded-lg flex justify-between items-center flex-wrap gap-4 border"
                        style={{
                          background: "var(--bg-secondary)",
                          borderColor: "var(--border-color)",
                          transition: "transform var(--transition-fast)"
                        }}
                      >
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isGraded ? (
                              <span className="badge badge-success flex items-center gap-1">
                                <CheckCircle size={12} /> Nota: {submission.grade?.toFixed(1)}
                              </span>
                            ) : isSubmitted ? (
                              <span className="badge badge-info">Entregada</span>
                            ) : isOverdue ? (
                              <span className="badge badge-danger flex items-center gap-1">
                                <AlertCircle size={12} /> Retrasada
                              </span>
                            ) : (
                              <span className="badge badge-warning flex items-center gap-1">
                                <Clock size={12} /> Pendiente
                              </span>
                            )}
                            <span className="text-xs text-muted">
                              Vence: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                            {task.weight !== undefined && task.weight !== null && task.weight > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                Peso: {task.weight}%
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-base">{task.title}</h3>
                          <p className="text-sm text-muted truncate mt-0.5">{task.description || "Sin descripción"}</p>
                        </div>

                        <div>
                          <Link href={`/estudiante/tareas/${task.id}`} className="btn btn-secondary text-sm">
                            {isSubmitted ? "Ver Entrega" : "Resolver Tarea"}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Resources */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen size={22} className="text-emerald-600" />
              Recursos - {currentPeriod}
            </h2>

            {filteredResources.length === 0 ? (
              <div className="text-center py-10 text-muted">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p>No hay materiales de estudio subidos para este periodo.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {filteredResources.map(resource => (
                    <div
                      key={resource.id}
                      className="p-2.5 rounded-md flex items-center gap-3 border"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border-color)"
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>{TYPE_ICONS[resource.type] || "📁"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs truncate" title={resource.title}>{resource.title}</p>
                        <p className="text-[10px] text-muted">{resource.type}</p>
                      </div>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        style={{ color: "var(--primary-color)" }}
                        title={resource.type === "LINK" ? "Abrir enlace" : "Descargar recurso"}
                      >
                        {resource.type === "LINK" ? <LinkIcon size={14} /> : <Download size={14} />}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
