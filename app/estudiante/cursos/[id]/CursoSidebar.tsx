"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FolderOpen, ClipboardList, FileText, Award } from "lucide-react";

interface CursoSidebarProps {
  courseId: string;
  courseName: string;
  periods?: string[];
}

interface NavSection {
  icon: React.ReactNode;
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

export default function CursoSidebar({ courseId, courseName, periods = [] }: CursoSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const estado = searchParams.get("estado");
  const base = `/estudiante/cursos/${courseId}`;

  const sections: NavSection[] = [
    {
      icon: <FolderOpen size={20} />,
      label: "Recursos",
      href: `${base}/recursos`,
    },
    {
      icon: <ClipboardList size={20} />,
      label: "Tareas",
      href: `${base}/tareas`,
      subItems: [
        { label: "Pendientes", href: `${base}/tareas?estado=pendientes` },
        { label: "Entregadas", href: `${base}/tareas?estado=entregadas` },
      ],
    },
    {
      icon: <FileText size={20} />,
      label: "Exámenes",
      href: `${base}/examenes`,
      subItems: [
        { label: "Disponibles", href: `${base}/examenes?estado=disponibles` },
        { label: "Presentados", href: `${base}/examenes?estado=presentados` },
      ],
    },
    {
      icon: <Award size={20} />,
      label: "Calificaciones",
      href: `${base}/calificaciones`,
    },
  ];

  const isSectionActive = (section: NavSection) => {
    return pathname.startsWith(section.href);
  };

  const isSubActive = (subHref: string) => {
    if (subHref.includes("estado=entregadas")) {
      return pathname.endsWith("/tareas") && estado === "entregadas";
    }
    if (subHref.includes("estado=pendientes")) {
      return pathname.endsWith("/tareas") && (estado === "pendientes" || !estado);
    }
    if (subHref.includes("estado=presentados")) {
      return pathname.endsWith("/examenes") && estado === "presentados";
    }
    if (subHref.includes("estado=disponibles")) {
      return pathname.endsWith("/examenes") && (estado === "disponibles" || !estado);
    }
    return false;
  };

  const isHomeActive = pathname === base;

  return (
    <div
      className="card"
      style={{
        position: "sticky",
        top: "1.5rem",
        padding: 0,
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Course Name Header */}
      <div style={{ 
        padding: "1.25rem 1.5rem", 
        paddingLeft: isHomeActive ? "1.25rem" : "1.5rem",
        borderBottom: "1px solid var(--border-color)", 
        background: isHomeActive ? "rgba(249,128,18,0.08)" : "var(--bg-secondary)",
        borderLeft: isHomeActive ? "4px solid var(--primary-color)" : "4px solid transparent",
        transition: "all 0.2s ease"
      }}>
        <Link href={base} className="transition-colors block" style={{ color: isHomeActive ? "var(--primary-color)" : "var(--text-primary)", textDecoration: "none" }}>
          <h2 className="font-bold text-lg capitalize" style={{ color: "inherit", letterSpacing: "-0.01em", marginBottom: "0.25rem" }}>
            {courseName}
          </h2>
        </Link>
        {periods && periods.length > 0 && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500, marginTop: "0.15rem" }}>
            {periods.join(" • ")}
          </div>
        )}
      </div>

      {/* Nav Sections */}
      <nav style={{ padding: "0.75rem 0" }}>
        {sections.map((section, idx) => {
          const sectionActive = isSectionActive(section);
          return (
            <div key={section.label}>
              {/* Section Header Link */}
              <Link
                href={section.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors"
                style={{
                  color: sectionActive ? "var(--primary-color)" : "var(--text-secondary)",
                  fontWeight: sectionActive ? 700 : 600,
                  fontSize: "1.05rem",
                  background: sectionActive ? "rgba(249,128,18,0.08)" : "transparent",
                  borderLeft: sectionActive ? "4px solid var(--primary-color)" : "4px solid transparent",
                }}
              >
                <span style={{ opacity: sectionActive ? 1 : 0.7, display: "flex", alignItems: "center" }}>
                  {section.icon}
                </span>
                <span>{section.label}</span>
              </Link>

              {/* Sub-items */}
              {section.subItems && (
                <div style={{ display: "flex", flexDirection: "column", paddingBottom: "0.5rem" }}>
                  {section.subItems.map((sub) => {
                    const active = isSubActive(sub.href);
                    return (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        className="flex items-center gap-2 py-2 transition-colors"
                        style={{
                          paddingLeft: "3.25rem",
                          paddingRight: "1.5rem",
                          fontSize: "0.95rem",
                          color: active ? "var(--primary-color)" : "var(--text-muted)",
                          fontWeight: active ? 600 : 500,
                          background: active ? "rgba(249,128,18,0.04)" : "transparent",
                        }}
                      >
                        {active && (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: "var(--primary-color)",
                              display: "inline-block",
                              marginLeft: "-10px",
                              marginRight: "4px",
                            }}
                          />
                        )}
                        <span>{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Separator Line */}
              {idx < sections.length - 1 && (
                <div style={{ padding: "0.25rem 0" }}>
                  <div style={{ height: "1px", background: "var(--border-color)", opacity: 0.6, margin: "0.25rem 1.25rem" }} />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
