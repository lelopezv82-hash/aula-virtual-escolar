"use client";
import { useState } from "react";
import Link from "next/link";

type ResourceItem = {
  id: string;
  title: string;
  type: string;
  url: string;
};

type TaskItem = {
  id: string;
  title: string;
  type: string; // TASK | EXAM | FINAL | SER | ATTEND
  dueDate: string;
  publishAt: string | null;
  isSubmitted: boolean;
  isGraded: boolean;
  grade: number | null;
};

interface MoodleSectionProps {
  title: string;
  resources: ResourceItem[];
  tasks: TaskItem[];
  defaultOpen?: boolean;
}

function ResourceIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  const color = t === "LINK" ? "#17a2b8" : "#20c997";
  const label = t === "PDF" ? "PDF" : t === "WORD" ? "DOC" : t === "PPT" ? "PPT" : t === "IMAGE" ? "IMG" : t === "VIDEO" ? "VID" : "🔗";

  if (t === "LINK") {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 4,
        background: "#e8f8fb", border: "1px solid #b2ebf2",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    );
  }

  return (
    <div style={{
      width: 36, height: 36, borderRadius: 4,
      background: "#e6f9f4", border: "1px solid #b2dfdb",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      flexDirection: "column", gap: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  );
}

function TaskIcon({ type, isGraded, isSubmitted }: { type: string; isGraded: boolean; isSubmitted: boolean }) {
  const isExam = type === "EXAM" || type === "FINAL";
  const color = isGraded ? "#e83e8c" : isSubmitted ? "#6f42c1" : "#e83e8c";
  const bg = isGraded ? "#fce4ef" : isSubmitted ? "#ede7f6" : "#fce4ef";
  const border = isGraded ? "#f8bbd0" : isSubmitted ? "#d1c4e9" : "#f8bbd0";

  return (
    <div style={{
      width: 36, height: 36, borderRadius: 4,
      background: bg, border: `1px solid ${border}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {isExam ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("es-CO", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota",
    });
  } catch {
    return dateStr;
  }
}

export default function MoodleSection({ title, resources, tasks, defaultOpen = true }: MoodleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const isEmpty = resources.length === 0 && tasks.length === 0;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #dee2e6",
      borderRadius: "6px",
      overflow: "hidden",
      marginBottom: "1rem",
    }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#222" }}>{title}</span>
      </button>

      {/* Section body */}
      {open && (
        <div style={{ borderTop: "1px solid #dee2e6" }}>
          {isEmpty ? (
            <div style={{ padding: "1.25rem 1.5rem", color: "#6c757d", fontSize: "0.9rem" }}>
              No hay contenido disponible en esta sección.
            </div>
          ) : (
            <>
              {/* Resources */}
              {resources.map((r, idx) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: "0.85rem",
                  padding: "0.75rem 1.25rem 0.75rem 1.5rem",
                  borderBottom: "1px solid #f1f3f5",
                  background: "#fff",
                }}>
                  <ResourceIcon type={r.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.92rem", textDecoration: "none" }}
                      onMouseOver={e => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseOut={e => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {r.title}
                    </a>
                    <span style={{
                      marginLeft: 8, fontSize: "0.72rem", fontWeight: 700,
                      color: "#555", background: "#f0f0f0",
                      padding: "1px 5px", borderRadius: 3,
                    }}>
                      {r.type.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}

              {/* Tasks / Exams */}
              {tasks.map((t) => {
                const href = (t.type === "EXAM" || t.type === "FINAL")
                  ? `/estudiante/examenes/${t.id}`
                  : `/estudiante/tareas/${t.id}`;

                return (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "flex-start", gap: "0.85rem",
                    padding: "0.75rem 1.25rem 0.75rem 1.5rem",
                    borderBottom: "1px solid #f1f3f5",
                    background: "#fff",
                  }}>
                    <TaskIcon type={t.type} isGraded={t.isGraded} isSubmitted={t.isSubmitted} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Link
                          href={href}
                          style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.92rem", textDecoration: "none" }}
                          onMouseOver={e => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseOut={e => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {t.title}
                        </Link>
                        {t.isGraded && t.grade !== null && (
                          <span style={{
                            fontSize: "0.72rem", fontWeight: 700, padding: "1px 6px",
                            borderRadius: 3, background: Number(t.grade) >= 3 ? "#d4edda" : "#f8d7da",
                            color: Number(t.grade) >= 3 ? "#155724" : "#721c24",
                            border: `1px solid ${Number(t.grade) >= 3 ? "#b8ddbf" : "#f5c6cb"}`,
                          }}>
                            {Number(t.grade).toFixed(1)}
                          </span>
                        )}
                        {t.isSubmitted && !t.isGraded && (
                          <span style={{
                            fontSize: "0.72rem", fontWeight: 700, padding: "1px 6px",
                            borderRadius: 3, background: "#cce5ff", color: "#004085",
                            border: "1px solid #b3d4f0",
                          }}>
                            Entregado
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#666", marginTop: "0.2rem" }}>
                        <span style={{ fontWeight: 600, color: "#555" }}>Cierre:</span>{" "}
                        {formatDate(t.dueDate)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
