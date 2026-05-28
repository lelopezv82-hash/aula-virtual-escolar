"use client";

import { useState } from "react";
import { 
  FileText, Plus, ExternalLink, Trash2, Loader2, 
  UploadCloud, X, Save, ClipboardList, BookOpen, ToggleLeft, ToggleRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

interface Resource {
  id: string;
  title: string;
  type: string;
  url: string;
  theme?: string | null;
  period?: string | null;
}

interface Task {
  id: string;
  title: string;
  theme?: string | null;
  weight?: number | null;
  dueDate: string;
  period?: string | null;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  period1Active: boolean;
  period2Active: boolean;
  period3Active: boolean;
  period4Active: boolean;
  resources: Resource[];
  tasks: Task[];
}

interface PeriodoClientProps {
  courses: Course[];
  periodName: string;
}

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default function PeriodoClient({ courses, periodName }: PeriodoClientProps) {
  const router = useRouter();
  const confirm = useConfirm();
  
  // Resource Modal State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: "", type: "PDF", link: "", theme: "" });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [error, setError] = useState("");

  const openUploadModal = (course: Course) => {
    setSelectedCourse(course);
    setResourceForm({ title: "", type: "PDF", link: "", theme: "" });
    setResourceFile(null);
    setError("");
    setShowResourceModal(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    
    setUploadingResource(true);
    setError("");
    
    const fd = new FormData();
    fd.append("courseId", selectedCourse.id);
    fd.append("title", resourceForm.title);
    fd.append("type", resourceForm.type);
    fd.append("period", periodName);
    if (resourceForm.theme) fd.append("theme", resourceForm.theme);
    if (resourceFile) fd.append("file", resourceFile);
    if (resourceForm.link) fd.append("link", resourceForm.link);

    try {
      const res = await fetch("/api/docente/recursos", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setShowResourceModal(false);
        router.refresh();
      } else {
        setError(data.error || "Error al subir recurso");
      }
    } catch {
      setError("Error de conexión al subir el recurso");
    } finally {
      setUploadingResource(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar Recurso",
      message: "¿Eliminar este recurso?",
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;
    
    try {
      const res = await fetch("/api/docente/recursos", { 
        method: "DELETE", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ id }) 
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to delete resource");
    }
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar Tarea",
      message: "¿Eliminar esta tarea y todas sus entregas/calificaciones asociadas?",
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/docente/tareas", { 
        method: "DELETE", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ id }) 
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to delete task");
    }
  };

  const togglePeriodActive = async (course: Course) => {
    const periodNum = periodName.split(" ")[1];
    const key = `period${periodNum}Active`;
    const currentVal = (course as any)[key] !== false;
    const newVal = !currentVal;

    try {
      const res = await fetch("/api/docente/cursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: course.id, [key]: newVal })
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to toggle period status");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {courses.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No tienes cursos activos.</p>
          <p className="text-sm mt-1">Crea un curso en la pestaña "Mis Cursos" para empezar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {courses.map((course) => {
            const periodNum = periodName.split(" ")[1];
            const isPeriodActive = (course as any)[`period${periodNum}Active`] !== false;

            return (
              <div 
                key={course.id} 
                className="card w-full border-t-4" 
                style={{ 
                  borderTopColor: isPeriodActive ? "var(--primary-color)" : "var(--text-muted)",
                  background: "var(--bg-primary)"
                }}
              >
                {/* Course Header */}
                <div className="flex flex-wrap justify-between items-start gap-4 border-b pb-4 mb-4" style={{ borderColor: "var(--border-color)" }}>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <BookOpen className={isPeriodActive ? "text-blue-600" : "text-gray-500"} />
                      {course.name}
                    </h2>
                    {course.description && (
                      <p className="text-muted text-sm mt-1">{course.description}</p>
                    )}
                  </div>
                  
                  {/* Period active toggle & badges */}
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => togglePeriodActive(course)}
                      className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border hover:bg-gray-50 transition-colors"
                      style={{ 
                        borderColor: "var(--border-color)", 
                        color: isPeriodActive ? "var(--primary-color)" : "var(--text-muted)"
                      }}
                      title="Activar o desactivar este periodo para los estudiantes"
                    >
                      {isPeriodActive ? (
                        <>
                          <ToggleRight className="text-green-500" size={18} />
                          <span>Periodo Visible</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-gray-400" size={18} />
                          <span className="text-gray-500">Periodo Oculto</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Content: Split Resources and Tasks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Resources Column */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <FileText size={16} />
                        Materiales de Clase
                      </h3>
                      <button 
                        onClick={() => openUploadModal(course)}
                        className="btn btn-primary py-1 px-3 text-xs h-auto flex items-center gap-1"
                      >
                        <Plus size={14} /> Subir Material
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[100px] justify-center p-2 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border-color)" }}>
                      {course.resources.length === 0 ? (
                        <p className="text-muted text-xs text-center italic py-6">No hay materiales de clase en este periodo.</p>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          {course.resources.map((resource) => (
                            <div key={resource.id} className="flex items-center justify-between p-2.5 rounded-md border" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span style={{ fontSize: "1.25rem" }}>{TYPE_ICONS[resource.type] || "📁"}</span>
                                <div className="min-w-0">
                                  <p className="font-medium truncate text-sm">{resource.title}</p>
                                  <div className="flex gap-2 items-center text-[10px] text-muted mt-0.5">
                                    <span>{resource.type}</span>
                                    {resource.theme && (
                                      <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(37, 99, 235, 0.08)", color: "var(--primary-color)" }}>
                                        {resource.theme}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <a 
                                  href={resource.url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="p-1.5 rounded hover:bg-gray-100 text-muted hover:text-primary transition-colors"
                                  title="Ver archivo"
                                >
                                  <ExternalLink size={14} />
                                </a>
                                <button 
                                  onClick={() => handleDeleteResource(resource.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tasks Column */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <ClipboardList size={16} />
                        Tareas del Periodo
                      </h3>
                      <Link 
                        href={`/docente/tareas/nueva?courseId=${course.id}&periodo=${encodeURIComponent(periodName)}`}
                        className="btn btn-primary py-1 px-3 text-xs h-auto flex items-center gap-1"
                      >
                        <Plus size={14} /> Crear Tarea
                      </Link>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[100px] justify-center p-2 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border-color)" }}>
                      {course.tasks.length === 0 ? (
                        <p className="text-muted text-xs text-center italic py-6">No hay tareas asignadas en este periodo.</p>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          {course.tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-2.5 rounded-md border" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
                              <div className="min-w-0">
                                <p className="font-medium truncate text-sm">{task.title}</p>
                                <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted mt-0.5">
                                  <span>Vence: {new Date(task.dueDate).toLocaleDateString()}</span>
                                  {task.weight !== undefined && task.weight !== null && (
                                    <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981" }}>
                                      Peso: {task.weight}%
                                    </span>
                                  )}
                                  {task.theme && (
                                    <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(37, 99, 235, 0.08)", color: "var(--primary-color)" }}>
                                      {task.theme}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Link 
                                  href={`/docente/tareas/${task.id}`}
                                  className="p-1.5 rounded hover:bg-gray-100 text-muted hover:text-primary transition-colors text-xs font-semibold px-2"
                                >
                                  Ver/Calificar
                                </Link>
                                <button 
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resource Upload Modal */}
      {showResourceModal && selectedCourse && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowResourceModal(false)}>
          <form onSubmit={handleSaveResource} className="card" style={{ width: "100%", maxWidth: "500px" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Subir Recurso ({selectedCourse.name})</h2>
              <button type="button" onClick={() => setShowResourceModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            
            <div className="input-group mb-3">
              <label>Título *</label>
              <input type="text" className="input-field" placeholder="Ej. Guía de estudio - Unidad 1"
                value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} required />
            </div>
            
            <div className="flex gap-4 mb-3">
              <div className="input-group flex-1">
                <label>Tema *</label>
                <input type="text" className="input-field" placeholder="Ej. Álgebra, Cinemática"
                  value={resourceForm.theme} onChange={e => setResourceForm({ ...resourceForm, theme: e.target.value })} required />
              </div>
              <div className="input-group flex-1">
                <label>Periodo</label>
                <input type="text" className="input-field bg-gray-100" value={periodName} disabled />
              </div>
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
