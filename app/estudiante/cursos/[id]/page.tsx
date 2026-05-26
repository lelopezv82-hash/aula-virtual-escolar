import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft, BookOpen, Download, ClipboardList, Clock, CheckCircle, AlertCircle, FileText, Link as LinkIcon, HelpCircle } from "lucide-react";
import Link from "next/link";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default async function EstudianteCursoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }} className="flex-col md:flex-row">
        {/* Main Column: Tasks & Details */}
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
              Tareas del Curso
            </h2>

            {course.tasks.length === 0 ? (
              <div className="text-center py-10 text-muted">
                <HelpCircle size={40} className="mx-auto mb-3 opacity-40" />
                <p>No se han asignado tareas para este curso todavía.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {course.tasks.map(task => {
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
            Recursos del Curso
          </h2>

          {course.resources.length === 0 ? (
            <div className="text-center py-10 text-muted">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p>El docente no ha subido material de estudio aún.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {course.resources.map(resource => (
                <div
                  key={resource.id}
                  className="p-3 rounded-lg flex items-center gap-3"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>{TYPE_ICONS[resource.type] || "📁"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" title={resource.title}>{resource.title}</p>
                    <p className="text-xs text-muted">{resource.type}</p>
                  </div>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    style={{ color: "var(--primary-color)" }}
                    title={resource.type === "LINK" ? "Abrir enlace" : "Descargar recurso"}
                  >
                    {resource.type === "LINK" ? <LinkIcon size={16} /> : <Download size={16} />}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
