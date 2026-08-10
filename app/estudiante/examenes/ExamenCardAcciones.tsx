"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";
import EvidenciaBotones from "./EvidenciaBotones";

interface ExamenCardAccionesProps {
  examId: string;
  examTitle: string;
  courseName: string;
  attachmentUrl: string | null;
  dueDate: string;
  duration: number | null;
  allowLateSubmission: boolean;
  lateSubmissionUntil: string | null;
  submission: {
    status: string;
    grade: number | null;
    feedback: string | null;
    fileUrl: string | null;
    submittedAt: Date | null;
    startedAt: Date | null;
    allowLateSubmission: boolean;
    lateSubmissionUntil: Date | null;
    attempt: number;
    unlockedAnswers: boolean;
    answers?: any;
  } | null;
  studentName: string;
  isExternal?: boolean;
}

export default function ExamenCardAcciones({
  examId,
  examTitle,
  courseName,
  attachmentUrl,
  dueDate,
  duration,
  allowLateSubmission,
  lateSubmissionUntil,
  submission,
  studentName,
  isExternal,
}: ExamenCardAccionesProps) {
  const [now, setNow] = useState(new Date());

  // Keep "now" updated so timers work correctly
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  const isGoogleForm = !!(
    attachmentUrl &&
    (attachmentUrl.includes("docs.google.com/forms") ||
      attachmentUrl.includes("forms.gle"))
  );

  const { activeDeadline, hasExtension, isClosed, isLate } = getTaskDeadlineStatus(
    { dueDate, allowLateSubmission, lateSubmissionUntil, type: "EXAM" },
    submission
  );

  const isTimerExpired =
    submission?.startedAt &&
    duration &&
    new Date(submission.startedAt).getTime() + duration * 60 * 1000 + 30000 <
      now.getTime() &&
    !submission.allowLateSubmission;

  const virtualSubmission =
    ((!submission || submission.status === "PENDING") &&
      isClosed &&
      isGoogleForm) ||
    (submission &&
      submission.status === "PENDING" &&
      isTimerExpired &&
      isGoogleForm)
      ? {
          status: "GRADED",
          grade: 1.0,
          feedback: null,
          submittedAt: null,
          fileUrl: null,
          attempt: submission?.attempt || 1,
          unlockedAnswers: submission?.unlockedAnswers || false,
        }
      : null;

  const activeSubmission =
    submission && submission.status !== "PENDING"
      ? submission
      : virtualSubmission || submission;
  const isSubmitted = activeSubmission && activeSubmission.status !== "PENDING";

  return (
    <>
      {!isSubmitted && !isClosed && (
        isExternal ? (
          <Link
            href={`/estudiante/tareas/${examId}`}
            className="btn btn-secondary w-full md:w-auto"
          >
            Ver Actividad
          </Link>
        ) : (
          <Link
            href={`/estudiante/examenes/${examId}`}
            className="btn btn-primary w-full md:w-auto"
          >
            Resolver Examen
          </Link>
        )
      )}

      {isSubmitted && activeSubmission && (
        <EvidenciaBotones
          exam={{ id: examId, title: examTitle, course: { name: courseName } }}
          submission={{
            grade: activeSubmission.grade,
            status: activeSubmission.status,
            fileUrl: activeSubmission.fileUrl,
            submittedAt: activeSubmission.submittedAt,
            feedback: activeSubmission.feedback,
            feedbackTemplate: null,
            studentName: studentName,
            attempt: activeSubmission.attempt,
            unlockedAnswers: activeSubmission.unlockedAnswers,
            answers: (activeSubmission as any).answers,
          }}
          isGoogleForm={isGoogleForm}
        />
      )}
    </>
  );
}
