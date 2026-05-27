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
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

