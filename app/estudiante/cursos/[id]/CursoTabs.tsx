"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Award, FileText } from "lucide-react";

const tabs = [
  { href: "", label: "Descripción", icon: <BookOpen size={16} /> },
  { href: "/tareas", label: "Tareas", icon: <ClipboardList size={16} /> },
  { href: "/examenes", label: "Exámenes", icon: <FileText size={16} /> },
  { href: "/recursos", label: "Recursos", icon: <BookOpen size={16} /> },
  { href: "/calificaciones", label: "Calificaciones", icon: <Award size={16} /> },
];

export default function CursoTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/estudiante/cursos/${courseId}`;

  return (
    <div
      className="flex gap-1 flex-wrap mb-6"
      style={{
        borderBottom: "1px solid var(--border-color)",
        paddingBottom: 0,
      }}
    >
      {tabs.map((tab) => {
        const href = base + tab.href;
        // exact match for description (base), prefix match for others
        const isActive = tab.href === ""
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
