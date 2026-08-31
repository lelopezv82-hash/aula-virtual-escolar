import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import ExportButtons from "./ExportButtons";
import LateSubmissionManager from "./LateSubmissionManager";
import GDriveVisibilityToggle from "@/components/GDriveVisibilityToggle";
import QuestionEditor from "./QuestionEditor";
import TaskSubmissionsClient from "./TaskSubmissionsClient";

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
      assignedStudents: {
        select: {
          id: true,
          name: true,
          username: true,
          groupName: true
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

  // Get students who belong to any of the task's groups OR are specifically assigned
  const studentOrConditions: any[] = [];
  if (task.groups && task.groups.length > 0) {
    studentOrConditions.push({
      groupId: { in: task.groups.map(g => g.id) }
    });
  }
  if (task.assignedStudents && task.assignedStudents.length > 0) {
    studentOrConditions.push({
      id: { in: task.assignedStudents.map(s => s.id) }
    });
  }

  const allStudents = await prisma.user.findMany({ 
    where: {
      role: "STUDENT",
      ...(studentOrConditions.length > 0 ? { OR: studentOrConditions } : {})
    },
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
          <Link href="/docente/contenido" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
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
              {task.isExternal ? (
                <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>📁 Entrega en clase</span>
              ) : (
                <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#f0f9ff", color: "#0369a1", border: "1px solid #b9e6fe" }}>💻 Entrega en plataforma</span>
              )}
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

      {/* Interactive Submissions Table with Multi-Student Prórroga Selection */}
      <TaskSubmissionsClient
        task={{
          id: task.id,
          title: task.title,
          type: task.type,
          isExternal: task.isExternal,
          period: task.period,
          theme: task.theme,
          courseName: task.course.name,
          allowLateSubmission: task.allowLateSubmission
        }}
        groups={task.groups.map(g => ({
          id: g.id,
          name: g.name,
          grade: g.grade ? { name: g.grade.name } : null
        }))}
        students={allStudents.map(s => ({
          id: s.id,
          name: s.name,
          groupId: s.groupId
        }))}
        submissions={task.submissions.map(s => ({
          id: s.id,
          studentId: s.studentId,
          status: s.status,
          grade: s.grade,
          feedback: s.feedback,
          fileUrl: s.fileUrl,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          allowLateSubmission: s.allowLateSubmission,
          lateSubmissionUntil: s.lateSubmissionUntil ? s.lateSubmissionUntil.toISOString() : null,
          gdriveEmail: s.gdriveEmail
        }))}
      />
    </div>
  );
}
