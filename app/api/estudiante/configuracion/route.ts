import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const student = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: { securityQuestion: true, securityPin: true, recoveryEmail: true }
    });

    return NextResponse.json({
      securityQuestion: student?.securityQuestion || "",
      hasPin: !!student?.securityPin,
      recoveryEmail: student?.recoveryEmail || ""
    });
  } catch (error) {
    console.error("Error fetching student security settings:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const studentId = payload.id as string;
    const { currentPassword, newPassword, securityQuestion, securityAnswer, securityPin, recoveryEmail } = await request.json();

    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    // Password update
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Debes ingresar tu contraseña actual para cambiarla.' }, { status: 400 });
      }
      const match = await bcrypt.compare(currentPassword, student.password);
      if (!match) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
      updateData.passwordPlain = newPassword;
    }

    // Security question update
    if (securityQuestion !== undefined && securityAnswer !== undefined) {
      if (securityQuestion.trim() && securityAnswer.trim()) {
        updateData.securityQuestion = securityQuestion.trim();
        updateData.securityAnswer = securityAnswer.trim().toLowerCase();
      }
    }

    // Security PIN update
    if (securityPin !== undefined && securityPin !== null) {
      if (securityPin.trim()) {
        if (!/^\d{4}$/.test(securityPin.trim())) {
          return NextResponse.json({ error: 'El PIN de seguridad debe tener exactamente 4 dígitos numéricos.' }, { status: 400 });
        }
        updateData.securityPin = securityPin.trim();
      }
    }

    // Recovery Email update
    if (recoveryEmail !== undefined) {
      const cleanEmail = recoveryEmail.trim().toLowerCase();
      if (cleanEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return NextResponse.json({ error: 'El correo de recuperación no tiene un formato válido.' }, { status: 400 });
        }
        updateData.recoveryEmail = cleanEmail;
      } else {
        updateData.recoveryEmail = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: studentId },
      data: updateData
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating student configuration:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
