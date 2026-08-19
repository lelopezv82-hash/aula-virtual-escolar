"use client";
import { useState } from "react";
import { ChevronDown, Folder, Download, Link as LinkIcon, Calendar, FileText } from "lucide-react";

export type ResourceItem = {
  id: string;
  title: string;
  type: string;
  url: string;
  period: string | null;
  themeTitle?: string | null;
  sourceType: "MATERIAL" | "TASK_GUIDE" | "TASK_RESOURCE";
  taskTitle?: string;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗", ZIP: "📦"
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all mb-4">
      {/* Header clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Folder size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resources.length} {resources.length === 1 ? "material disponible" : "materiales disponibles"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown size={16} className="text-slate-600 dark:text-slate-300" />
          </div>
        </div>
      </button>

      {/* Body containing resources list */}
      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col gap-3">
          {resources.map((resource) => {
            const isLink = resource.type.toUpperCase() === "LINK" || resource.url.startsWith("http");
            return (
              <div
                key={resource.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-orange-200 dark:hover:border-orange-900/50 transition-all"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 flex items-center justify-center text-xl shrink-0">
                    {TYPE_ICONS[resource.type.toUpperCase()] || "📁"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug break-words"
                      title={resource.title}
                    >
                      {resource.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {resource.type.toUpperCase()}
                      </span>

                      {resource.period && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1">
                          <Calendar size={11} />
                          {resource.period}
                        </span>
                      )}

                      {resource.sourceType === "TASK_GUIDE" && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 flex items-center gap-1">
                          <FileText size={11} />
                          Guía de actividad
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xs transition-colors"
                    title={isLink ? "Abrir enlace" : "Descargar o ver archivo"}
                  >
                    {isLink ? <LinkIcon size={14} /> : <Download size={14} />}
                    <span>{isLink ? "Abrir enlace" : "Descargar"}</span>
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
