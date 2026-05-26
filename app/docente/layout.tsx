import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { BookOpen, Users, LayoutDashboard, Settings, ClipboardList } from "lucide-react";
import ActiveLink from "@/components/ActiveLink";
import LogoutButton from "@/components/LogoutButton";
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

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <BookOpen size={32} color="var(--primary-color)" />
          <h2>Aula Virtual</h2>
        </div>
        
        <nav className="sidebar-nav">
          <ActiveLink href="/docente">
            <LayoutDashboard size={20} />
            <span>Panel General</span>
          </ActiveLink>
          <ActiveLink href="/docente/estudiantes">
            <Users size={20} />
            <span>Estudiantes</span>
          </ActiveLink>
          <ActiveLink href="/docente/cursos">
            <BookOpen size={20} />
            <span>Mis Cursos</span>
          </ActiveLink>
          <ActiveLink href="/docente/tareas">
            <ClipboardList size={20} />
            <span>Tareas</span>
          </ActiveLink>
          <ActiveLink href="/docente/configuracion">
            <Settings size={20} />
            <span>Configuración</span>
          </ActiveLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user.name?.charAt(0)}</div>
            <div className="details">
              <strong>{user.name}</strong>
              <span>Docente</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
