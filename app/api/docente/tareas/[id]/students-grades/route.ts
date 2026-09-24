import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { getTaskDeadlineStatus } from '@/lib/dateUtils';

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
            fileUrls: true,
            allowLateSubmission: true,
            lateSubmissionUntil: true,
            gdriveEmail: true,
            student: {
              select: {
                id: true,
                name: true,
                groupId: true,
                group: {
                  select: {
                    id: true,
                    name: true,
                    grade: { select: { name: true } }
                  }
                }
              }
            }
          },
        },
      },
    });

    if (!task || task.course.teacherId !== payload.id) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(_req.url);
    const filterGroupId = searchParams.get("groupId");

    // Collect groups metadata (from task.groups and any group that has submissions)
    const groupMap = new Map<string, { id: string; name: string; gradeName: string; label: string }>();
    task.groups.forEach(g => {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        gradeName: g.grade?.name || "",
        label: g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name,
      });
    });
    task.submissions.forEach(sub => {
      if (sub.student?.group && !groupMap.has(sub.student.group.id)) {
        const g = sub.student.group;
        groupMap.set(g.id, {
          id: g.id,
          name: g.name,
          gradeName: g.grade?.name || "",
          label: g.grade?.name ? `${g.grade.name} — ${g.name}` : g.name,
        });
      }
    });
    const taskGroups = Array.from(groupMap.values());

    // Collect all students across groups, assignedStudents, and actual submissions (deduplicated)
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

    for (const sub of task.submissions) {
      if (!sub.student) continue;
      const student = sub.student;
      const studentGroupId = student.groupId || student.group?.id;
      if (filterGroupId && filterGroupId !== "all" && studentGroupId !== filterGroupId) {
        continue;
      }
      if (!studentMap.has(student.id)) {
        const group = student.group;
        const gradeLabel = group?.grade?.name ? `${group.grade.name} — ${group.name}` : "Grupo de Entrega";
        studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel, groupId: studentGroupId });
      }
    }

    const submissionMap = new Map(task.submissions.map(s => [s.studentId, s]));
    const assignedIds = (task.assignedStudents || []).map(s => s.id);
    const isTaskRestricted = assignedIds.length > 0;

    const students = await Promise.all(Array.from(studentMap.values()).map(async s => {
      let sub: any = submissionMap.get(s.id) ?? null;
      const hasProrroga = !!sub?.allowLateSubmission;
      const hasActualSubmission = !!sub && (sub.status === "SUBMITTED" || sub.status === "GRADED" || !!sub.fileUrl || (sub.fileUrls && (sub.fileUrls as any).length > 0));
      const isAssigned = !isTaskRestricted || assignedIds.includes(s.id) || hasProrroga || hasActualSubmission;

      const taskInfo = {
        dueDate: task.dueDate,
        allowLateSubmission: task.allowLateSubmission,
        lateSubmissionUntil: task.lateSubmissionUntil,
        type: task.type,
      };
      const { isClosed, hasExtension } = getTaskDeadlineStatus(taskInfo, sub);
      const isProrrogaExpiredWithoutSubmission = (hasExtension || hasProrroga) && isClosed && !hasActualSubmission;
      const hasActiveProrroga = hasProrroga && !isClosed;
      const isOverdueWithoutSubmission = !task.isExternal && isClosed && !hasActualSubmission && !hasActiveProrroga;

      if (isProrrogaExpiredWithoutSubmission || isOverdueWithoutSubmission) {
        const feedbackText = isProrrogaExpiredWithoutSubmission
          ? ((sub?.feedback && !sub.feedback.includes("Prórroga concedida") && !sub.feedback.includes("No asistió") && !sub.feedback.includes("plazo establecido")) 
              ? sub.feedback 
              : "Plazo de prórroga vencido sin entrega de la actividad.")
          : "Actividad no entregada dentro del plazo establecido.";
        const targetGrade = (sub?.grade != null && sub.grade !== 1.0) ? sub.grade : 1.0;

        if (!sub || sub.grade !== targetGrade || sub.status !== "OVERDUE" || sub.feedback !== feedbackText) {
          try {
            sub = await prisma.submission.upsert({
              where: {
                taskId_studentId: {
                  taskId,
                  studentId: s.id,
                }
              },
              update: {
                grade: targetGrade,
                status: "OVERDUE",
                feedback: feedbackText,
              },
              create: {
                taskId,
                studentId: s.id,
                grade: targetGrade,
                status: "OVERDUE",
                feedback: feedbackText,
                allowLateSubmission: sub?.allowLateSubmission ?? true,
                lateSubmissionUntil: sub?.lateSubmissionUntil ?? null,
              },
              include: {
                student: {
                  select: { name: true }
                }
              }
            });
          } catch (e) {
            console.error("Error upserting overdue prorroga submission:", e);
            sub = {
              ...(sub || {} as any),
              grade: targetGrade,
              status: "OVERDUE",
              feedback: feedbackText,
            };
          }
        }
      } else if (hasProrroga && !isClosed && sub && !sub.fileUrl && (sub.grade === 1 || sub.grade === 1.0) && (sub.feedback?.includes("No asistió") || sub.feedback?.includes("plazo establecido") || sub.feedback?.includes("Plazo de prórroga vencido"))) {
        // If student has active prórroga and residual automated 1.0, reset it so they can submit
        sub = {
          ...sub,
          grade: null,
          status: "PENDING",
          feedback: "Prórroga concedida por el docente.",
        };
      }

      return {
        ...s,
        isAssigned,
        isNotActivated: !isAssigned,
        submission: sub,
      };
    }));

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
