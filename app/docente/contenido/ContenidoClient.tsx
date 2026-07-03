"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, FileText, BookOpen,
  UploadCloud, X, Save, Loader2, ExternalLink,
  BookMarked, CalendarDays, FolderOpen
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import GDriveVisibilityToggle from "@/components/GDriveVisibilityToggle";

interface Group {
  id: string;
  name: string;
  grade: { name: string };
}

interface Resource {
  id: string;
  title: string;
  type: string;
  url: string;
  theme?: string | null;
  period?: string | null;
  active?: boolean;
  publishAt?: string | null;
  groups: Group[];
  gdriveEmail?: string | null;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  theme?: string | null;
  period?: string | null;
  type?: string;
  active?: boolean;
  weight?: number | null;
  groups: Group[];
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  groups: Group[];
  resources: Resource[];
  tasks: Task[];
}

interface Period {
  id: string;
  name: string;
  active: boolean;
}

interface ContenidoClientProps {
  courses: Course[];
  initialPeriods: Period[];
}

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗", PLAN: "📋"
};

const TAB_LABEL: Record<string, string> = {
  temas: "Temas y Unidades",
  materiales: "Recursos y Guías",
  planes: "Planes de Clase"
};

export default function ContenidoClient({ courses, initialPeriods }: ContenidoClientProps) {
  const router = useRouter();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<"temas" | "materiales" | "planes">("temas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [periods, setPeriods] = useState<Period[]>(initialPeriods);

  useEffect(() => {
    fetch("/api/docente/periodos")
      .then(res => res.json())
      .then(data => {
        if (data.periods && data.periods.length > 0) {
          setPeriods(data.periods);
        }
      })
      .catch(() => {});
  }, []);

  /* ─── Period CRUD ─────────────────────────────────────── */
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodForm, setPeriodForm] = useState({ name: "" });

  const handleCreateOrUpdatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!periodForm.name.trim()) { setError("El nombre es obligatorio"); setLoading(false); return; }
    try {
      const method = editingPeriod ? "PATCH" : "POST";
      const body = editingPeriod
        ? JSON.stringify({ id: editingPeriod.id, name: periodForm.name })
        : JSON.stringify({ name: periodForm.name });
      const res = await fetch("/api/docente/periodos", { method, headers: { "Content-Type": "application/json" }, body });
      const data = await res.json();
      if (res.ok) {
        setShowPeriodModal(false);
        const fresh = await fetch("/api/docente/periodos");
        const fd = await fresh.json();
        if (fd.periods) setPeriods(fd.periods);
        router.refresh();
      } else {
        setError(data.error || "Error al guardar el periodo");
      }
    } catch { setError("Error de conexión al guardar el periodo"); }
    finally { setLoading(false); }
  };

  const handleTogglePeriodActive = async (period: Period) => {
    try {
      const res = await fetch("/api/docente/periodos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id, active: !period.active })
      });
      if (res.ok) {
        const fresh = await fetch("/api/docente/periodos");
        const fd = await fresh.json();
        if (fd.periods) setPeriods(fd.periods);
        router.refresh();
      }
    } catch { console.error("Failed to toggle period"); }
  };

  const handleDeletePeriod = async (period: Period) => {
    const ok = await confirm({
      title: "Eliminar Periodo",
      message: `¿Eliminar "${period.name}"? Las tareas y recursos perderán su asignación.`,
      confirmText: "Eliminar", type: "danger"
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/docente/periodos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id })
      });
      if (res.ok) {
        const fresh = await fetch("/api/docente/periodos");
        const fd = await fresh.json();
        if (fd.periods) setPeriods(fd.periods);
        router.refresh();
      }
    } catch { console.error("Failed to delete period"); }
  };

  /* ─── Resource CRUD ───────────────────────────────────── */
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState({
    courseId: "",
    title: "",
    type: "PDF",
    link: "",
    theme: "",
    period: initialPeriods[0]?.name || "Periodo 1",
    groupIds: [] as string[],
    publishAt: ""
  });
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (resourceForm.courseId) {
      const course = courses.find(c => c.id === resourceForm.courseId);
      setAvailableGroups(course ? course.groups : []);
    } else {
      setAvailableGroups([]);
    }
  }, [resourceForm.courseId, courses]);

  const openNewResourceModal = (courseId?: string, periodName?: string, defaultType?: string) => {
    setError("");
    setEditingResource(null);
    setResourceForm({
      courseId: courseId || courses[0]?.id || "",
      title: "",
      type: defaultType || "PDF",
      link: "",
      theme: "",
      period: periodName || periods[0]?.name || "Periodo 1",
      groupIds: [],
      publishAt: ""
    });
    setResourceFile(null);
    setShowResourceModal(true);
  };

  const openEditResourceModal = (resource: Resource, courseId: string) => {
    setError("");
    setEditingResource(resource);
    const formattedPublishAt = resource.publishAt
      ? new Date(resource.publishAt).toISOString().slice(0, 16) : "";
    setResourceForm({
      courseId,
      title: resource.title,
      type: resource.type,
      link: resource.type === "LINK" ? resource.url : "",
      theme: resource.theme || "",
      period: resource.period || "Periodo 1",
      groupIds: resource.groups.map(g => g.id),
      publishAt: formattedPublishAt
    });
    setResourceFile(null);
    setShowResourceModal(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (resourceForm.groupIds.length === 0) {
      setError("Debes seleccionar al menos un grupo."); setLoading(false); return;
    }
    const fd = new FormData();
    if (editingResource) { fd.append("id", editingResource.id); }
    else { fd.append("courseId", resourceForm.courseId); }
    fd.append("title", resourceForm.title);
    fd.append("type", resourceForm.type);
    fd.append("period", resourceForm.period);
    fd.append("theme", resourceForm.theme);
    if (resourceForm.type === "LINK") { fd.append("link", resourceForm.link); }
    else if (resourceFile) { fd.append("file", resourceFile); }
    fd.append("groupIds", JSON.stringify(resourceForm.groupIds));
    fd.append("publishAt", resourceForm.publishAt ? new Date(resourceForm.publishAt).toISOString() : "");
    try {
      const method = editingResource ? "PATCH" : "POST";
      const res = await fetch("/api/docente/recursos", { method, body: fd });
      const data = await res.json();
      if (res.ok) { setShowResourceModal(false); router.refresh(); }
      else { setError(data.error || "Error al guardar el recurso"); }
    } catch { setError("Error de conexión al guardar el recurso"); }
    finally { setLoading(false); }
  };

  const handleDeleteResource = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar Material",
      message: "¿Estás seguro de que deseas eliminar este material?",
      confirmText: "Eliminar", type: "danger"
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/docente/recursos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) { router.refresh(); }
      else { alert("Error al eliminar el recurso"); }
    } catch { console.error("Failed to delete resource"); }
  };

  const toggleResourceActive = async (resource: Resource) => {
    try {
      await fetch("/api/docente/recursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resource.id, active: resource.active !== false ? false : true })
      });
      router.refresh();
    } catch { console.error("Failed to toggle resource status"); }
  };

  /* ─── Helpers ─────────────────────────────────────────── */
  const tabClass = (tab: string) =>
    `flex items-center gap-2 px-5 py-3 font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? "text-[#f98012] border-[#f98012]"
        : "text-muted border-transparent hover:text-foreground"
    }`;

  const periodSectionWrapper = (periodName: string, isPeriodActive: boolean, addButton: React.ReactNode, children: React.ReactNode) => (
    <div
      className="p-3 rounded-lg border"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-secondary)", opacity: isPeriodActive ? 1 : 0.6 }}
    >
      <h4
        className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPeriodActive ? "bg-orange-500" : "bg-gray-400"}`} />
          {periodName}
          {!isPeriodActive && (
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">
              Oculto para Alumnos
            </span>
          )}
        </span>
        {addButton}
      </h4>
      {children}
    </div>
  );

  const isPeriodActiveHelper = (periodName: string) => {
    if (periodName === "Otros") return true;
    const p = periods.find(p => p.name === periodName);
    return p ? p.active : true;
  };

  /* ─── JSX ──────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6 w-full text-base">

      {/* ── Tab Bar ── */}
      <div className="flex gap-2 border-b pb-1" style={{ borderColor: "var(--border-color)" }}>
        <button id="tab-temas" onClick={() => setActiveTab("temas")} className={tabClass("temas")}>
          <FolderOpen size={18} /> Temas y Unidades
        </button>
        <button id="tab-materiales" onClick={() => setActiveTab("materiales")} className={tabClass("materiales")}>
          <FileText size={18} /> Recursos y Guías
        </button>
        <button id="tab-planes" onClick={() => setActiveTab("planes")} className={tabClass("planes")}>
          <CalendarDays size={18} /> Planes de Clase
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={56} className="mx-auto mb-4 opacity-35" />
          <p className="font-semibold text-lg">No tienes asignaturas activas.</p>
          <p className="text-sm mt-1">Crea una asignatura en &quot;Gestión Asignaturas&quot; para empezar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Header ── */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-bold text-base md:text-lg">{TAB_LABEL[activeTab]}</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                ⚠️ Sin notas asociadas — solo material
              </p>
            </div>
            {activeTab !== "temas" && (
              <div className="flex items-center gap-4 flex-wrap">
                <GDriveVisibilityToggle context="materials" />
                <button
                  id="btn-nuevo-recurso"
                  onClick={() => openNewResourceModal(undefined, undefined, activeTab === "planes" ? "PLAN" : undefined)}
                  className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <Plus size={18} />
                  {activeTab === "planes" ? "Nuevo Plan de Clase" : "Subir Recurso"}
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════
              TAB: TEMAS Y UNIDADES
              Agrupación visual de recursos por tema
              ══════════════════════════════════════ */}
          {activeTab === "temas" && (
            <div className="flex flex-col gap-6">
              {courses.map(course => {
                const allRes = course.resources;
                // Collect ALL themes from both resources and tasks
                const themeSet = new Set([
                  ...allRes.map(r => r.theme).filter(Boolean),
                  ...course.tasks.map(t => t.theme).filter(Boolean)
                ] as string[]);
                const uniqueThemes = Array.from(themeSet).sort();
                const noTheme = allRes.filter(r => !r.theme);

                return (
                  <div key={course.id} className="card w-full">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <FolderOpen className="text-[#f98012]" /> {course.name}
                    </h2>

                    {allRes.length === 0 && course.tasks.length === 0 ? (
                      <p className="text-muted text-sm italic">
                        No hay contenido organizado por temas en esta asignatura.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {uniqueThemes.map(theme => {
                          const themeRes = allRes.filter(r => r.theme === theme);
                          const themeTasks = course.tasks.filter(t => t.theme === theme && t.type !== "EXAM");
                          const themeExams = course.tasks.filter(t => t.theme === theme && t.type === "EXAM");
                          const totalEvals = themeTasks.length + themeExams.length;
                          return (
                            <div key={theme} className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                              {/* Theme header */}
                              <div
                                className="flex items-center gap-3 px-4 py-2.5"
                                style={{ background: "rgba(249,128,18,0.07)", borderBottom: "1px solid var(--border-color)" }}
                              >
                                <BookMarked size={15} className="text-[#f98012] shrink-0" />
                                <span className="font-bold text-sm flex-1">{theme}</span>
                                <div className="flex items-center gap-2">
                                  {themeRes.length > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(249,128,18,0.12)", color: "#f98012" }}>
                                      {themeRes.length} {themeRes.length === 1 ? "recurso" : "recursos"}
                                    </span>
                                  )}
                                  {totalEvals > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                                      🔗 {totalEvals} {totalEvals === 1 ? "evaluación" : "evaluaciones"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Resources sub-section */}
                              {themeRes.length > 0 && (
                                <div>
                                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
                                    📁 Recursos y Material
                                  </div>
                                  {themeRes.map((res, idx) => (
                                    <div
                                      key={res.id}
                                      className="flex items-center gap-3 px-4 py-2.5"
                                      style={{
                                        background: "var(--bg-secondary)",
                                        borderBottom: idx < themeRes.length - 1 || totalEvals > 0 ? "1px solid var(--border-color)" : undefined
                                      }}
                                    >
                                      <span className="text-base">{TYPE_ICONS[res.type] || "📁"}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{res.title}</p>
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                          {res.type} · {res.period || "Sin periodo"} · {res.groups.map(g => g.name).join(", ")}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`inline-block w-2 h-2 rounded-full ${res.active !== false ? "bg-green-500" : "bg-gray-400"}`}
                                          title={res.active !== false ? "Visible" : "Oculto"}
                                        />
                                        <a href={res.url} target="_blank" rel="noreferrer"
                                          className="p-1.5 rounded hover:bg-slate-100" style={{ color: "var(--text-muted)" }} title="Abrir">
                                          <ExternalLink size={13} />
                                        </a>
                                        <button onClick={() => openEditResourceModal(res, course.id)}
                                          className="p-1.5 rounded hover:bg-orange-50" style={{ color: "var(--text-muted)" }} title="Editar">
                                          <Edit2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Linked evaluations sub-section */}
                              {totalEvals > 0 && (
                                <div>
                                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(16,185,129,0.05)", color: "#10b981", borderBottom: "1px solid var(--border-color)" }}>
                                    🔗 Evaluaciones Vinculadas
                                  </div>
                                  {themeTasks.map((task, idx) => (
                                    <div
                                      key={task.id}
                                      className="flex items-center gap-3 px-4 py-2.5"
                                      style={{
                                        background: "rgba(16,185,129,0.03)",
                                        borderBottom: idx < themeTasks.length - 1 || themeExams.length > 0 ? "1px solid var(--border-color)" : undefined
                                      }}
                                    >
                                      <span className="text-base">📝</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{task.title}</p>
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                          Tarea · {task.period || "Sin periodo"} · {task.weight ?? 0}% · {task.groups.map(g => g.name).join(", ")}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-block w-2 h-2 rounded-full ${task.active !== false ? "bg-green-500" : "bg-gray-400"}`} title={task.active !== false ? "Activa" : "Oculta"} />
                                        <a href={`/docente/tareas/${task.id}`}
                                          className="text-[11px] px-2 py-1 rounded font-semibold hover:bg-slate-100" style={{ color: "var(--text-muted)" }}
                                          title="Ver tarea">
                                          Ver →
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                  {themeExams.map((exam, idx) => (
                                    <div
                                      key={exam.id}
                                      className="flex items-center gap-3 px-4 py-2.5"
                                      style={{
                                        background: "rgba(59,130,246,0.03)",
                                        borderBottom: idx < themeExams.length - 1 ? "1px solid var(--border-color)" : undefined
                                      }}
                                    >
                                      <span className="text-base">📊</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{exam.title}</p>
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                          Examen · {exam.period || "Sin periodo"} · {exam.weight ?? 0}% · {exam.groups.map(g => g.name).join(", ")}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-block w-2 h-2 rounded-full ${exam.active !== false ? "bg-green-500" : "bg-gray-400"}`} title={exam.active !== false ? "Activo" : "Oculto"} />
                                        <a href={`/docente/tareas/${exam.id}`}
                                          className="text-[11px] px-2 py-1 rounded font-semibold hover:bg-slate-100" style={{ color: "var(--text-muted)" }}
                                          title="Ver examen">
                                          Ver →
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {noTheme.length > 0 && (
                          <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                            <div
                              className="flex items-center gap-3 px-4 py-2.5"
                              style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}
                            >
                              <FolderOpen size={15} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                              <span className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>Sin Tema</span>
                              <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{noTheme.length}</span>
                            </div>
                            <div>
                              {noTheme.map((res, idx) => (
                                <div
                                  key={res.id}
                                  className="flex items-center gap-3 px-4 py-2.5"
                                  style={{
                                    background: "var(--bg-secondary)",
                                    borderBottom: idx < noTheme.length - 1 ? "1px solid var(--border-color)" : undefined
                                  }}
                                >
                                  <span className="text-lg">{TYPE_ICONS[res.type] || "📁"}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{res.title}</p>
                                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{res.type} · {res.period || "Sin periodo"}</p>
                                  </div>
                                  <a href={res.url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB: RECURSOS Y GUÍAS
              Archivos, PDFs, videos, enlaces
              (excluye tipo PLAN)
              ══════════════════════════════════════ */}
          {activeTab === "materiales" && (
            <div className="flex flex-col gap-6">
              {courses.map(course => {
                return (
                  <div key={course.id} className="card w-full">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <BookMarked className="text-[#f98012]" /> {course.name}
                    </h2>
                    <div className="flex flex-col gap-5">
                      {[...periods.map(p => p.name), "Otros"].map(periodName => {
                        const periodRes = course.resources.filter(r => {
                          if (r.type === "PLAN") return false;
                          if (periodName === "Otros") return !r.period || !periods.map(p => p.name).includes(r.period);
                          return r.period === periodName;
                        });
                        if (periodName === "Otros" && periodRes.length === 0) return null;
                        const isActive = isPeriodActiveHelper(periodName);

                        return periodSectionWrapper(
                          periodName,
                          isActive,
                          periodName !== "Otros" && (
                            <button
                              onClick={() => openNewResourceModal(course.id, periodName)}
                              className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1"
                            >
                              <Plus size={12} /> Subir Recurso
                            </button>
                          ),
                          periodRes.length === 0 ? (
                            <p className="text-muted text-xs italic p-2">No hay recursos en este periodo.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                                    <th className="py-2 px-4 font-medium text-xs">Título</th>
                                    <th className="py-2 px-4 font-medium text-xs">Tipo</th>
                                    <th className="py-2 px-4 font-medium text-xs">Grado</th>
                                    <th className="py-2 px-4 font-medium text-xs">Grupo</th>
                                    <th className="py-2 px-4 font-medium text-xs">Tema</th>
                                    <th className="py-2.5 px-4 font-bold text-center text-xs">Estado</th>
                                    <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {periodRes.map(res => (
                                    <tr key={res.id} style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
                                      <td className="py-3 px-4 font-semibold text-sm">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-2">
                                            <span>{TYPE_ICONS[res.type] || "📁"}</span>
                                            <span>{res.title}</span>
                                          </div>
                                          {res.gdriveEmail && <GDriveEmailDisplay email={res.gdriveEmail} context="materials" />}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-xs font-semibold">{res.type}</td>
                                      <td className="py-3 px-4 text-xs" style={{ color: "var(--text-muted)" }}>
                                        {Array.from(new Set(res.groups.map(g => g.grade?.name))).filter(Boolean).join(", ") || "Sin Grado"}
                                      </td>
                                      <td className="py-3 px-4 text-xs" style={{ color: "var(--text-muted)" }}>
                                        {res.groups.map(g => g.name).join(", ") || "Sin Grupo"}
                                      </td>
                                      <td className="py-3 px-4 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{res.theme || "-"}</td>
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => toggleResourceActive(res)}
                                            style={{
                                              width: "42px", height: "22px", borderRadius: "9999px",
                                              background: res.active !== false ? "var(--primary-color, #f98012)" : "#cbd5e1",
                                              border: "none", padding: 0, outline: "none", cursor: "pointer"
                                            }}
                                            title={res.active !== false ? "Visible (click para ocultar)" : "Oculto (click para mostrar)"}
                                          >
                                            <span
                                              className="pointer-events-none inline-block rounded-full bg-white shadow-md"
                                              style={{
                                                width: "18px", height: "18px",
                                                transform: res.active !== false ? "translateX(22px)" : "translateX(2px)",
                                                transition: "transform 0.2s", display: "block"
                                              }}
                                            />
                                          </button>
                                          {res.active !== false && res.publishAt && new Date(res.publishAt) > new Date() && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                              Programado
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                          <a href={res.url} target="_blank" rel="noreferrer"
                                            className="p-1.5 rounded hover:bg-slate-100" style={{ color: "var(--text-muted)" }} title="Ver">
                                            <ExternalLink size={16} />
                                          </a>
                                          <button onClick={() => openEditResourceModal(res, course.id)}
                                            className="p-1.5 rounded hover:bg-orange-50" style={{ color: "var(--text-muted)" }} title="Editar">
                                            <Edit2 size={16} />
                                          </button>
                                          <button onClick={() => handleDeleteResource(res.id)}
                                            className="p-1.5 rounded hover:bg-red-50" style={{ color: "var(--text-muted)" }} title="Eliminar">
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {courses.every(c => c.resources.filter(r => r.type !== "PLAN").length === 0) && (
                <div className="card text-center py-12 text-muted">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No has subido ningún recurso aún.</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB: PLANES DE CLASE
              Solo tipo PLAN
              ══════════════════════════════════════ */}
          {activeTab === "planes" && (
            <div className="flex flex-col gap-6">
              {courses.map(course => {
                const planRes = course.resources.filter(r => r.type === "PLAN");
                return (
                  <div key={course.id} className="card w-full">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <CalendarDays className="text-[#f98012]" /> {course.name}
                    </h2>
                    <div className="flex flex-col gap-5">
                      {[...periods.map(p => p.name), "Otros"].map(periodName => {
                        const periodPlans = planRes.filter(r => {
                          if (periodName === "Otros") return !r.period || !periods.map(p => p.name).includes(r.period);
                          return r.period === periodName;
                        });
                        if (periodName === "Otros" && periodPlans.length === 0) return null;
                        const isActive = isPeriodActiveHelper(periodName);

                        return periodSectionWrapper(
                          periodName,
                          isActive,
                          periodName !== "Otros" && (
                            <button
                              onClick={() => openNewResourceModal(course.id, periodName, "PLAN")}
                              className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1"
                            >
                              <Plus size={12} /> Nuevo Plan
                            </button>
                          ),
                          periodPlans.length === 0 ? (
                            <p className="text-muted text-xs italic p-2">No hay planes de clase en este periodo.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {periodPlans.map(plan => (
                                <div
                                  key={plan.id}
                                  className="flex items-center gap-3 p-3 rounded-lg border"
                                  style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
                                >
                                  <CalendarDays size={20} className="text-[#f98012] shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm">{plan.title}</p>
                                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                      {plan.theme || "Sin tema"} · {plan.groups.map(g => `${g.grade.name} ${g.name}`).join(", ")}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${plan.active !== false ? "bg-green-500" : "bg-gray-400"}`}
                                      title={plan.active !== false ? "Visible" : "Oculto"}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleResourceActive(plan)}
                                      style={{
                                        width: "36px", height: "18px", borderRadius: "9999px",
                                        background: plan.active !== false ? "var(--primary-color, #f98012)" : "#cbd5e1",
                                        border: "none", padding: 0, outline: "none", cursor: "pointer"
                                      }}
                                      title={plan.active !== false ? "Visible (click para ocultar)" : "Oculto (click para mostrar)"}
                                    >
                                      <span
                                        className="pointer-events-none inline-block rounded-full bg-white shadow-md"
                                        style={{
                                          width: "14px", height: "14px",
                                          transform: plan.active !== false ? "translateX(20px)" : "translateX(2px)",
                                          transition: "transform 0.2s", display: "block"
                                        }}
                                      />
                                    </button>
                                    <a href={plan.url} target="_blank" rel="noreferrer"
                                      className="p-1.5 rounded hover:bg-slate-100" style={{ color: "var(--text-muted)" }} title="Ver Plan">
                                      <ExternalLink size={14} />
                                    </a>
                                    <button onClick={() => openEditResourceModal(plan, course.id)}
                                      className="p-1.5 rounded hover:bg-orange-50" style={{ color: "var(--text-muted)" }} title="Editar">
                                      <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteResource(plan.id)}
                                      className="p-1.5 rounded hover:bg-red-50" style={{ color: "var(--text-muted)" }} title="Eliminar">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {courses.every(c => c.resources.filter(r => r.type === "PLAN").length === 0) && (
                <div className="card text-center py-12 text-muted">
                  <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No has creado ningún plan de clase aún.</p>
                  <p className="text-xs mt-1 opacity-70">Los planes son documentos de planificación sin notas asociadas.</p>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ══ Modal: Recurso / Plan de Clase ══ */}
      {showResourceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowResourceModal(false)}>
          <form onSubmit={handleSaveResource} className="modal-content w-full max-w-lg" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">
                {editingResource
                  ? (resourceForm.type === "PLAN" ? "Editar Plan de Clase" : "Editar Material")
                  : (resourceForm.type === "PLAN" ? "Nuevo Plan de Clase" : "Nuevo Material")}
              </h2>
              <button type="button" onClick={() => setShowResourceModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            {error && <div className="alert alert-danger mb-4 text-xs font-bold">{error}</div>}

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Asignatura *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.courseId}
                  onChange={e => setResourceForm({ ...resourceForm, courseId: e.target.value })} required>
                  <option value="">Selecciona una asignatura</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Periodo *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.period}
                  onChange={e => setResourceForm({ ...resourceForm, period: e.target.value })} required>
                  {periods.filter(p => p.active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  {resourceForm.period && !periods.find(p => p.name === resourceForm.period)?.active && (
                    <option value={resourceForm.period}>{resourceForm.period}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Título *</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs"
                  placeholder={resourceForm.type === "PLAN" ? "Ej. Plan de clase - Cinemática" : "Ej. Guía de Álgebra Lineal"}
                  value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} required />
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Tema</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs" placeholder="Ej. Cinemática, Ecuaciones"
                  value={resourceForm.theme} onChange={e => setResourceForm({ ...resourceForm, theme: e.target.value })} />
              </div>
            </div>

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Tipo de Material *</label>
              <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.type}
                onChange={e => setResourceForm({ ...resourceForm, type: e.target.value })}>
                <option value="PDF">📄 PDF</option>
                <option value="WORD">📝 Documento Word</option>
                <option value="PPT">📊 Presentación PPT</option>
                <option value="IMAGE">🖼️ Imagen</option>
                <option value="VIDEO">🎬 Video</option>
                <option value="LINK">🔗 Enlace Web</option>
                <option value="PLAN">📋 Plan de Clase</option>
              </select>
            </div>

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Programar Publicación (Opcional)</label>
              <input type="datetime-local" className="input-field py-1.5 px-3 text-xs"
                value={resourceForm.publishAt} onChange={e => setResourceForm({ ...resourceForm, publishAt: e.target.value })} />
              <p className="text-[10px] text-muted mt-1">Dejar vacío para publicar inmediatamente.</p>
            </div>

            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Asignar a Grupos *</label>
              <div className="border rounded-lg p-2.5 max-h-[120px] overflow-y-auto flex flex-col gap-1.5 bg-slate-50" style={{ borderColor: "var(--border-color)" }}>
                {availableGroups.map(g => {
                  const isChecked = resourceForm.groupIds.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-primary">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? resourceForm.groupIds.filter(id => id !== g.id)
                            : [...resourceForm.groupIds, g.id];
                          setResourceForm({ ...resourceForm, groupIds: newIds });
                        }}
                        className="rounded"
                        style={{ accentColor: "#f98012" }}
                      />
                      <span>{g.grade.name} - {g.name}</span>
                    </label>
                  );
                })}
                {availableGroups.length === 0 && <span className="text-xs text-muted italic">Selecciona una asignatura para cargar los grupos.</span>}
              </div>
            </div>

            {resourceForm.type === "LINK" ? (
              <div className="input-group mb-4">
                <label className="text-xs font-bold mb-1">Dirección URL *</label>
                <input type="url" className="input-field py-1.5 px-3 text-xs" placeholder="https://ejemplo.com"
                  value={resourceForm.link} onChange={e => setResourceForm({ ...resourceForm, link: e.target.value })} required />
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5">
                  {editingResource ? "Nuevo Archivo (Opcional)" : "Archivo *"}
                </label>
                <label htmlFor="resource-file"
                  className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-[#f98012] transition-colors"
                  style={{ borderColor: "var(--border-color)" }}>
                  <UploadCloud size={24} className="mx-auto mb-1.5 text-[#f98012]" />
                  <p className="text-xs font-bold">{resourceFile ? resourceFile.name : "Selecciona un archivo"}</p>
                  <input id="resource-file" type="file" className="hidden"
                    onChange={e => setResourceFile(e.target.files?.[0] || null)} required={!editingResource} />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowResourceModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary text-xs" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingResource ? "Guardar Cambios" : (resourceForm.type === "PLAN" ? "Crear Plan" : "Subir Material")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ Modal: Periodo ══ */}
      {showPeriodModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPeriodModal(false)}>
          <form onSubmit={handleCreateOrUpdatePeriod} className="modal-content w-full max-w-md" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingPeriod ? "Editar Periodo" : "Nuevo Periodo"}</h2>
              <button type="button" onClick={() => setShowPeriodModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            {error && <div className="alert alert-danger mb-4 text-xs font-bold">{error}</div>}
            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Nombre del Periodo *</label>
              <input
                type="text" className="input-field py-1.5 px-3 text-xs"
                placeholder="Ej. Periodo 5, Semestre 1"
                value={periodForm.name}
                onChange={e => setPeriodForm({ name: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowPeriodModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary text-xs" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingPeriod ? "Guardar Cambios" : "Crear Periodo"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
