"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FolderOpen, ClipboardList, FileText, Award } from "lucide-react";

interface CursoSidebarProps {
  courseId: string;
  courseName: string;
  periods: string[];
}

interface NavSection {
  icon: React.ReactNode;
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

export default function CursoSidebar({ courseId, courseName, periods }: CursoSidebarProps) {
  const pathname = usePathname();
  const base = `/estudiante/cursos/${courseId}`;

  const sections: NavSection[] = [
    {
      icon: <Bell size={18} />,
      label: "Avisos",
      href: `${base}/avisos`,
    },
    {
      icon: <FolderOpen size={18} />,
      label: "Recursos",
      href: `${base}/recursos`,
      subItems: periods.map(p => ({
        label: p,
        href: `${base}/recursos?periodo=${encodeURIComponent(p)}`,
      })),
    },
    {
      icon: <ClipboardList size={18} />,
      label: "Tareas",
      href: `${base}/tareas`,
      subItems: [
        { label: "Pendientes", href: `${base}/tareas?estado=pendientes` },
        { label: "Entregadas", href: `${base}/tareas?estado=entregadas` },
      ],
    },
    {
      icon: <FileText size={18} />,
      label: "Exámenes",
      href: `${base}/examenes`,
      subItems: [
        { label: "Disponibles", href: `${base}/examenes?estado=disponibles` },
        { label: "Presentados", href: `${base}/examenes?estado=presentados` },
      ],
    },
    {
      icon: <Award size={18} />,
      label: "Calificaciones",
      href: `${base}/calificaciones`,
    },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "?") || pathname.startsWith(href + "/");
  const isSectionActive = (section: NavSection) => {
    if (pathname.startsWith(section.href)) return true;
    if (section.subItems?.some(s => pathname.startsWith(s.href))) return true;
    return false;
  };

  return (
    <div
      className="card"
      style={{ position: "sticky", top: "1rem", padding: 0, overflow: "hidden" }}
    >
      {/* Course Name Header */}
      <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid var(--border-color)" }}>
        <h2 className="font-bold text-base capitalize" style={{ color: "var(--text-primary)" }}>
          {courseName}
        </h2>
      </div>

      {/* Nav Sections */}
      <nav style={{ padding: "0.5rem 0" }}>
        {sections.map((section) => {
          const sectionActive = isSectionActive(section);
          return (
            <div key={section.label}>
              {/* Section header */}
              <Link
                href={section.href}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  color: sectionActive ? "var(--primary-color)" : "var(--text-secondary)",
                  fontWeight: sectionActive ? 700 : 600,
                  fontSize: "0.9rem",
                  background: sectionActive && !section.subItems ? "rgba(249,128,18,0.07)" : "transparent",
                  borderLeft: sectionActive && !section.subItems ? "3px solid var(--primary-color)" : "3px solid transparent",
                }}
              >
                <span style={{ opacity: sectionActive ? 1 : 0.65 }}>{section.icon}</span>
                {section.label}
              </Link>

              {/* Sub-items — always visible */}
              {section.subItems && section.subItems.map((sub) => {
                const subActive = pathname.includes(section.href.split("/").pop() || "") &&
                  (sub.href.includes("estado=") 
                    ? pathname + "?" + (typeof window !== "undefined" ? window.location.search.slice(1) : "") === sub.href
                    : pathname.startsWith(base + "/recursos"));

                return (
                  <Link
                    key={sub.label}
                    href={sub.href}
                    className="flex items-center px-10 py-1.5 text-sm transition-colors"
                    style={{
                      color: "var(--text-secondary)",
                      fontWeight: 400,
                    }}
                  >
                    {sub.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
