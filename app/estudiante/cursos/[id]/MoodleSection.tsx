"use client";
import { useState } from "react";
import Link from "next/link";
import { Folder, ChevronDown, Clock } from "lucide-react";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";

export type MoodleResource = {
  isResource: true;
  id: string;
  title: string;
  type: string;
  url: string;
  createdAt: string;
};

export type MoodleTask = {
  isResource: false;
  id: string;
  title: string;
  type: string;
  dueDate: string;
  allowLateSubmission?: boolean;
  lateSubmissionUntil?: string | null;
  submissionAllowLateSubmission?: boolean;
  submissionLateSubmissionUntil?: string | null;
  publishAt: string | null;
  description: string | null;
  isSubmitted: boolean;
  isGraded: boolean;
  grade: number | null;
  createdAt: string;
  attachmentUrl: string | null;
  isExternal?: boolean;
  resources: { id: string; title: string; type: string; url: string }[];
};

export type MoodleItem = MoodleResource | MoodleTask;

interface MoodleSectionProps {
  title: string;
  items: MoodleItem[];
  defaultOpen?: boolean;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (d.getFullYear() >= 9000) return null; // No real deadline set
    return d.toLocaleString("es-CO", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota",
    });
  } catch {
    return dateStr;
  }
}

function ResourceIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  if (t === "LINK" || t.startsWith("HTTP")) {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 4,
        background: "#e3f2fd", border: "1px solid #90caf9",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    );
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4,
      background: "#e3f2fd", border: "1px solid #90caf9",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  );
}

function TaskIcon({ isGraded, isSubmitted }: { isGraded: boolean; isSubmitted: boolean }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4,
      background: "#fce4ec", border: "1px solid #f48fb1",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2185b" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
  );
}

export default function MoodleSection({ title, items, defaultOpen = true }: MoodleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const sortedItems = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #dee2e6",
      borderRadius: "10px",
      overflow: "hidden",
      marginBottom: "1.25rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          background: open ? "#f8f9fa" : "#ffffff",
          border: "none",
          borderBottom: open ? "1px solid #dee2e6" : "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.2s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            background: "#fff3e0",
            border: "1px solid #ffe0b2",
            color: "#e65100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <Folder size={20} color="#e65100" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#212529",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {title}
            </h3>
            <p style={{
              fontSize: "0.8rem",
              color: "#6c757d",
              margin: "2px 0 0 0"
            }}>
              {sortedItems.length} {sortedItems.length === 1 ? "actividad disponible" : "actividades disponibles"}
            </p>
          </div>
        </div>

        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          border: "1px solid #ced4da",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          flexShrink: 0
        }}>
          <ChevronDown size={16} color="#495057" />
        </div>
      </button>

      {/* Section body */}
      {open && (
        <div style={{ borderTop: "1px solid #dee2e6" }}>
          {sortedItems.length === 0 ? (
            <div style={{ padding: "1rem 1.5rem", color: "#6c757d", fontSize: "0.88rem" }}>
              No hay contenido disponible en esta sección.
            </div>
          ) : (
            sortedItems.map((item) => {
              if (item.isResource) {
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.65rem 1.25rem 0.65rem 1.5rem",
                    borderBottom: "1px solid #f1f3f5",
                  }}>
                    <ResourceIcon type={item.type} />
                    <div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}
                      >
                        {item.title}
                      </a>
                      {" "}
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 700,
                        color: "#555", background: "#f0f0f0",
                        padding: "1px 5px", borderRadius: 3,
                      }}>
                        {item.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              } else {
                const href = item.id.startsWith("ex-")
                  ? "#"
                  : (item.type === "EXAM" || item.type === "FINAL")
                    ? `/estudiante/examenes/${item.id}`
                    : `/estudiante/tareas/${item.id}`;
                const apertura = formatDate(item.publishAt);
                const cierre = formatDate(item.dueDate);
                const cleanDesc = item.description
                  ? item.description.replace(/Importado desde Excel\s*([—–-]\s*columna\s*[A-Z]+)?/gi, "").trim()
                  : null;

                let deadlineStatus = null;
                if (!item.isResource) {
                  deadlineStatus = getTaskDeadlineStatus(
                    {
                      dueDate: item.dueDate,
                      allowLateSubmission: !!item.allowLateSubmission,
                      lateSubmissionUntil: item.lateSubmissionUntil,
                      type: item.type,
                    },
                    {
                      allowLateSubmission: !!item.submissionAllowLateSubmission,
                      lateSubmissionUntil: item.submissionLateSubmissionUntil,
                    }
                  );
                }
                const hasExtension = !item.isResource && deadlineStatus && deadlineStatus.isLate && !deadlineStatus.isClosed;
                const isClosedWithoutSubmission = !item.isResource && !item.isSubmitted && !hasExtension && deadlineStatus?.isClosed && !item.isExternal;

                return (
                  <div key={item.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                    padding: "0.75rem 1.25rem 0.75rem 1.5rem",
                    borderBottom: "1px solid #f1f3f5",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <TaskIcon isGraded={item.isGraded} isSubmitted={item.isSubmitted} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <Link
                            href={href}
                            style={{ color: "#0066cc", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}
                          >
                            {item.title}
                          </Link>
                          {item.isGraded && (
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                              borderRadius: 3,
                              background: "#d4edda", color: "#155724",
                              border: "1px solid #b8ddbf",
                            }}>
                              ✓ Calificado
                            </span>
                          )}
                          {item.isSubmitted && !item.isGraded && (
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                              borderRadius: 3, background: "#fff3cd", color: "#856404",
                              border: "1px solid #ffc107",
                            }}>
                              Pendiente por calificar
                            </span>
                          )}
                          {hasExtension && !item.isSubmitted && (
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                              borderRadius: 3, background: "#fff7ed", color: "#c2410c",
                              border: "1px solid #ffedd5",
                            }}>
                              ⏰ Prórroga Activa
                            </span>
                          )}
                          {isClosedWithoutSubmission && (
                            <span
                              className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900/50"
                            >
                              <Clock size={12} className="shrink-0 text-red-600" />
                              <span>Cerrada · No entregado (plazo vencido) · Nota: 1.0</span>
                            </span>
                          )}
                          {item.isExternal && (
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px",
                              borderRadius: 3, background: "#f1f5f9", color: "#475569",
                              border: "1px solid #cbd5e1"
                            }}>
                              📁 Entrega en clase
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.78rem", color: "#555", marginTop: "0.2rem" }}>
                          {apertura && (
                            <span><span style={{ fontWeight: 600 }}>Apertura:</span> {apertura}</span>
                          )}
                          {apertura && cierre && <span style={{ margin: "0 0.5rem", color: "#aaa" }}> · </span>}
                          {cierre && (
                            <span><span style={{ fontWeight: 600 }}>Cierre:</span> {cierre}</span>
                          )}
                        </div>

                        {hasExtension && !item.isSubmitted && deadlineStatus && (
                          <div style={{
                            marginTop: "0.4rem",
                            padding: "0.5rem 0.75rem",
                            background: "#fff7ed",
                            border: "1px solid #ffedd5",
                            borderRadius: "6px",
                            color: "#9a3412",
                            fontSize: "0.78rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px"
                          }}>
                            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                              <span>⏰</span> Plazo Extemporáneo Activo
                            </div>
                            <div>
                              {deadlineStatus.isUnlimitedExtension
                                ? "El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde sin fecha de expiración."
                                : `El plazo de entrega original ha vencido, pero tienes permiso para entregar tu tarea tarde hasta el ${formatToColombiaString(deadlineStatus.activeDeadline)}.`}
                            </div>
                          </div>
                        )}

                        {cleanDesc && (
                          <div style={{
                            fontSize: "0.8rem", color: "#555",
                            marginTop: "0.3rem", lineHeight: 1.4,
                          }}>
                            <span style={{ fontWeight: 700, color: "#333" }}>Instrucciones: </span>{cleanDesc}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nested Assigned Resources under Task */}
                    {((item.attachmentUrl) || (item.resources && item.resources.length > 0)) && (
                      <div style={{
                        marginLeft: "2.5rem",
                        marginTop: "0.4rem",
                        padding: "0.4rem 0.75rem",
                        background: "#f8f9fa",
                        borderRadius: "4px",
                        border: "1px solid #dee2e6",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem"
                      }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6c757d", marginBottom: "0.1rem" }}>
                          Material adjunto de la tarea:
                        </div>
                        {item.attachmentUrl && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <ResourceIcon type={item.attachmentUrl.split('.').pop() || "FILE"} />
                            <a href={item.attachmentUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0066cc", textDecoration: "none" }}>
                              Descargar Guía de la Tarea
                            </a>
                          </div>
                        )}
                        {item.resources?.map(res => (
                          <div key={res.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <ResourceIcon type={res.type} />
                            <a href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0066cc", textDecoration: "none" }}>
                              {res.title}
                            </a>
                            <span style={{ fontSize: "0.7rem", color: "#6c757d", background: "#e9ecef", padding: "1px 4px", borderRadius: "3px" }}>
                              {res.type.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            })
          )}
        </div>
      )}
    </div>
  );
}
