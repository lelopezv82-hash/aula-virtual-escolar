"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface CursoSidebarProps {
  courseId: string;
  courseName: string;
  periods?: string[];
}

export default function CursoSidebar({ courseId, courseName, periods = [] }: CursoSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const estado = searchParams.get("estado");
  const base = `/estudiante/cursos/${courseId}`;

  const isHomeActive = pathname === base;

  const isTareasActive = pathname.includes("/tareas");
  const isExamenesActive = pathname.includes("/examenes");
  const isRecursosActive = pathname.includes("/recursos");
  const isCalificacionesActive = pathname.includes("/calificaciones");

  const isPendientesActive = isTareasActive && (estado === "pendientes" || !estado);
  const isEntregadasActive = isTareasActive && estado === "entregadas";
  const isDisponiblesActive = isExamenesActive && (estado === "disponibles" || !estado);
  const isPresentadosActive = isExamenesActive && estado === "presentados";

  const linkBase = "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150";
  const activeLink = "bg-[#f0f0f0] text-[#333] font-semibold border-l-4 border-[#f98012] pl-3";
  const inactiveLink = "text-[#555] hover:bg-gray-100 border-l-4 border-transparent";

  const subLinkBase = "flex items-center gap-2 pl-10 pr-4 py-2 text-sm transition-colors duration-150";
  const subActive = "text-[#333] font-semibold";
  const subInactive = "text-[#666] hover:text-[#333] hover:bg-gray-50";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #dee2e6",
      borderRadius: "4px",
      overflow: "hidden",
      position: "sticky",
      top: "1.5rem",
    }}>
      {/* Course Name Header */}
      <div style={{
        background: "#f8f9fa",
        borderBottom: "1px solid #dee2e6",
        padding: "1rem 1.25rem",
      }}>
        <Link href={base} style={{ textDecoration: "none" }}>
          <div style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "#333",
            lineHeight: 1.3,
            textTransform: "capitalize",
          }}>
            {courseName}
          </div>
          {periods && periods.length > 0 && (
            <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "0.2rem" }}>
              {periods.join(" · ")}
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: "0.5rem 0" }}>

        {/* Recursos */}
        <Link href={`${base}/recursos`} className={`${linkBase} ${isRecursosActive ? activeLink : inactiveLink}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Recursos
        </Link>

        {/* Tareas section */}
        <Link href={`${base}/tareas`} className={`${linkBase} ${isTareasActive ? activeLink : inactiveLink}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Tareas
        </Link>

        <Link href={`${base}/tareas?estado=pendientes`} className={`${subLinkBase} ${isPendientesActive ? subActive : subInactive}`}>
          {isPendientesActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f98012", display: "inline-block", marginLeft: -10, marginRight: 4 }} />}
          Pendientes
        </Link>
        <Link href={`${base}/tareas?estado=entregadas`} className={`${subLinkBase} ${isEntregadasActive ? subActive : subInactive}`}>
          {isEntregadasActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f98012", display: "inline-block", marginLeft: -10, marginRight: 4 }} />}
          Entregadas
        </Link>

        <div style={{ height: 1, background: "#dee2e6", margin: "0.4rem 1rem" }} />

        {/* Exámenes section */}
        <Link href={`${base}/examenes`} className={`${linkBase} ${isExamenesActive ? activeLink : inactiveLink}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Exámenes
        </Link>

        <Link href={`${base}/examenes?estado=disponibles`} className={`${subLinkBase} ${isDisponiblesActive ? subActive : subInactive}`}>
          {isDisponiblesActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f98012", display: "inline-block", marginLeft: -10, marginRight: 4 }} />}
          Disponibles
        </Link>
        <Link href={`${base}/examenes?estado=presentados`} className={`${subLinkBase} ${isPresentadosActive ? subActive : subInactive}`}>
          {isPresentadosActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f98012", display: "inline-block", marginLeft: -10, marginRight: 4 }} />}
          Presentados
        </Link>

        <div style={{ height: 1, background: "#dee2e6", margin: "0.4rem 1rem" }} />

        {/* Calificaciones */}
        <Link href={`${base}/calificaciones`} className={`${linkBase} ${isCalificacionesActive ? activeLink : inactiveLink}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/>
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
          Calificaciones
        </Link>
      </nav>
    </div>
  );
}
