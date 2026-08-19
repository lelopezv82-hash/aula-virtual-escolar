import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { sendRecoveryEmail } from "@/lib/email";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const maskEmail = (email: string) => {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length <= 2 
    ? local[0] + "*" 
    : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
};

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
    const { action, username, answer, pin, newPassword, emailCode, email } = body;

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
        hasSecurityQuestion: !!(user.securityQuestion && user.securityAnswer),
        securityQuestion: user.securityQuestion || null,
        hasEmail: !!user.recoveryEmail,
        maskedEmail: user.recoveryEmail ? maskEmail(user.recoveryEmail) : null
      });
    }

    // 2. Verify security question and update password
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

      if (!isMatch) {
        return NextResponse.json({ error: "La respuesta a la pregunta secreta es incorrecta." }, { status: 400 });
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

      await prisma.passwordResetRequest.updateMany({
        where: { studentId: user.id, status: "PENDING" },
        data: { status: "RESOLVED" }
      });

      return NextResponse.json({
        success: true,
        message: "¡Tu contraseña ha sido actualizada correctamente! Ya puedes iniciar sesión."
      });
    }

    // 3. Verify Recovery Email and Reset Password directly in platform (Opción 3)
    if (action === "verify-recovery-email") {
      if (!cleanUsername) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });
      if (!email || !email.trim()) {
        return NextResponse.json({ error: "Ingresa tu correo de recuperación registrado." }, { status: 400 });
      }
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user || !user.recoveryEmail) {
        return NextResponse.json({ error: "Este usuario no tiene un correo de recuperación registrado." }, { status: 400 });
      }

      if (user.recoveryEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
        return NextResponse.json({ error: "El correo ingresado no coincide con el registrado en tu cuenta." }, { status: 400 });
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

      await prisma.passwordResetToken.deleteMany({
        where: { studentId: user.id }
      });

      await prisma.passwordResetRequest.updateMany({
        where: { studentId: user.id, status: "PENDING" },
        data: { status: "RESOLVED" }
      });

      return NextResponse.json({
        success: true,
        message: "¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión con tu nueva clave."
      });
    }

    // 3. Send Email Reset Token / Code (Envío Real)
    if (action === "send-email-token") {
      if (!cleanUsername) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user || !user.recoveryEmail) {
        return NextResponse.json({ error: "Este usuario no tiene un correo de recuperación registrado." }, { status: 400 });
      }

      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      // Clean old tokens for student
      await prisma.passwordResetToken.deleteMany({
        where: { studentId: user.id }
      });

      await prisma.passwordResetToken.create({
        data: {
          token: code,
          studentId: user.id,
          expiresAt
        }
      });

      // Enviar correo transaccional real
      const emailResult = await sendRecoveryEmail({
        to: user.recoveryEmail,
        userName: user.name,
        code
      });

      if (!emailResult.success) {
        return NextResponse.json({
          error: emailResult.error || "No se pudo enviar el correo de recuperación. Revisa la configuración del servicio."
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        maskedEmail: maskEmail(user.recoveryEmail),
        message: `Hemos enviado un código de 6 dígitos a tu correo ${maskEmail(user.recoveryEmail)}. Revisa tu bandeja de entrada o spam.`
      });
    }

    // 4. Verify Email Token / Code and reset password
    if (action === "verify-email-token") {
      if (!cleanUsername || !emailCode) {
        return NextResponse.json({ error: "Código de verificación requerido" }, { status: 400 });
      }
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          studentId: user.id,
          token: emailCode.trim(),
          expiresAt: { gt: new Date() }
        }
      });

      if (!resetToken) {
        return NextResponse.json({ error: "El código de recuperación es incorrecto o ha expirado (15 min)." }, { status: 400 });
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

      await prisma.passwordResetToken.deleteMany({
        where: { studentId: user.id }
      });

      await prisma.passwordResetRequest.updateMany({
        where: { studentId: user.id, status: "PENDING" },
        data: { status: "RESOLVED" }
      });

      return NextResponse.json({
        success: true,
        message: "¡Contraseña restablecida exitosamente vía correo de recuperación! Ya puedes ingresar."
      });
    }

    // 5. Request reset from Teacher (Opción 1)
    if (action === "request-teacher-reset") {
      if (!cleanUsername) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });

      const user = await prisma.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } }
      });

      if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }

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

    // 6. Teacher/Admin resolves password reset request
    if (action === "teacher-resolve-reset") {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth_token")?.value;
      if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.role !== "TEACHER" && payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      const { studentId, requestId, newPassword: customNewPassword } = body;
      const finalPassword = customNewPassword?.trim() || "123456";
      
      let targetUserId = studentId;
      if (!targetUserId && requestId) {
        const reqItem = await prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
        if (reqItem) targetUserId = reqItem.studentId;
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "Estudiante no encontrado" }, { status: 404 });
      }

      const hashedPassword = await bcrypt.hash(finalPassword, 10);

      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          password: hashedPassword,
          passwordPlain: finalPassword,
          mustChangePassword: false
        }
      });

      await prisma.passwordResetRequest.updateMany({
        where: { studentId: targetUserId, status: "PENDING" },
        data: { status: "RESOLVED" }
      });

      return NextResponse.json({
        success: true,
        message: `Contraseña restablecida exitosamente a "${finalPassword}".`
      });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    console.error("Error in recover-password API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
