import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import TareasClient, { SerializedTask } from "./TareasClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareasEstudiantePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const rawTasks = await prisma.task.findMany({
    where: {
      active: true,
      type: { in: ["TASK", "TASK_SABER", "SABER", "INTERACTIVE"] },
      OR: [
        { period: null },
        { period: { in: activePeriodNames } }
      ],
      AND: [
        {
          OR: [
            { publishAt: null },
            { publishAt: { lte: now } }
          ]
        },
        {
          OR: [
            ...(studentGroupId ? [{ groups: { some: { id: studentGroupId } } }] : []),
            { assignedStudents: { some: { id: studentId } } }
          ]
        }
      ]
    },
    include: {
      course: {
        select: {
          id: true,
          name: true
        }
      },
      assignedStudents: {
        select: { id: true }
      },
      submissions: {
        where: { studentId }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Serialize tasks safely for Client Component
  const serializedTasks: SerializedTask[] = rawTasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    courseId: t.courseId,
    dueDate: t.dueDate.toISOString(),
    publishAt: t.publishAt ? t.publishAt.toISOString() : null,
    attachmentUrl: t.attachmentUrl,
    interactiveUrl: (t as any).interactiveUrl || null,
    isExternal: !!t.isExternal,
    allowLateSubmission: !!t.allowLateSubmission,
    lateSubmissionUntil: t.lateSubmissionUntil ? t.lateSubmissionUntil.toISOString() : null,
    period: t.period,
    createdAt: t.createdAt.toISOString(),
    course: {
      id: t.course.id,
      name: t.course.name
    },
    assignedStudents: t.assignedStudents.map(s => ({ id: s.id })),
    submissions: t.submissions.map(sub => ({
      id: sub.id,
      studentId: sub.studentId,
      status: sub.status,
      grade: sub.grade,
      feedback: sub.feedback,
      fileUrl: sub.fileUrl,
      fileUrls: (sub as any).fileUrls,
      answers: sub.answers,
      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
      allowLateSubmission: !!sub.allowLateSubmission,
      lateSubmissionUntil: sub.lateSubmissionUntil ? sub.lateSubmissionUntil.toISOString() : null
    }))
  }));

  return <TareasClient tasks={serializedTasks} studentId={studentId} />;
}
