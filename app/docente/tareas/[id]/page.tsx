import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft, Download, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import ExportButtons from "./ExportButtons";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareaEntregasPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    include: {
      course: true,
      submissions: {
        include: { student: true }
      }
    }
  });

  if (!task || task.course.teacherId !== teacherId) {
    return <div className="alert alert-danger">No tienes acceso a esta tarea.</div>;
  }

  // Get all students in this course (for MVP, we fetch all students since courses don't have explicit enrollment yet)
  const allStudents = await prisma.user.findMany({ where: { role: "STUDENT" } });

  return (
    <div className="animate-fade-in printable-area">
      {/* Print-Only Header */}
      <div className="print-only mb-6">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--primary-color)", paddingBottom: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--primary-color)", margin: 0 }}>Aula Virtual Escolar</h1>
            <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>Reporte Oficial de Calificaciones</p>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            <p style={{ margin: 0 }}>Fecha del reporte: {new Date().toLocaleDateString()}</p>
            <p style={{ margin: "0.25rem 0 0 0" }}>Docente: {payload.name as string}</p>
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem", padding: "1rem", background: "var(--bg-primary)", borderRadius: "var(--radius-md)" }}>
          <div><strong>Curso:</strong> {task.course.name}</div>
          <div><strong>Tarea:</strong> {task.title}</div>
          <div><strong>Fecha Límite:</strong> {new Date(task.dueDate).toLocaleDateString()}</div>
          <div><strong>Total Alumnos:</strong> {allStudents.length}</div>
        </div>
      </div>

      {/* Normal Screen Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4 no-print">
        <div className="flex items-center gap-4">
          <Link href="/docente/tareas" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Entregas: {task.title}</h1>
            <p className="text-muted text-sm">{task.course.name} - Vence: {new Date(task.dueDate).toLocaleDateString()}</p>
          </div>
        </div>
        
        <ExportButtons 
          taskTitle={task.title} 
          courseName={task.course.name} 
          dueDate={new Date(task.dueDate).toLocaleDateString()}
          students={allStudents.map(s => ({ id: s.id, name: s.name }))}
          submissions={task.submissions.map(s => ({
            id: s.id,
            studentId: s.studentId,
            status: s.status,
            grade: s.grade,
            feedback: s.feedback,
            submittedAt: s.submittedAt
          }))}
        />
      </div>

      <div className="card w-full">
        <h2 className="text-lg font-bold mb-4 no-print">Estado de las entregas</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th className="py-2 px-4 font-medium">Estudiante</th>
                <th className="py-2 px-4 font-medium">Estado</th>
                <th className="py-2 px-4 font-medium">Fecha de Envío</th>
                <th className="py-2 px-4 font-medium text-right no-print">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {allStudents.map(student => {
                const submission = task.submissions.find(s => s.studentId === student.id);
                const isSubmitted = submission && submission.status !== "PENDING";
                const isGraded = submission && submission.status === "GRADED";
                
                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="py-3 px-4">{student.name}</td>
                    <td className="py-3 px-4">
                      {isGraded ? (
                        <span className="badge badge-success flex w-fit items-center gap-1"><CheckCircle size={12}/> Calificada: {submission.grade}</span>
                      ) : isSubmitted ? (
                        <span className="badge badge-info">Entregada</span>
                      ) : (
                        <span className="badge badge-warning flex w-fit items-center gap-1"><Clock size={12}/> Pendiente</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      {isSubmitted ? (
                        <div className="flex justify-end gap-2">
                          <a href={submission.fileUrl || "#"} target="_blank" download className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1">
                            <Download size={14} /> Archivo
                          </a>
                          <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="btn btn-primary text-sm px-2 py-1">
                            Calificar
                          </Link>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">Sin entrega</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
