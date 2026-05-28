import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { BookOpen, Users, LayoutDashboard, Settings, ClipboardList } from "lucide-react";
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
      href: "/docente/periodo/1",
      label: "Periodo 1",
      icon: <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0">P1</span>,
    },
    {
      href: "/docente/periodo/2",
      label: "Periodo 2",
      icon: <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0">P2</span>,
    },
    {
      href: "/docente/periodo/3",
      label: "Periodo 3",
      icon: <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0">P3</span>,
    },
    {
      href: "/docente/periodo/4",
      label: "Periodo 4",
      icon: <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0">P4</span>,
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
