import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft, Download, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import ExportButtons from "./ExportButtons";
import LateSubmissionManager from "./LateSubmissionManager";
import StudentLateSubmissionToggle from "./StudentLateSubmissionToggle";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import GDriveVisibilityToggle from "@/components/GDriveVisibilityToggle";
import ResetSubmissionButton from "./ResetSubmissionButton";
import ResetAllSubmissionsButton from "./ResetAllSubmissionsButton";
import QuestionEditor from "./QuestionEditor";

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
      groups: {
        include: {
          grade: true
        }
      },
      submissions: {
        include: { student: true }
      }
    }
  });

  if (!task || task.course.teacherId !== teacherId) {
    return <div className="alert alert-danger">No tienes acceso a esta tarea.</div>;
  }

  const questions = await prisma.question.findMany({
    where: { taskId: resolvedParams.id },
    orderBy: { order: 'asc' },
    include: {
      options: {
        orderBy: { id: 'asc' }
      }
    }
  });

  // Get students who belong to any of the task's groups
  const studentWhereClause: any = { role: "STUDENT" };
  if (task.groups && task.groups.length > 0) {
    studentWhereClause.groupId = {
      in: task.groups.map(g => g.id)
    };
  }
  const allStudents = await prisma.user.findMany({ 
    where: studentWhereClause,
    orderBy: { name: 'asc' }
  });

  return (
    <div className="animate-fade-in printable-area">
      {/* Print-Only Header */}
      <div className="print-only mb-6">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--primary-color)", paddingBottom: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--primary-color)", margin: 0 }}>Aula Virtual</h1>
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
          <Link href="/docente/contenido" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Entregas: {task.title}</h1>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs mt-1.5 text-muted font-medium">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Periodo: {task.period?.replace(/periodo\s*/i, "") || "Sin Periodo"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grado: {Array.from(new Set(task.groups.map(g => g.grade?.name))).filter(Boolean).join(", ") || "Sin Grado"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grupo: {task.groups.map(g => `${g.grade?.name}-${g.name}`).join(", ") || "Sin Grupo"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Asignatura: {task.course.name}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Tema: {task.theme || "Sin Tema"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Título: {task.title}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <GDriveVisibilityToggle context="task_details" />
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
            period={task.period?.replace(/periodo\s*/i, "")}
            gradeName={task.groups[0]?.grade?.name}
            groupName={task.groups.map(g => g.name).join(", ")}
            theme={task.theme}
          />
        </div>
      </div>

      <LateSubmissionManager
        taskId={task.id}
        initialTaskAllowLate={task.allowLateSubmission}
        initialTaskLateUntil={task.lateSubmissionUntil ? new Date(task.lateSubmissionUntil).toISOString() : null}
        students={allStudents.map(s => {
          const sub = task.submissions.find(sub => sub.studentId === s.id);
          return {
            id: s.id,
            name: s.name,
            allowLateSubmission: sub ? sub.allowLateSubmission : false,
            lateSubmissionUntil: sub && sub.lateSubmissionUntil ? new Date(sub.lateSubmissionUntil).toISOString() : null
          };
        })}
      />

      {task.type === "EXAM" && (
        <QuestionEditor taskId={task.id} initialQuestions={questions} />
      )}

      {task.groups && task.groups.length > 0 ? (
        task.groups.map(group => {
          const groupStudents = allStudents.filter(s => s.groupId === group.id);
          
          return (
            <div key={group.id} className="card w-full mb-6">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="text-lg font-bold">Estado de las entregas: Grado {group.grade?.name || "Sin Grado"} - Grupo {group.name}</h2>
                  {task.type === "EXAM" && (
                    <ResetAllSubmissionsButton
                      taskId={task.id}
                      groupId={group.id}
                      groupName={`${group.grade?.name || ""}-${group.name}`}
                      studentCount={groupStudents.length}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs mt-1.5 text-muted font-medium no-print">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Periodo: {task.period?.replace(/periodo\s*/i, "") || "Sin Periodo"}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grado: {group.grade?.name || "Sin Grado"}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grupo: {group.name}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Asignatura: {task.course.name}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Tema: {task.theme || "Sin Tema"}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Título: {task.title}</span>
                </div>
              </div>

              {groupStudents.length === 0 ? (
                <p className="text-muted text-sm italic p-4 text-center">No hay estudiantes registrados en este grupo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th className="py-2 px-4 font-medium" style={{ paddingLeft: '16px' }}>Estudiante</th>
                        <th className="py-2 px-4 font-medium">Estado</th>
                        <th className="py-2 px-4 font-medium text-center">Entrega Tardía</th>
                        <th className="py-2 px-4 font-medium">Fecha de Envío</th>
                        <th className="py-2 px-4 font-medium text-right no-print">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStudents.map(student => {
                        const submission = task.submissions.find(s => s.studentId === student.id);
                        const isSubmitted = submission && submission.status !== "PENDING";
                        const isGraded = submission && submission.status === "GRADED";
                        const allowLate = submission ? submission.allowLateSubmission : false;
                        
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td className="py-3 px-4" style={{ paddingLeft: '16px' }}>{student.name}</td>
                            <td className="py-3 px-4">
                              {isGraded ? (
                                <span className="badge badge-success flex w-fit items-center gap-1"><CheckCircle size={12}/> Calificada: {submission.grade}</span>
                              ) : isSubmitted ? (
                                <span className="badge badge-info">Entregada</span>
                              ) : (
                                <span className="badge badge-warning flex w-fit items-center gap-1"><Clock size={12}/> Pendiente</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StudentLateSubmissionToggle
                                taskId={task.id}
                                studentId={student.id}
                                studentName={student.name}
                                initialAllowLate={allowLate}
                                initialLateUntil={submission?.lateSubmissionUntil ? new Date(submission.lateSubmissionUntil).toISOString() : null}
                                disabled={task.allowLateSubmission}
                              />
                            </td>
                            <td className="py-3 px-4 text-muted">
                              {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
                            </td>
                            <td className="py-3 px-4 text-right no-print">
                              {submission ? (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex justify-end gap-2">
                                    {task.type !== "EXAM" && submission.fileUrl && (
                                      <a href={submission.fileUrl} target="_blank" download className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1">
                                        <Download size={14} /> Archivo
                                      </a>
                                    )}
                                    {task.type === "EXAM" && (
                                      <ResetSubmissionButton 
                                        taskId={task.id}
                                        studentId={student.id}
                                        studentName={student.name}
                                      />
                                    )}
                                    {(task.type !== "EXAM" || isSubmitted) && (
                                      <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="btn btn-primary text-sm px-2 py-1">
                                        Calificar
                                      </Link>
                                    )}
                                  </div>
                                  {submission.gdriveEmail && (
                                    <GDriveEmailDisplay email={submission.gdriveEmail} context="task_details" />
                                  )}
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
              )}
            </div>
          );
        })
      ) : (
        <div className="card w-full">
          <div className="mb-4 no-print">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-bold">Estado de las entregas</h2>
              {task.type === "EXAM" && (
                <ResetAllSubmissionsButton
                  taskId={task.id}
                  studentCount={allStudents.length}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs mt-1.5 text-muted font-medium">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Periodo: {task.period?.replace(/periodo\s*/i, "") || "Sin Periodo"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grado: Sin Grado</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Grupo: Sin Grupo</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Asignatura: {task.course.name}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Tema: {task.theme || "Sin Tema"}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Título: {task.title}</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-4 font-medium" style={{ paddingLeft: '16px' }}>Estudiante</th>
                  <th className="py-2 px-4 font-medium">Estado</th>
                  <th className="py-2 px-4 font-medium text-center">Entrega Tardía</th>
                  <th className="py-2 px-4 font-medium">Fecha de Envío</th>
                  <th className="py-2 px-4 font-medium text-right no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allStudents.map(student => {
                  const submission = task.submissions.find(s => s.studentId === student.id);
                  const isSubmitted = submission && submission.status !== "PENDING";
                  const isGraded = submission && submission.status === "GRADED";
                  const allowLate = submission ? submission.allowLateSubmission : false;
                  
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="py-3 px-4" style={{ paddingLeft: '16px' }}>{student.name}</td>
                      <td className="py-3 px-4">
                        {isGraded ? (
                          <span className="badge badge-success flex w-fit items-center gap-1"><CheckCircle size={12}/> Calificada: {submission.grade}</span>
                        ) : isSubmitted ? (
                          <span className="badge badge-info">Entregada</span>
                        ) : (
                          <span className="badge badge-warning flex w-fit items-center gap-1"><Clock size={12}/> Pendiente</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StudentLateSubmissionToggle
                          taskId={task.id}
                          studentId={student.id}
                          studentName={student.name}
                          initialAllowLate={allowLate}
                          initialLateUntil={submission?.lateSubmissionUntil ? new Date(submission.lateSubmissionUntil).toISOString() : null}
                          disabled={task.allowLateSubmission}
                        />
                      </td>
                      <td className="py-3 px-4 text-muted">
                        {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right no-print">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex justify-end gap-2">
                            {submission && task.type !== "EXAM" && submission.fileUrl && (
                              <a href={submission.fileUrl} target="_blank" download className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1">
                                <Download size={14} /> Archivo
                              </a>
                            )}
                            {task.type === "EXAM" && (
                              <ResetSubmissionButton 
                                taskId={task.id}
                                studentId={student.id}
                                studentName={student.name}
                                hasSubmission={!!submission}
                              />
                            )}
                            {submission && (task.type !== "EXAM" || isSubmitted) && (
                              <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="btn btn-primary text-sm px-2 py-1">
                                Calificar
                              </Link>
                            )}
                            {!submission && task.type !== "EXAM" && (
                              <span className="text-muted text-sm">Sin entrega</span>
                            )}
                          </div>
                          {submission?.gdriveEmail && (
                            <GDriveEmailDisplay email={submission.gdriveEmail} context="task_details" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
