import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { BookOpen, Users, LayoutDashboard, Settings, ClipboardList, Calendar } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import "./docente.css";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function DocenteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      redirect("/login");
    }
    user = payload;
  } catch (err) {
    redirect("/login");
  }

  const links = [
    {
      href: "/docente",
      label: "Panel General",
      icon: <LayoutDashboard size={20} />,
    },
    {
      href: "/docente/estudiantes",
      label: "Estudiantes",
      icon: <Users size={20} />,
    },
    {
      href: "/docente/cursos",
      label: "Mis Cursos",
      icon: <BookOpen size={20} />,
    },
    {
      href: "/docente/tareas",
      label: "Tareas",
      icon: <ClipboardList size={20} />,
    },
    {
      href: "/docente/periodos",
      label: "Periodos",
      icon: <Calendar size={20} />,
    },
    {
      href: "/docente/configuracion",
      label: "Configuración",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <DashboardShell
      user={user}
      roleTitle="Docente"
      sidebarTitle="Aula Virtual"
      links={links}
    >
      {children}
    </DashboardShell>
  );
}
