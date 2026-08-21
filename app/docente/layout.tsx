import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import {
  LayoutDashboard,
  Settings,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Layers,
  FileText,
  TableProperties,
  CalendarClock,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import "./docente.css";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function DocenteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/");
  }

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
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
      href: "/docente",
      label: "Panel General",
      icon: <LayoutDashboard size={20} />,
    },
    {
      href: "/docente/planillas",
      label: "Planillas",
      icon: <TableProperties size={20} />,
    },
    {
      href: "/docente/asignaturas-group",
      label: "Asignaturas",
      icon: <BookOpen size={20} />,
      children: [
        {
          href: "/docente/cursos",
          label: "Gestión Asignaturas",
          icon: <BookOpen size={16} />,
        },
        {
          href: "/docente/planillas",
          label: "Actividades",
          icon: <ClipboardList size={16} />,
        },
        {
          href: "/docente/contenido",
          label: "Recursos",
          icon: <FileText size={16} />,
        },
        {
          href: "/docente/grados",
          label: "Grados",
          icon: <Layers size={16} />,
        },
      ],
    },
    {
      href: "/docente/configuracion-group",
      label: "Configuración",
      icon: <Settings size={20} />,
      children: [
        {
          href: "/docente/gestion-periodos",
          label: "Periodos",
          icon: <CalendarClock size={16} />,
        },
        {
          href: "/docente/configuracion",
          label: "Configuración",
          icon: <Settings size={16} />,
        },
      ],
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
