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
  return base[0] || "docente";
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { teachers } = await request.json();
    if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
      return NextResponse.json({ error: 'No se enviaron docentes válidos' }, { status: 400 });
    }

    const createdTeachers = [];

    for (const row of teachers) {
      const name = (row.name || row.Nombre || '').trim();

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

      // Create teacher
      const teacher = await prisma.user.create({
        data: {
          name,
          username,
          password: hashedPassword,
          passwordPlain: plainPassword,
          role: "TEACHER"
        }
      });

      createdTeachers.push({
        name: teacher.name,
        username: teacher.username,
        plainPassword
      });
    }

    return NextResponse.json({
      success: true,
      createdCount: createdTeachers.length,
      createdTeachers
    });
  } catch (error) {
    console.error("Error bulk importing teachers for admin:", error);
    return NextResponse.json({ error: 'Error interno del servidor al importar' }, { status: 500 });
  }
}
