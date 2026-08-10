import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET - Teacher or Admin gets list of pending reset requests
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.id as string;
    const role = payload.role as string;

    if (role !== "TEACHER" && role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let requests;
    if (role === "ADMIN") {
      requests = await prisma.passwordResetRequest.findMany({
        where: { status: "PENDING" },
        include: {
          student: {
            select: { id: true, name: true, username: true, groupName: true, grade: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } else {
      // Teacher: get courses to find groups taught by teacher
      const courses = await prisma.course.findMany({
        where: { teacherId: userId },
        include: { groups: true }
      });
      const groupIds = Array.from(new Set(courses.flatMap(c => c.groups.map(g => g.id))));

      requests = await prisma.passwordResetRequest.findMany({
        where: {
          status: "PENDING",
          student: {
            groupId: { in: groupIds }
          }
        },
        include: {
          student: {
            select: { id: true, name: true, username: true, groupName: true, grade: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    }

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching password reset requests:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST - Recovery Actions
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, answer, pin, newPassword } = body;

    if (!action) return NextResponse.json({ error: "Acción requerida" }, { status: 400 });

    const cleanUsername = username?.trim().toLowerCase();

    // 1. Check user info
    if (action === "check-user") {
      if (!cleanUsername) return NextResponse.json({ error: "Ingresa tu usuario" }, { status: 400 });

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user) {
        return NextResponse.json({ error: "Nombre de usuario no encontrado." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        userId: user.id,
        name: user.name,
        username: user.username,
        hasSecurity: !!(user.securityQuestion || user.securityPin),
        securityQuestion: user.securityQuestion || null,
        hasPin: !!user.securityPin
      });
    }

    // 2. Verify security question or PIN and update password
    if (action === "verify-security") {
      if (!cleanUsername) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }

      let isMatch = false;

      if (answer && user.securityAnswer) {
        if (answer.trim().toLowerCase() === user.securityAnswer.trim().toLowerCase()) {
          isMatch = true;
        }
      }

      if (pin && user.securityPin) {
        if (pin.trim() === user.securityPin.trim()) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        return NextResponse.json({ error: "La respuesta o el PIN de seguridad es incorrecto." }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordPlain: newPassword,
          mustChangePassword: false
        }
      });

      // Mark any pending reset request as RESOLVED
      await prisma.passwordResetRequest.updateMany({
        where: { studentId: user.id, status: "PENDING" },
        data: { status: "RESOLVED" }
      });

      return NextResponse.json({
        success: true,
        message: "¡Tu contraseña ha sido actualizada correctamente! Ya puedes iniciar sesión."
      });
    }

    // 3. Request reset from Teacher
    if (action === "request-teacher-reset") {
      if (!cleanUsername) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }

      // Check if already pending
      const existing = await prisma.passwordResetRequest.findFirst({
        where: { studentId: user.id, status: "PENDING" }
      });

      if (!existing) {
        await prisma.passwordResetRequest.create({
          data: {
            studentId: user.id,
            status: "PENDING"
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: `Solicitud enviada correctamente. Tu docente o administrador ha sido notificado para restablecer tu clave.`
      });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    console.error("Error in recover-password API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
