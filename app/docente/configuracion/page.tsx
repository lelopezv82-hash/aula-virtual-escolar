import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ConfigForm from "./ConfigForm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function DocenteConfiguracionPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  let user = { name: "" };
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    user = { name: payload.name as string };
  } catch (err) {
    console.error("Invalid token in configuration page:", err);
  }

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>Configuración de Cuenta</h1>
        <p>Administra tus datos personales y credenciales de acceso.</p>
      </div>

      <div className="card w-full">
        <h2 className="text-xl font-bold mb-4">Datos del Perfil</h2>
        <ConfigForm initialName={user.name} />
      </div>
    </div>
  );
}
