"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface CursoSidebarProps {
  courseId: string;
  courseName: string;
  periods?: string[];
}

export default function CursoSidebar({ courseId, courseName, periods = [] }: CursoSidebarProps) {
  const pathname = usePathname();
  const base = `/estudiante/cursos/${courseId}`;

  const isHomeActive   = pathname === base;
  const isCalifActive  = pathname.includes("/calificaciones");

  const linkBase = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.6rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "#444",
    textDecoration: "none",
    borderLeft: "4px solid transparent",
    transition: "background 0.15s, color 0.15s",
  } as const;

  const activeStyle = {
    ...linkBase,
    background: "#f0f0f0",
    color: "#222",
    fontWeight: 700,
    borderLeft: "4px solid #f98012",
    paddingLeft: "1rem",
  } as const;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #dee2e6",
      borderRadius: "4px",
      overflow: "hidden",
      position: "sticky",
      top: "1.5rem",
    }}>
      {/* Course Name */}
      <div style={{
        background: "#f8f9fa",
        borderBottom: "1px solid #dee2e6",
        padding: "1rem 1.25rem",
      }}>
        <Link href={base} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#333", textTransform: "capitalize", lineHeight: 1.3 }}>
            {courseName}
          </div>
          {periods.length > 0 && (
            <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "0.2rem" }}>
              {periods.join(" · ")}
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "0.5rem 0" }}>

        {/* Contenido del curso (home) */}
        <Link href={base} style={isHomeActive ? activeStyle : linkBase}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Actividades en plataforma
        </Link>

        <div style={{ height: 1, background: "#dee2e6", margin: "0.35rem 1rem" }} />

        {/* Recursos y Materiales */}
        <Link href={`${base}/recursos`} style={pathname.includes("/recursos") ? activeStyle : linkBase}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          Recursos y Materiales
        </Link>

        <div style={{ height: 1, background: "#dee2e6", margin: "0.35rem 1rem" }} />

        {/* Calificaciones */}
        <Link href={`${base}/calificaciones`} style={isCalifActive ? activeStyle : linkBase}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="6"/>
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
          Calificaciones
        </Link>

      </nav>
    </div>
  );
}
