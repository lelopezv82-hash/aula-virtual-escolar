import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function CalificacionesEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const submissions = await prisma.submission.findMany({
    where: { studentId },
    include: { task: { include: { course: true } } },
    orderBy: { updatedAt: "desc" }
  });

  const graded = submissions.filter(s => s.status === "GRADED");
  const avg = graded.length > 0
    ? graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length
    : null;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Calificaciones</h1>
        <p>Consulta tus notas y retroalimentación de cada tarea entregada.</p>
      </div>

      {/* Summary card */}
      {avg !== null && (
        <div className="card mb-6" style={{ borderLeft: "4px solid var(--primary-color)", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ textAlign: "center", minWidth: "80px" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: avg >= 3 ? "var(--success)" : "var(--danger)" }}>
              {avg.toFixed(1)}
            </div>
            <div className="text-muted text-xs">Promedio General</div>
          </div>
          <div>
            <p className="font-semibold">Escala colombiana (0.0 – 5.0)</p>
            <p className="text-sm text-muted">{graded.length} tarea(s) calificadas de {submissions.length} entregadas</p>
          </div>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>Aún no has entregado ninguna tarea.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map(sub => {
            const isGraded = sub.status === "GRADED";
            const isPending = sub.status === "SUBMITTED";
            const gradeColor = isGraded
              ? sub.grade! >= 3 ? "var(--success)" : "var(--danger)"
              : "var(--text-muted)";

            return (
              <div key={sub.id} className="card flex flex-col md:flex-row md:items-center gap-4"
                style={{ borderLeft: `4px solid ${isGraded ? gradeColor : "var(--border-color)"}` }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {sub.task.course.name}
                    </span>
                    {isGraded && <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Calificada</span>}
                    {isPending && <span className="badge badge-info flex items-center gap-1"><Clock size={12} /> En revisión</span>}
                  </div>
                  <h3 className="font-bold text-lg">{sub.task.title}</h3>
                  {isGraded && sub.feedback && (
                    <div className="mt-2 p-3 rounded-lg text-sm italic" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", borderLeft: "3px solid var(--primary-color)" }}>
                      💬 &quot;{sub.feedback}&quot;
                    </div>
                  )}
                  {!isGraded && (
                    <p className="text-sm text-muted mt-1">Tu docente aún no ha calificado esta entrega.</p>
                  )}
                </div>

                <div style={{ minWidth: "100px", textAlign: "center" }}>
                  {isGraded ? (
                    <>
                      <div style={{ fontSize: "2.5rem", fontWeight: 800, color: gradeColor, lineHeight: 1 }}>
                        {sub.grade?.toFixed(1)}
                      </div>
                      <div className="text-muted text-xs mt-1">/ 5.0</div>
                    </>
                  ) : (
                    <div className="text-muted text-sm">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
