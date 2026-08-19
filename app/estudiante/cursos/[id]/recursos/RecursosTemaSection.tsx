"use client";
import { useState } from "react";
import { ChevronDown, Folder, Download, Link as LinkIcon } from "lucide-react";

export type ResourceItem = {
  id: string;
  title: string;
  type: string;
  url: string;
  period?: string | null;
  themeTitle?: string | null;
  sourceType: "MATERIAL" | "TASK_GUIDE" | "TASK_RESOURCE";
  taskTitle?: string;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄",
  WORD: "📝",
  DOC: "📝",
  DOCX: "📝",
  PPT: "📊",
  PPTX: "📊",
  EXCEL: "📈",
  XLS: "📈",
  XLSX: "📈",
  IMAGE: "🖼️",
  PNG: "🖼️",
  JPG: "🖼️",
  JPEG: "🖼️",
  VIDEO: "🎬",
  LINK: "🔗",
  ENLACE: "🔗",
  DRIVE: "📁",
  ZIP: "📦",
  RAR: "📦"
};

interface RecursosTemaSectionProps {
  title: string;
  resources: ResourceItem[];
  defaultOpen?: boolean;
}

export default function RecursosTemaSection({
  title,
  resources,
  defaultOpen = true,
}: RecursosTemaSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #dee2e6",
      borderRadius: "10px",
      overflow: "hidden",
      marginBottom: "1.25rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      {/* Header clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          background: isOpen ? "#f8f9fa" : "#ffffff",
          border: "none",
          borderBottom: isOpen ? "1px solid #dee2e6" : "none",
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
              {resources.length} {resources.length === 1 ? "material disponible" : "materiales disponibles"}
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
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          flexShrink: 0
        }}>
          <ChevronDown size={16} color="#495057" />
        </div>
      </button>

      {/* Body containing resources list */}
      {isOpen && (
        <div style={{
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: "#ffffff"
        }}>
          {resources.map((resource) => {
            const isLink = resource.type.toUpperCase() === "LINK" ||
              resource.type.toUpperCase() === "ENLACE" ||
              resource.type.toUpperCase() === "DRIVE" ||
              resource.url.startsWith("http");

            const iconChar = TYPE_ICONS[resource.type.toUpperCase()] || "📄";

            return (
              <div
                key={resource.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.85rem 1.15rem",
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                  background: "#fcfcfd"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                    flexShrink: 0
                  }}>
                    {iconChar}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        color: "#1e293b",
                        lineHeight: 1.4,
                        wordBreak: "break-word"
                      }}
                      title={resource.title}
                    >
                      {resource.title}
                    </h4>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.45rem",
                      padding: "0.5rem 0.95rem",
                      borderRadius: "6px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      textDecoration: "none",
                      border: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                    title={isLink ? "Abrir enlace" : "Descargar archivo"}
                  >
                    {isLink ? <LinkIcon size={14} color="#ffffff" /> : <Download size={14} color="#ffffff" />}
                    <span style={{ color: "#ffffff" }}>{isLink ? "Abrir enlace" : "Descargar"}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
