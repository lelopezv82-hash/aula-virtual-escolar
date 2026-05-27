import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// Helper to generate a unique username
function generateUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (base.length >= 2) {
    return `${base[0]}.${base[base.length - 1]}`;
  }
  return base[0] || "estudiante";
}

// GET - List all students
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, username: true, grade: true, groupName: true, passwordPlain: true, createdAt: true },
      orderBy: { name: "asc" }
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error("Error fetching students for teacher:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Create new student
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { name, grade, groupName, password: customPassword } = await request.json();
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

    // Generate username (ensure uniqueness)
    const baseUsername = generateUsername(name);
    let username = baseUsername;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter++}`;
    }

    // Generate or use custom password
    const plainPassword = customPassword || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const student = await prisma.user.create({
      data: { name, username, password: hashedPassword, passwordPlain: plainPassword, role: "STUDENT", grade, groupName }
    });

    return NextResponse.json({
      success: true,
      student: { id: student.id, name: student.name, username: student.username, grade: student.grade, groupName: student.groupName, passwordPlain: student.passwordPlain },
      plainPassword
    });
  } catch (error) {
    console.error("Error creating student for teacher:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH - Edit student details
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id, name, grade, groupName, password: newPassword } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const updateData: Record<string, unknown> = { name, grade, groupName };
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10);
      updateData.passwordPlain = newPassword;
    }

    const student = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, username: true, grade: true, groupName: true, passwordPlain: true }
    });

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error("Error editing student for teacher:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Remove student
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting student for teacher:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
