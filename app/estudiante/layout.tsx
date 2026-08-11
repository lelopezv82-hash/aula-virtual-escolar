import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { Book, Settings } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import "../docente/docente.css";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/");
  }

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      redirect("/");
    }
    if (payload.mustChangePassword === true) {
      redirect("/change-password");
    }
    user = payload;
  } catch {
    redirect("/");
  }

  const links = [
    {
      href: "/estudiante",
      label: "Mis Asignaturas",
      icon: <Book size={20} />,
    },
    {
      href: "/estudiante/configuracion",
      label: "Configuración",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <DashboardShell
      user={user}
      roleTitle="Estudiante"
      sidebarTitle="Aula Estudiante"
      links={links}
      themeColor="var(--primary-color)"
    >
      {children}
    </DashboardShell>
  );
}
