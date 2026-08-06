import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import DocenteDashboardClient, {
  CourseGroupItem,
  TaskStatItem,
  SubItem,
} from "./DocenteDashboardClient";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-educational-key-2026"
);

export default async function DocenteDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;
  const payload = (await jwtVerify(token, JWT_SECRET)).payload as any;
  const teacherId = payload.id as string;

  // 1. Fetch courses for this teacher with groups, grade, students, tasks and submissions
  const courses = await prisma.course.findMany({
    where: { teacherId, active: true },
    include: {
      groups: {
        include: {
          grade: true,
          students: {
            where: { role: "STUDENT" },
            select: { id: true }
          }
        }
      },
      tasks: {
        where: { active: true },
        include: {
          submissions: true
        }
      }
    }
  });

  // Build items grouped by Course and GradeGroup
  const courseGroups: CourseGroupItem[] = [];
  const gradesMap = new Map<string, { id: string; name: string }>();
  const coursesMap = new Map<string, { id: string; name: string }>();

  courses.forEach((c) => {
    coursesMap.set(c.id, { id: c.id, name: c.name });

    c.groups.forEach((g) => {
      const gradeId = g.gradeId || g.grade?.id || "unknown";
      const gradeName = g.grade?.name || "Sin Grado";
      gradesMap.set(gradeId, { id: gradeId, name: gradeName });

      const studentIds = g.students.map((s) => s.id);
      const studentsCount = studentIds.length;
      const tasksCount = c.tasks.length;

      let pendingCount = 0;
      let gradedCount = 0;
      let sumGrades = 0;

      c.tasks.forEach((t) => {
        t.submissions.forEach((sub) => {
          if (studentIds.includes(sub.studentId)) {
            if (sub.status === "SUBMITTED") pendingCount++;
            if (sub.status === "GRADED" && sub.grade !== null) {
              gradedCount++;
              sumGrades += sub.grade;
            }
          }
        });
      });

      const averageGrade = gradedCount > 0 ? sumGrades / gradedCount : null;

      courseGroups.push({
        courseId: c.id,
        courseName: c.name,
        groupId: g.id,
        groupName: g.name,
        gradeId,
        gradeName,
        studentIds,
        studentsCount,
        tasksCount,
        pendingCount,
        gradedCount,
        averageGrade,
      });
    });
  });

  const uniqueGrades = Array.from(gradesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const uniqueCourses = Array.from(coursesMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // 2. Fetch Recent Tasks stats
  const allTasksRaw = await prisma.task.findMany({
    where: { course: { teacherId }, active: true },
    include: {
      submissions: true,
      course: {
        include: {
          groups: {
            include: {
              grade: true,
              students: {
                where: { role: "STUDENT" },
                select: { id: true }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  const allTasks: TaskStatItem[] = allTasksRaw.map((task) => {
    const taskStudentIds = new Set<string>();
    let gradeName = "";
    let groupName = "";

    task.course.groups.forEach((g) => {
      if (!gradeName && g.grade?.name) gradeName = g.grade.name;
      if (!groupName && g.name) groupName = g.name;
      g.students.forEach((s) => taskStudentIds.add(s.id));
    });

    const total = taskStudentIds.size;
    const submittedCount = task.submissions.filter((s) => s.status !== "PENDING").length;
    const rate = total > 0 ? (submittedCount / total) * 100 : 0;

    return {
      id: task.id,
      title: task.title,
      courseId: task.courseId,
      courseName: task.course.name,
      gradeName: gradeName || "Sin Grado",
      groupName: groupName || "General",
      submitted: submittedCount,
      total,
      rate,
    };
  });

  // 3. Fetch Recent Submissions
  const submissionsRaw = await prisma.submission.findMany({
    where: {
      task: { course: { teacherId } },
      status: { in: ["SUBMITTED", "GRADED"] }
    },
    include: {
      student: { select: { name: true } },
      task: {
        include: {
          course: { select: { name: true } },
          questions: { select: { id: true }, take: 1 }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 5
  });

  const recentSubmissions: SubItem[] = submissionsRaw.map((sub) => ({
    id: sub.id,
    taskId: sub.taskId,
    studentId: sub.studentId,
    studentName: sub.student.name,
    taskTitle: sub.task.title,
    courseName: sub.task.course.name,
    grade: sub.grade,
    status: sub.status,
    updatedAt: sub.updatedAt.toISOString(),
    feedback: sub.feedback,
    fileUrl: sub.fileUrl,
    submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
    isExam: sub.task.type === "EXAM" || sub.task.questions.length > 0,
    isGoogleForm: false,
    answers: sub.answers,
  }));

  return (
    <DocenteDashboardClient
      teacherName={payload.name || "Profesor"}
      courseGroups={courseGroups}
      allTasks={allTasks}
      recentSubmissions={recentSubmissions}
      uniqueGrades={uniqueGrades}
      uniqueCourses={uniqueCourses}
    />
  );
}
