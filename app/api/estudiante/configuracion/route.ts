import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const studentId = payload.id as string;
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, student.password);
    if (!match) {
      return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update in database
    await prisma.user.update({
      where: { id: studentId },
      data: {
        password: hashedPassword,
        passwordPlain: newPassword
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating student password:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
