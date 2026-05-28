import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";


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

  const isPeriodActive = (period: string | null, course: any) => {
    if (!period) return true;
    if (period === "Periodo 1") return course.period1Active !== false;
    if (period === "Periodo 2") return course.period2Active !== false;
    if (period === "Periodo 3") return course.period3Active !== false;
    if (period === "Periodo 4") return course.period4Active !== false;
    return true;
  };

  const activeSubmissions = submissions.filter(sub => isPeriodActive(sub.task.period, sub.task.course));
  const graded = activeSubmissions.filter(s => s.status === "GRADED");
  const avg = graded.length > 0
    ? graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length
    : null;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Mis Calificaciones</h1>
        <p>Consulta tus notas y retroalimentación agrupadas por periodos académicos.</p>
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
            <p className="text-sm text-muted">{graded.length} tarea(s) calificadas de {activeSubmissions.length} activas entregadas</p>
          </div>
        </div>
      )}

      {activeSubmissions.length === 0 ? (
        <div className="card text-center py-10 text-muted">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No tienes entregas calificadas en periodos académicos activos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4", "Otros"].map(periodName => {
            const periodSubs = activeSubmissions.filter(sub => {
              if (periodName === "Otros") {
                return !sub.task.period || !["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].includes(sub.task.period);
              }
              return sub.task.period === periodName;
            });

            if (periodSubs.length === 0) return null;

            return (
              <div key={periodName} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h2 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  {periodName}
                </h2>
                
                <div className="flex flex-col gap-4">
                  {periodSubs.map(sub => {
                    const isGraded = sub.status === "GRADED";
                    const isPending = sub.status === "SUBMITTED";
                    const gradeColor = isGraded
                      ? sub.grade! >= 3 ? "var(--success)" : "var(--danger)"
                      : "var(--text-muted)";

                    return (
                      <div key={sub.id} className="card flex flex-col md:flex-row md:items-center gap-4"
                        style={{ background: "var(--bg-primary)", borderLeft: `4px solid ${isGraded ? gradeColor : "var(--border-color)"}` }}>
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
                            <div className="mt-2 p-3 rounded-lg text-sm italic" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", borderLeft: "3px solid var(--primary-color)" }}>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
