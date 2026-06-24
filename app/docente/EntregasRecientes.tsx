"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Clock, X, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import EvidenciaBotones from "@/app/estudiante/examenes/EvidenciaBotones";

interface SubItem {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  taskTitle: string;
  courseName: string;
  grade: number | null;
  status: string;
  updatedAt: string;
  feedback: string | null;
  fileUrl: string | null;
  submittedAt: string | null;
  isExam: boolean;
  isGoogleForm: boolean;
  answers?: any;
}

export default function EntregasRecientes({ submissions }: { submissions: SubItem[] }) {
  if (submissions.length === 0) {
    return (
      <div className="p-4 border rounded-md text-center text-muted text-sm" style={{ borderColor: "var(--border-color)" }}>
        Aún no hay entregas de estudiantes para calificar o mostrar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map(sub => (
        <SubRow key={sub.id} sub={sub} />
      ))}
    </div>
  );
}

function SubRow({ sub }: { sub: SubItem }) {
  const isGraded = sub.status === "GRADED";

  return (
    <div className="flex justify-between items-center p-3 rounded-lg border flex-wrap gap-3" style={{
      background: "var(--bg-primary)",
      borderColor: "var(--border-color)"
    }}>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm">{sub.studentName}</span>
          <span className="text-xs text-muted">• {sub.courseName}</span>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sub.isExam ? "Respondió el examen" : "Entregó la tarea"}:{" "}
          <strong style={{ color: "var(--text-primary)" }}>{sub.taskTitle}</strong>
        </p>
        <span className="text-[10px] text-muted">
          {sub.updatedAt ? new Date(sub.updatedAt).toLocaleString("es-CO") : ""}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isGraded ? (
          <span className="badge badge-success flex items-center gap-1">
            <CheckCircle size={10} /> Nota: {sub.grade}
          </span>
        ) : (
          <span className="badge badge-warning flex items-center gap-1">
            <Clock size={10} /> Por Calificar
          </span>
        )}

        {sub.isExam && sub.submittedAt ? (
          <EvidenciaBotones
            exam={{ id: sub.taskId, title: sub.taskTitle, course: { name: sub.courseName } }}
            submission={{
              grade: sub.grade,
              status: sub.status,
              fileUrl: sub.fileUrl,
              submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : null,
              feedback: sub.feedback,
              studentName: sub.studentName,
              answers: sub.answers,
            }}
            isGoogleForm={sub.isGoogleForm}
            label="Ver Examen"
            variant="secondary"
          />
        ) : (
          <Link href={`/docente/tareas/${sub.taskId}`} className="btn btn-secondary text-xs px-2 py-1">
            Ver Tarea
          </Link>
        )}
      </div>
    </div>
  );
}
