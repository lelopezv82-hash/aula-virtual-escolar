import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        course: { select: { teacherId: true } },
        groups: {
          include: {
            students: {
              where: { role: 'STUDENT' },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
            grade: { select: { name: true } },
          }
        },
        assignedStudents: {
          select: {
            id: true,
            name: true,
            groupName: true,
            group: {
              select: {
                id: true,
                name: true,
                grade: { select: { name: true } }
              }
            }
          }
        },
        submissions: {
          select: { 
            id: true, 
            studentId: true, 
            status: true, 
            grade: true, 
            feedback: true, 
            submittedAt: true,
            fileUrl: true,
            allowLateSubmission: true,
            lateSubmissionUntil: true,
            gdriveEmail: true
          },
        },
      },
    });

    if (!task || task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(_req.url);
    const filterGroupId = searchParams.get("groupId");

    // Collect groups metadata
    const taskGroups = task.groups.map(g => ({
      id: g.id,
      name: g.name,
      gradeName: g.grade?.name || "",
      label: g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name,
    }));

    // Collect all students across groups and assignedStudents (deduplicated)
    const studentMap = new Map<string, { id: string; name: string; groupName: string; groupId?: string }>();
    for (const group of task.groups) {
      if (filterGroupId && filterGroupId !== "all" && group.id !== filterGroupId) {
        continue;
      }
      for (const student of group.students) {
        if (!studentMap.has(student.id)) {
          const gradeLabel = group.grade?.name ? `${group.grade.name} — ${group.name}` : group.name;
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel, groupId: group.id });
        }
      }
    }

    if (task.assignedStudents) {
      for (const student of task.assignedStudents) {
        const studentGroupId = (student as any).groupId || student.group?.id;
        if (filterGroupId && filterGroupId !== "all" && studentGroupId !== filterGroupId) {
          continue;
        }
        if (!studentMap.has(student.id)) {
          const group = student.group;
          const gradeLabel = group?.grade?.name ? `${group.grade.name} — ${group.name}` : (student.groupName || "Asignación Individual");
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel, groupId: studentGroupId });
        }
      }
    }

    const submissionMap = new Map(task.submissions.map(s => [s.studentId, s]));
    const assignedIds = (task.assignedStudents || []).map(s => s.id);

    const students = Array.from(studentMap.values()).map(s => {
      const isAssigned = assignedIds.includes(s.id);
      return {
        ...s,
        isAssigned,
        isNotActivated: !isAssigned,
        submission: submissionMap.get(s.id) ?? null,
      };
    });

    return NextResponse.json({ 
      students, 
      assignedStudentIds: assignedIds,
      taskType: task.type, 
      taskTitle: task.title,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      isExternal: task.isExternal,
      duration: task.duration,
      groups: taskGroups,
      courseId: (task as any).courseId,
      allowLateSubmission: task.allowLateSubmission,
      lateSubmissionUntil: task.lateSubmissionUntil ? task.lateSubmissionUntil.toISOString() : null
    });
  } catch (error) {
    console.error("Error fetching task students:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
