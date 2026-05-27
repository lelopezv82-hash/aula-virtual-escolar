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

// POST - Bulk import students
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { students } = await request.json();
    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No se enviaron estudiantes válidos' }, { status: 400 });
    }

    const createdStudents = [];

    for (const row of students) {
      const name = (row.name || row.Nombre || '').trim();
      const grade = String(row.grade || row.Grado || row.gradeName || '').trim() || null;
      const groupName = String(row.groupName || row.Grupo || row.group || '').trim() || null;

      if (!name) continue; // Skip empty rows

      // Generate unique username
      const baseUsername = generateUsername(name);
      let username = baseUsername;
      let counter = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter++}`;
      }

      // Generate temporary password
      const plainPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Create student
      const student = await prisma.user.create({
        data: {
          name,
          username,
          password: hashedPassword,
          passwordPlain: plainPassword,
          role: "STUDENT",
          grade,
          groupName
        }
      });

      createdStudents.push({
        name: student.name,
        username: student.username,
        plainPassword,
        grade: student.grade,
        groupName: student.groupName
      });
    }

    return NextResponse.json({
      success: true,
      createdCount: createdStudents.length,
      createdStudents
    });
  } catch (error) {
    console.error("Error bulk importing students for teacher:", error);
    return NextResponse.json({ error: 'Error interno del servidor al importar' }, { status: 500 });
  }
}
