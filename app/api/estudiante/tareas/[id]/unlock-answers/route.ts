import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const studentId = payload.id as string;

    const submission = await prisma.submission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        unlockedAnswers: true
      }
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error('Error unlocking answers:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
