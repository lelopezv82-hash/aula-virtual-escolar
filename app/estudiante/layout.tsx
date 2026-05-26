import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { BookOpen, Book, ClipboardList, Bell, Award } from "lucide-react";
import ActiveLink from "@/components/ActiveLink";
import LogoutButton from "@/components/LogoutButton";
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

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <BookOpen size={32} color="var(--primary-color)" />
          <h2>Aula Estudiante</h2>
        </div>
        
        <nav className="sidebar-nav">
          <ActiveLink href="/estudiante">
            <Book size={20} />
            <span>Mis Cursos</span>
          </ActiveLink>
          <ActiveLink href="/estudiante/tareas">
            <ClipboardList size={20} />
            <span>Mis Tareas</span>
          </ActiveLink>
          <ActiveLink href="/estudiante/calificaciones">
            <Award size={20} />
            <span>Calificaciones</span>
          </ActiveLink>
          <ActiveLink href="/estudiante/notificaciones">
            <Bell size={20} />
            <span>Notificaciones</span>
          </ActiveLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar" style={{ background: "var(--success)" }}>{user.name?.charAt(0)}</div>
            <div className="details">
              <strong>{user.name}</strong>
              <span>Estudiante</span>
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
