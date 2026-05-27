import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { BookOpen, Book, ClipboardList, Bell, Award, Settings } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import "../docente/docente.css"; // Reuse dashboard layout styles

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") {
      redirect("/login");
    }
    user = payload;
  } catch (err) {
    redirect("/login");
  }

  const links = [
    {
      href: "/estudiante",
      label: "Mis Cursos",
      icon: <Book size={20} />,
    },
    {
      href: "/estudiante/tareas",
      label: "Mis Tareas",
      icon: <ClipboardList size={20} />,
    },
    {
      href: "/estudiante/calificaciones",
      label: "Calificaciones",
      icon: <Award size={20} />,
    },
    {
      href: "/estudiante/notificaciones",
      label: "Notificaciones",
      icon: <Bell size={20} />,
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
      themeColor="var(--success)"
    >
      {children}
    </DashboardShell>
  );
}
