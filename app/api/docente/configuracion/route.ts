import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const { name, currentPassword, newPassword } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId }
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = { name };

    // Handle password change if requested
    if (currentPassword && newPassword) {
      const match = await bcrypt.compare(currentPassword, teacher.password);
      if (!match) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
      }
      
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    } else if (newPassword && !currentPassword) {
      return NextResponse.json({ error: 'Debes proporcionar tu contraseña actual para cambiarla' }, { status: 400 });
    }

    const updatedTeacher = await prisma.user.update({
      where: { id: teacherId },
      data: updateData
    });

    // Create a new JWT with the updated name
    const newToken = await new SignJWT({
      id: updatedTeacher.id,
      username: updatedTeacher.username,
      role: updatedTeacher.role,
      name: updatedTeacher.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, name: updatedTeacher.name });

    // Set the updated cookie
    response.cookies.set({
      name: 'auth_token',
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;
  } catch (error) {
    console.error("Error updating teacher config:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
