"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { formatToColombiaString } from "@/lib/dateUtils";
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

  const isLate = now > new Date(dueDate);
  const hasStudentExtension =
    submission &&
    (submission.allowLateSubmission ||
      (submission.lateSubmissionUntil &&
        new Date(submission.lateSubmissionUntil) > now));
  const isClosed =
    isLate &&
    !allowLateSubmission &&
    !(lateSubmissionUntil && new Date(lateSubmissionUntil) > now) &&
    !hasStudentExtension;

  const isTimerExpired =
    submission?.startedAt &&
    duration &&
    new Date(submission.startedAt).getTime() + duration * 60 * 1000 + 30000 <
      now.getTime();

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
      {/* Due date rendered client-side so it shows the student's local timezone */}
      <div className="text-sm text-muted flex items-center gap-1">
        <Clock size={16} />
        Vence: {formatToColombiaString(dueDate)}
      </div>

      {!isSubmitted && (
        <Link
          href={`/estudiante/examenes/${examId}`}
          className="btn w-full md:w-auto"
          style={{ backgroundColor: "#8b5cf6", color: "white" }}
        >
          Resolver Examen
        </Link>
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
