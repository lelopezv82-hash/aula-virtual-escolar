import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { submissionId, taskId, studentId, grade, feedback, allowLateSubmission } = await request.json();

    if (!submissionId && (!taskId || !studentId)) {
      return NextResponse.json({ error: 'Falta el id de la entrega o par taskId/studentId' }, { status: 400 });
    }

    const updateData: any = {};
    
    if (allowLateSubmission !== undefined) {
      updateData.allowLateSubmission = !!allowLateSubmission;
    }

    if (grade !== undefined && grade !== null) {
      const parsedGrade = parseFloat(grade);
      if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 5) {
        return NextResponse.json({ error: 'La calificación debe estar entre 0 y 5' }, { status: 400 });
      }
      updateData.grade = parsedGrade;
      updateData.status = "GRADED";
    }

    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }

    let submission;
    if (submissionId) {
      submission = await prisma.submission.update({
        where: { id: submissionId },
        data: updateData
      });
    } else {
      submission = await prisma.submission.upsert({
        where: {
          taskId_studentId: {
            taskId,
            studentId
          }
        },
        update: updateData,
        create: {
          taskId,
          studentId,
          ...updateData,
          status: "PENDING"
        }
      });
    }

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
