import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { LayoutDashboard, GraduationCap, Users, Settings } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import "@/app/docente/docente.css";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "ADMIN") {
      redirect("/login");
    }
    user = payload;
  } catch (err) {
    redirect("/login");
  }

  const links = [
    {
      href: "/admin",
      label: "Panel General",
      icon: <LayoutDashboard size={20} />,
    },
    {
      href: "/admin/docentes",
      label: "Docentes",
      icon: <GraduationCap size={20} />,
    },
    {
      href: "/admin/estudiantes",
      label: "Estudiantes",
      icon: <Users size={20} />,
    },
    {
      href: "/admin/configuracion",
      label: "Configuración",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <DashboardShell
      user={user}
      roleTitle="Administrador"
      sidebarTitle="Admin Aula"
      links={links}
    >
      {children}
    </DashboardShell>
  );
}
