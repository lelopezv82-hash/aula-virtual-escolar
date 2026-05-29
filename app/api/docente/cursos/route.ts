import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET all courses for teacher
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const courses = await prisma.course.findMany({
      where: { teacherId: payload.id as string },
      include: {
        _count: { select: { tasks: true, resources: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST create course
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

    const course = await prisma.course.create({
      data: { name, description, teacherId: payload.id as string }
    });
    return NextResponse.json({ success: true, course });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
// PATCH edit course
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id, all, name, description, period1Active, period2Active, period3Active, period4Active } = await request.json();
    if (!id && !all) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (period1Active !== undefined) updateData.period1Active = period1Active;
    if (period2Active !== undefined) updateData.period2Active = period2Active;
    if (period3Active !== undefined) updateData.period3Active = period3Active;
    if (period4Active !== undefined) updateData.period4Active = period4Active;

    if (all) {
      await prisma.course.updateMany({
        where: { teacherId: payload.id as string },
        data: updateData
      });
    } else {
      await prisma.course.updateMany({
        where: { id, teacherId: payload.id as string },
        data: updateData
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE course
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await request.json();
    await prisma.course.deleteMany({ where: { id, teacherId: payload.id as string } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
