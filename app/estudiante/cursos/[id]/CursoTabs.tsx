"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Award, FileText } from "lucide-react";

const tabs = [
  { key: "descripcion", href: "", label: "Descripción", icon: <BookOpen size={16} /> },
  { key: "tareas", href: "/tareas", label: "Tareas", icon: <ClipboardList size={16} /> },
  { key: "examenes", href: "/examenes", label: "Exámenes", icon: <FileText size={16} /> },
  { key: "recursos", href: "/recursos", label: "Recursos", icon: <BookOpen size={16} /> },
  { key: "calificaciones", href: "/calificaciones", label: "Calificaciones", icon: <Award size={16} /> },
];

export default function CursoTabs({
  courseId,
  hiddenSections = [],
}: {
  courseId: string;
  hiddenSections?: string[];
}) {
  const pathname = usePathname();
  const base = `/estudiante/cursos/${courseId}`;

  const visibleTabs = tabs.filter((t) => !hiddenSections.includes(t.key));

  return (
    <div
      className="flex gap-1 flex-wrap mb-6"
      style={{
        borderBottom: "1px solid var(--border-color)",
        paddingBottom: 0,
      }}
    >
      {visibleTabs.map((tab) => {
        const href = base + tab.href;
        const isActive =
          tab.href === ""
            ? pathname === base
            : pathname.startsWith(base + tab.href);

        return (
          <Link
            key={tab.href}
            href={href}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              borderBottom: isActive
                ? "3px solid var(--primary-color)"
                : "3px solid transparent",
              color: isActive ? "var(--primary-color)" : "var(--text-secondary)",
              marginBottom: "-1px",
              borderRadius: "4px 4px 0 0",
              background: isActive ? "rgba(249,128,18,0.06)" : "transparent",
            }}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
