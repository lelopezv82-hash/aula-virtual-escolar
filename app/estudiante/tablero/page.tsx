import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import TableroClient, { TableroTask, CourseOption } from "./TableroClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TableroVirtualPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/");

  let studentId = "";
  let studentName = "Estudiante";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") redirect("/");
    studentId = payload.id as string;
    studentName = (payload.name as string) || "Estudiante";
  } catch {
    redirect("/");
  }

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, name: true }
  });
  const studentGroupId = studentRecord?.groupId || null;
  if (studentRecord?.name) {
    studentName = studentRecord.name;
  }

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  activePeriodsFromDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  // Fetch student's courses
  const studentCourses = await prisma.course.findMany({
    where: studentGroupId ? {
      active: true,
      groups: {
        some: { id: studentGroupId }
      }
    } : { id: "none" },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  const courseOptions: CourseOption[] = studentCourses.map(c => ({
    id: c.id,
    name: c.name
  }));

  // Fetch all tasks and exams accessible by group OR individual assignment
  const tasksFromDb = await prisma.task.findMany({
    where: {
      active: true,
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
        include: {
          teacher: {
            select: { name: true }
          }
        }
      },
      assignedStudents: {
        where: { id: studentId },
        select: { id: true }
      },
      submissions: {
        where: { studentId }
      }
    },
    orderBy: { dueDate: "asc" }
  });

  // Serialize tasks safely for client component
  const serializedTasks: TableroTask[] = tasksFromDb.map(t => {
    const sub = t.submissions[0] || null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate.toISOString(),
      publishAt: t.publishAt ? t.publishAt.toISOString() : null,
      type: t.type || "TASK",
      weight: t.weight ?? 0,
      period: t.period,
      courseId: t.courseId,
      courseName: t.course.name,
      teacherName: t.course.teacher.name,
      isExternal: t.isExternal || false,
      allowLateSubmission: t.allowLateSubmission || false,
      lateSubmissionUntil: t.lateSubmissionUntil ? t.lateSubmissionUntil.toISOString() : null,
      isIndividuallyAssigned: (t.assignedStudents && t.assignedStudents.length > 0) || false,
      submission: sub ? {
        id: sub.id,
        status: sub.status,
        grade: sub.grade,
        submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
        startedAt: sub.startedAt ? sub.startedAt.toISOString() : null,
        attempt: sub.attempt ?? 1
      } : null
    };
  });

  return (
    <TableroClient
      tasks={serializedTasks}
      courses={courseOptions}
      periods={activePeriodNames}
      studentName={studentName}
    />
  );
}
