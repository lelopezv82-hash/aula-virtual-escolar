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

    const { submissionId, grade, feedback } = await request.json();

    if (!submissionId || grade === undefined) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    if (grade < 0 || grade > 5) {
      return NextResponse.json({ error: 'La calificación debe estar entre 0 y 5' }, { status: 400 });
    }

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        grade: parseFloat(grade),
        feedback,
        status: "GRADED"
      }
    });

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
