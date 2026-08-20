"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, FileText, BookOpen,
  UploadCloud, X, Save, Loader2, ExternalLink,
  BookMarked
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

export default function ContenidoClient({ courses, initialPeriods }: ContenidoClientProps) {
  const router = useRouter();
  const confirm = useConfirm();

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

  /* ─── Resource CRUD ───────────────────────────────────── */
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState({
    courseId: "",
    title: "",
    type: "PDF",
    link: "",
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
    const p = periods.find(p => p.name === periodName);
    return p ? p.active : true;
  };

  /* ─── JSX ──────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6 w-full text-base">

      {courses.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={56} className="mx-auto mb-4 opacity-35" />
          <p className="font-semibold text-lg">No tienes asignaturas activas.</p>
          <p className="text-sm mt-1">Crea una asignatura en &quot;Gestión Asignaturas&quot; para empezar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Header Actions ── */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-[#f98012]" /> Recursos y Guías de Asignatura
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <GDriveEmailDisplay context="materials" />
              <GDriveVisibilityToggle context="materials" />
              <button
                id="btn-nuevo-recurso"
                onClick={() => openNewResourceModal(undefined, undefined, undefined)}
                className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
              >
                <Plus size={18} /> Subir Recurso
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════
              LISTA DE RECURSOS Y GUÍAS
              ══════════════════════════════════════ */}
          <div className="flex flex-col gap-6">
            {courses.map(course => {
              return (
                <div key={course.id} className="card w-full">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BookMarked className="text-[#f98012]" /> {course.name}
                  </h3>

                  <div className="flex flex-col gap-5">
                    {periods.map(p => p.name).map(periodName => {
                      const periodRes = course.resources.filter(r => {
                        if (r.type === "PLAN") return false;
                        if (r.type === "THEME") return false;
                        return r.period === periodName;
                      });
                      const isActive = isPeriodActiveHelper(periodName);

                      return periodSectionWrapper(
                        periodName,
                        isActive,
                        (
                          <button
                            onClick={() => openNewResourceModal(course.id, periodName)}
                            className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1"
                          >
                            <Plus size={12} /> Subir Recurso
                          </button>
                        ),
                        <>
                          {periodRes.length === 0 ? (
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
                          )}
                        </>
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

        </div>
      )}

      {/* ══ Modal: Recurso ══ */}
      {showResourceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowResourceModal(false)}>
          <form onSubmit={handleSaveResource} className="modal-content w-full max-w-lg" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">
                {editingResource ? "Editar Material" : "Nuevo Material"}
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

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Título *</label>
              <input type="text" className="input-field py-1.5 px-3 text-xs"
                placeholder="Ej. Guía de Álgebra Lineal"
                value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} required />
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
                {editingResource ? "Guardar Cambios" : "Subir Material"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
