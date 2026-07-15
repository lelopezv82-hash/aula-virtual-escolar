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
  type: string;
  dueDate: string;
  publishAt: string | null;
  description: string | null;
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString("es-CO", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota",
    });
  } catch {
    return dateStr;
  }
}

function ResourceIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  if (t === "LINK") {
    return (
      <div style={{
        width: 34, height: 34, borderRadius: 4,
        background: "#e3f2fd", border: "1px solid #90caf9",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    );
  }
  // folder icon for non-file types or generic
  if (t === "FOLDER") {
    return (
      <div style={{
        width: 34, height: 34, borderRadius: 4,
        background: "#e3f2fd", border: "1px solid #90caf9",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
    );
  }
  // PPT / PDF / WORD / IMAGE / VIDEO — file icon (teal)
  const labelColor = t === "PDF" ? "#c62828" : t === "PPT" ? "#1565c0" : "#1b5e20";
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 4,
      background: "#e3f2fd", border: "1px solid #90caf9",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      position: "relative",
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  );
}

function TaskIcon({ isGraded, isSubmitted }: { isGraded: boolean; isSubmitted: boolean }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 4,
      background: "#fce4ec", border: "1px solid #f48fb1",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c2185b" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
  );
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
          padding: "0.9rem 1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Circle toggle icon like Moodle */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          border: "2px solid #0066cc",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, background: open ? "#e8f0fe" : "#fff",
          transition: "background 0.2s",
        }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#0066cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#222" }}>{title}</span>
      </button>

      {/* Section body */}
      {open && (
        <div style={{ borderTop: "1px solid #dee2e6" }}>
          {isEmpty ? (
            <div style={{ padding: "1rem 1.5rem", color: "#6c757d", fontSize: "0.88rem" }}>
              No hay contenido disponible en esta sección.
            </div>
          ) : (
            <>
              {/* Resources */}
              {resources.map((r) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.65rem 1.25rem 0.65rem 1.5rem",
                  borderBottom: "1px solid #f1f3f5",
                }}>
                  <ResourceIcon type={r.type} />
                  <div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}
                    >
                      {r.title}
                    </a>
                    {" "}
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700,
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
                const apertura = formatDate(t.publishAt);
                const cierre = formatDate(t.dueDate);
                const cleanDesc = t.description
                  ? t.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
                  : null;

                return (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "flex-start", gap: "0.75rem",
                    padding: "0.75rem 1.25rem 0.75rem 1.5rem",
                    borderBottom: "1px solid #f1f3f5",
                  }}>
                    <TaskIcon isGraded={t.isGraded} isSubmitted={t.isSubmitted} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title + badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Link
                          href={href}
                          style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}
                        >
                          {t.title}
                        </Link>
                        {t.isGraded && t.grade !== null && (
                          <span style={{
                            fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                            borderRadius: 3,
                            background: Number(t.grade) >= 3 ? "#d4edda" : "#f8d7da",
                            color: Number(t.grade) >= 3 ? "#155724" : "#721c24",
                            border: `1px solid ${Number(t.grade) >= 3 ? "#b8ddbf" : "#f5c6cb"}`,
                          }}>
                            {Number(t.grade).toFixed(1)}
                          </span>
                        )}
                        {t.isSubmitted && !t.isGraded && (
                          <span style={{
                            fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                            borderRadius: 3, background: "#cce5ff", color: "#004085",
                            border: "1px solid #b3d4f0",
                          }}>
                            Entregado
                          </span>
                        )}
                      </div>

                      {/* Dates */}
                      <div style={{ fontSize: "0.78rem", color: "#555", marginTop: "0.2rem" }}>
                        {apertura && (
                          <span><span style={{ fontWeight: 600 }}>Apertura:</span> {apertura}</span>
                        )}
                        {apertura && cierre && <span style={{ margin: "0 0.5rem", color: "#aaa" }}>·</span>}
                        {cierre && (
                          <span><span style={{ fontWeight: 600 }}>Cierre:</span> {cierre}</span>
                        )}
                      </div>

                      {/* Description */}
                      {cleanDesc && (
                        <div style={{
                          fontSize: "0.8rem", color: "#0066cc",
                          marginTop: "0.3rem", lineHeight: 1.4,
                        }}>
                          {cleanDesc}
                        </div>
                      )}
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
