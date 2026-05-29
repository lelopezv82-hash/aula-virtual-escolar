import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

export async function GET() {
  try {
    const payload = await checkAuth();
    if (!payload || !["ADMIN", "SUPER_ADMIN", "TEACHER"].includes(payload.role as string)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const grades = await prisma.grade.findMany({
      include: {
        groups: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { students: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ grades });
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await checkAuth();
    if (!payload || !["ADMIN", "SUPER_ADMIN", "TEACHER"].includes(payload.role as string)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { type, name, gradeId } = await request.json();

    if (type === 'grade') {
      if (!name) return NextResponse.json({ error: 'Nombre del grado es requerido' }, { status: 400 });
      const grade = await prisma.grade.create({
        data: { name }
      });
      return NextResponse.json({ success: true, grade });
    } else if (type === 'group') {
      if (!name || !gradeId) return NextResponse.json({ error: 'Nombre y GradeId son requeridos' }, { status: 400 });
      const group = await prisma.gradeGroup.create({
        data: { name, gradeId }
      });
      return NextResponse.json({ success: true, group });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error: any) {
    console.error("Error creating grade/group:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El nombre ya existe en este nivel' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await checkAuth();
    if (!payload || !["ADMIN", "SUPER_ADMIN", "TEACHER"].includes(payload.role as string)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { type, id } = await request.json();

    if (type === 'grade') {
      await prisma.grade.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } else if (type === 'group') {
      await prisma.gradeGroup.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error("Error deleting grade/group:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
