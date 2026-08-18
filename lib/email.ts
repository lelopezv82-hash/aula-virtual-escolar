/**
 * Servicio de envío de correos electrónicos transaccionales
 * Soporta Resend API y Brevo API de forma nativa sin dependencias pesadas.
 */

interface SendRecoveryEmailParams {
  to: string;
  userName: string;
  code: string;
}

export async function sendRecoveryEmail({ to, userName, code }: SendRecoveryEmailParams): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "Aula Virtual <onboarding@resend.dev>";

  if (!resendApiKey && !brevoApiKey) {
    console.warn("⚠️ [EMAIL SERVICE] Ni RESEND_API_KEY ni BREVO_API_KEY están configuradas en las variables de entorno.");
    return {
      success: false,
      error: "El servicio de correo no está configurado (falta RESEND_API_KEY o BREVO_API_KEY)."
    };
  }

  const subject = `🔑 Código de recuperación de contraseña: ${code}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperación de Contraseña</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 24px;
          color: #1e293b;
        }
        .container {
          max-width: 520px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
          padding: 32px 24px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 6px 0 0 0;
          font-size: 13px;
          opacity: 0.9;
        }
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #0f172a;
        }
        .text {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
        }
        .code-box {
          background-color: #fff7ed;
          border: 2px dashed #fdba74;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin: 24px 0;
        }
        .code-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c2410c;
          margin-bottom: 8px;
        }
        .code-value {
          font-family: 'Courier New', Courier, monospace;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #9a3412;
          margin: 0;
        }
        .expiry {
          font-size: 12px;
          color: #64748b;
          text-align: center;
          margin-top: 16px;
        }
        .footer {
          background-color: #f1f5f9;
          padding: 18px 24px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
        }
        .warning {
          font-size: 12px;
          color: #dc2626;
          background-color: #fef2f2;
          border-radius: 8px;
          padding: 10px;
          margin-top: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Aula Virtual</h1>
          <p>Plataforma de Gestión Escolar y Aprendizaje</p>
        </div>
        <div class="content">
          <div class="greeting">Hola, ${userName || "Estudiante"} 👋</div>
          <div class="text">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Aula Virtual. Usa el siguiente código de seguridad de 6 dígitos para continuar:
          </div>
          
          <div class="code-box">
            <div class="code-title">Tu código de verificación</div>
            <div class="code-value">${code}</div>
          </div>
          
          <div class="expiry">
            ⏱️ Este código es válido durante los próximos <strong>15 minutos</strong>.
          </div>

          <div class="warning">
            🔒 Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura. Tu contraseña actual no cambiará.
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Aula Virtual. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Intentar con Resend API
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to.trim()],
          subject,
          html: htmlContent
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("❌ [Resend Error]:", data);
        return {
          success: false,
          error: data.message || "Error al enviar correo con Resend"
        };
      }

      console.log("✅ [Resend Success]: Correo enviado con ID", data.id);
      return { success: true };
    } catch (err: any) {
      console.error("❌ [Resend Exception]:", err);
      return { success: false, error: err.message || "Error de conexión con Resend" };
    }
  }

  // 2. Intentar con Brevo API
  if (brevoApiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey.trim(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: "Aula Virtual",
            email: process.env.BREVO_SENDER_EMAIL || "notificaciones@aulavirtual.edu"
          },
          to: [{ email: to.trim(), name: userName || "Usuario" }],
          subject,
          htmlContent
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("❌ [Brevo Error]:", data);
        return {
          success: false,
          error: data.message || "Error al enviar correo con Brevo"
        };
      }

      console.log("✅ [Brevo Success]: Correo enviado vía Brevo");
      return { success: true };
    } catch (err: any) {
      console.error("❌ [Brevo Exception]:", err);
      return { success: false, error: err.message || "Error de conexión con Brevo" };
    }
  }

  return { success: false, error: "No se encontró ningún proveedor de correo configurado." };
}
