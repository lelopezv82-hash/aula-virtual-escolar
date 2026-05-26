"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Plus, Edit2, Trash2, X, Save, Loader2,
  FileText, Link as LinkIcon, UploadCloud, Trash
} from "lucide-react";

interface Course { id: string; name: string; description: string | null; _count: { tasks: number; resources: number } }
interface Resource { id: string; title: string; type: string; url: string }

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default function CursosPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Resource management
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: "", type: "PDF", link: "" });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/docente/cursos");
    const data = await res.json();
    if (data.courses) setCourses(data.courses);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const fetchResources = async (courseId: string) => {
    const res = await fetch(`/api/docente/recursos?courseId=${courseId}`);
    const data = await res.json();
    if (data.resources) setResources(data.resources);
  };

  const openSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    await fetchResources(course.id);
  };

  const openCreateCourse = () => {
    setEditCourse(null);
    setCourseForm({ name: "", description: "" });
    setError("");
    setShowCourseModal(true);
  };

  const openEditCourse = (c: Course) => {
    setEditCourse(c);
    setCourseForm({ name: c.name, description: c.description || "" });
    setError("");
    setShowCourseModal(true);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    const method = editCourse ? "PATCH" : "POST";
    const body = editCourse ? { id: editCourse.id, ...courseForm } : courseForm;
    const res = await fetch("/api/docente/cursos", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setShowCourseModal(false); fetchCourses(); }
    else setError(data.error || "Error al guardar");
  };

  const deleteCourse = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el curso "${name}"? Se eliminarán todas sus tareas y recursos.`)) return;
    await fetch("/api/docente/cursos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (selectedCourse?.id === id) setSelectedCourse(null);
    fetchCourses();
  };

  const saveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setUploadingResource(true); setError("");
    const fd = new FormData();
    fd.append("courseId", selectedCourse.id);
    fd.append("title", resourceForm.title);
    fd.append("type", resourceForm.type);
    if (resourceFile) fd.append("file", resourceFile);
    if (resourceForm.link) fd.append("link", resourceForm.link);

    const res = await fetch("/api/docente/recursos", { method: "POST", body: fd });
    const data = await res.json();
    setUploadingResource(false);
    if (res.ok) {
      setShowResourceModal(false);
      setResourceForm({ title: "", type: "PDF", link: "" });
      setResourceFile(null);
      fetchResources(selectedCourse.id);
      fetchCourses();
    } else setError(data.error || "Error al subir recurso");
  };

  const deleteResource = async (id: string) => {
    if (!confirm("¿Eliminar este recurso?")) return;
    await fetch("/api/docente/recursos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (selectedCourse) fetchResources(selectedCourse.id);
  };

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header flex justify-between items-center">
        <div>
          <h1>Mis Cursos</h1>
          <p>Organiza tus asignaturas y sube material educativo.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateCourse}>
          <Plus size={18} /> Nuevo Curso
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedCourse ? "340px 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Courses list */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={36} /></div>
          ) : courses.length === 0 ? (
            <div className="card text-center py-10 text-muted">
              <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p>No tienes cursos creados.</p>
            </div>
          ) : (
            courses.map(course => (
              <div key={course.id}
                className="card"
                style={{ cursor: "pointer", borderLeft: selectedCourse?.id === course.id ? "4px solid var(--primary-color)" : "4px solid transparent", transition: "border 0.2s" }}
                onClick={() => openSelectCourse(course)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{course.name}</h3>
                    <p className="text-muted text-sm mt-1">{course.description || "Sin descripción"}</p>
                    <div className="flex gap-4 mt-3 text-sm text-muted">
                      <span>📋 {course._count.tasks} tareas</span>
                      <span>📁 {course._count.resources} recursos</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button title="Editar" onClick={e => { e.stopPropagation(); openEditCourse(course); }}
                      className="p-2 rounded hover:bg-blue-50 transition-colors" style={{ color: "var(--primary-color)" }}>
                      <Edit2 size={15} />
                    </button>
                    <button title="Eliminar" onClick={e => { e.stopPropagation(); deleteCourse(course.id, course.name); }}
                      className="p-2 rounded hover:bg-red-50 transition-colors" style={{ color: "var(--danger)" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resources panel */}
        {selectedCourse && (
          <div className="card">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-bold">{selectedCourse.name}</h2>
                <p className="text-muted text-sm">Material educativo del curso</p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary text-sm" onClick={() => { setError(""); setResourceForm({ title: "", type: "PDF", link: "" }); setResourceFile(null); setShowResourceModal(true); }}>
                  <Plus size={16} /> Subir Recurso
                </button>
                <button className="p-2 rounded hover:bg-gray-100" onClick={() => setSelectedCourse(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {resources.length === 0 ? (
              <div className="text-center py-10 text-muted">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p>Aún no hay recursos en este curso.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {resources.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "1.5rem" }}>{TYPE_ICONS[r.type] || "📁"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted">{r.type}</p>
                    </div>
                    <a href={r.url} target="_blank" rel="noreferrer" className="btn btn-secondary text-sm px-3 py-1.5">Ver</a>
                    <button onClick={() => deleteResource(r.id)} className="p-2 rounded hover:bg-red-50 transition-colors" style={{ color: "var(--danger)" }}>
                      <Trash size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Course Modal */}
      {showCourseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowCourseModal(false)}>
          <form onSubmit={saveCourse} className="card" style={{ width: "100%", maxWidth: "480px" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editCourse ? "Editar Curso" : "Nuevo Curso"}</h2>
              <button type="button" onClick={() => setShowCourseModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            <div className="input-group mb-4">
              <label>Nombre del Curso *</label>
              <input type="text" className="input-field" placeholder="Ej. Física 11°" value={courseForm.name}
                onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} required />
            </div>
            <div className="input-group mb-5">
              <label>Descripción</label>
              <textarea className="input-field" rows={3} placeholder="Descripción del curso…"
                value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editCourse ? "Guardar Cambios" : "Crear Curso"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resource Upload Modal */}
      {showResourceModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowResourceModal(false)}>
          <form onSubmit={saveResource} className="card" style={{ width: "100%", maxWidth: "500px" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Subir Recurso</h2>
              <button type="button" onClick={() => setShowResourceModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            <div className="input-group mb-3">
              <label>Título *</label>
              <input type="text" className="input-field" placeholder="Ej. Guía de estudio - Unidad 1"
                value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} required />
            </div>
            <div className="input-group mb-4">
              <label>Tipo de Recurso *</label>
              <select className="input-field" value={resourceForm.type} onChange={e => setResourceForm({ ...resourceForm, type: e.target.value })}>
                <option value="PDF">📄 PDF</option>
                <option value="WORD">📝 Word / Documento</option>
                <option value="PPT">📊 PowerPoint</option>
                <option value="IMAGE">🖼️ Imagen</option>
                <option value="VIDEO">🎬 Video</option>
                <option value="LINK">🔗 Enlace externo</option>
              </select>
            </div>

            {resourceForm.type === "LINK" ? (
              <div className="input-group mb-4">
                <label>URL del enlace *</label>
                <input type="url" className="input-field" placeholder="https://…"
                  value={resourceForm.link} onChange={e => setResourceForm({ ...resourceForm, link: e.target.value })} required />
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Archivo *</label>
                <label htmlFor="resource-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
                  <UploadCloud size={32} className="mx-auto mb-2" style={{ color: "var(--primary-color)" }} />
                  <p className="text-sm font-medium">{resourceFile ? resourceFile.name : "Haz clic para seleccionar un archivo"}</p>
                  <p className="text-xs text-muted mt-1">PDF, Word, PPT, imágenes</p>
                  <input id="resource-file" type="file" className="hidden" onChange={e => setResourceFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowResourceModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={uploadingResource}>
                {uploadingResource ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                Subir Recurso
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
