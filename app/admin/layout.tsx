import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { LayoutDashboard, GraduationCap, Users, Settings, Shield, Database, Layers } from "lucide-react";
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
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      redirect("/login");
    }
    user = payload;
  } catch (err) {
    redirect("/login");
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
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
      href: "/admin/grados",
      label: "Grados y Cursos",
      icon: <Layers size={20} />,
    },
  ];

  if (isSuperAdmin) {
    links.push({
      href: "/admin/administradores",
      label: "Administradores",
      icon: <Shield size={20} />,
    });
  }

  links.push({
    href: "/admin/configuracion",
    label: "Configuración",
    icon: <Settings size={20} />,
  });

  return (
    <DashboardShell
      user={user}
      roleTitle={isSuperAdmin ? "Super Administrador" : "Administrador"}
      sidebarTitle="Admin Aula"
      links={links}
    >
      {children}
    </DashboardShell>
  );
}
