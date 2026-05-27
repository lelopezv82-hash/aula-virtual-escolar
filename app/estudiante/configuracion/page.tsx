import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import ConfigForm from "./ConfigForm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function EstudianteConfiguracionPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login");

  let userId = "";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    userId = payload.id as string;
  } catch (err) {
    redirect("/login");
  }

  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true, grade: true, groupName: true }
  });

  if (!student) return null;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Configuración de Cuenta</h1>
        <p>Administra tu contraseña y visualiza tus datos escolares.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
        {/* Read-only Student profile data card */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Información del Estudiante</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
            <div>
              <div className="text-muted text-xs uppercase font-semibold" style={{ marginBottom: "0.25rem" }}>Nombre Completo</div>
              <span className="font-semibold">{student.name}</span>
            </div>
            <div>
              <div className="text-muted text-xs uppercase font-semibold" style={{ marginBottom: "0.25rem" }}>Usuario</div>
              <span className="font-semibold" style={{ fontFamily: "monospace" }}>{student.username}</span>
            </div>
            <div>
              <div className="text-muted text-xs uppercase font-semibold" style={{ marginBottom: "0.25rem" }}>Curso / Grupo</div>
              <div className="mt-1">
                {(student.grade || student.groupName) ? (
                  <span className="badge badge-info">
                    {student.grade ? `Grado ${student.grade}` : ""}{student.grade && student.groupName ? " – " : ""}{student.groupName || ""}
                  </span>
                ) : <span className="text-muted">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Change password card */}
        <div className="card w-full">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Seguridad de la Cuenta</h2>
          <ConfigForm />
        </div>
      </div>
    </div>
  );
}
