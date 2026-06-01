"use client";

import { useState, useEffect } from "react";
import { 
  FileText, Plus, ExternalLink, Trash2, Loader2, 
  UploadCloud, X, Save, ClipboardList, BookOpen, ToggleLeft, ToggleRight,
  Eye, EyeOff, Pencil
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
  active?: boolean;
  groupId?: string | null;
}

interface Task {
  id: string;
  title: string;
  theme?: string | null;
  weight?: number | null;
  dueDate: string;
  period?: string | null;
  active?: boolean;
  groupId?: string | null;
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
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState({ title: "", type: "PDF", link: "", theme: "", groupId: "" });
  const [gradeGroups, setGradeGroups] = useState<{ id: string, name: string }[]>([]);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/grados")
      .then(res => res.json())
      .then(data => {
        if (data.grades) {
          const flat: any[] = [];
          data.grades.forEach((g: any) => {
            g.groups.forEach((gp: any) => {
              flat.push({
                id: gp.id,
                name: `${g.name} - ${gp.name}`
              });
            });
          });
          setGradeGroups(flat);
        }
      })
      .catch(() => console.error("Failed to load grade groups"));
  }, []);

  const openUploadModal = (course: Course) => {
    setSelectedCourse(course);
    setEditingResource(null);
    setResourceForm({ title: "", type: "PDF", link: "", theme: "", groupId: "" });
    setResourceFile(null);
    setError("");
    setShowResourceModal(true);
  };

  const openEditModal = (resource: Resource, course: Course) => {
    setSelectedCourse(course);
    setEditingResource(resource);
    setResourceForm({
      title: resource.title,
      type: resource.type,
      link: resource.type === "LINK" ? resource.url : "",
      theme: resource.theme || "",
      groupId: resource.groupId || ""
    });
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
    if (editingResource) {
      fd.append("id", editingResource.id);
    } else {
      fd.append("courseId", selectedCourse.id);
    }
    fd.append("title", resourceForm.title);
    fd.append("type", resourceForm.type);
    fd.append("period", periodName);
    if (resourceForm.theme) fd.append("theme", resourceForm.theme);
    if (resourceFile) fd.append("file", resourceFile);
    if (resourceForm.link) fd.append("link", resourceForm.link);
    if (resourceForm.groupId) fd.append("groupId", resourceForm.groupId);

    try {
      const url = "/api/docente/recursos";
      const method = editingResource ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (res.ok) {
        setShowResourceModal(false);
        setEditingResource(null);
        router.refresh();
      } else {
        setError(data.error || "Error al guardar recurso");
      }
    } catch {
      setError("Error de conexión al guardar el recurso");
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
      const res = await fetch(`/api/docente/tareas/${id}`, { 
        method: "DELETE"
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

  const toggleResourceActive = async (resource: Resource) => {
    const newVal = resource.active !== false ? false : true;
    try {
      const res = await fetch("/api/docente/recursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resource.id, active: newVal })
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to toggle resource status");
    }
  };

  const toggleTaskActive = async (task: Task) => {
    const newVal = task.active !== false ? false : true;
    try {
      const res = await fetch(`/api/docente/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newVal })
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to toggle task status");
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
                      className={`flex items-center gap-2.5 text-sm font-bold px-5 py-2.5 rounded-full border transition-all duration-200 ${
                        isPeriodActive 
                          ? "bg-green-50/70 hover:bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                          : "bg-gray-50/70 hover:bg-gray-50 text-muted dark:bg-gray-800/30"
                      }`}
                      style={{ 
                        borderColor: isPeriodActive ? "rgba(16, 185, 129, 0.3)" : "var(--border-color)", 
                      }}
                      title="Activar o desactivar este periodo para los estudiantes"
                    >
                      {isPeriodActive ? (
                        <>
                          <ToggleRight className="text-green-500" size={28} />
                          <span>Visible para todos los alumnos</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-gray-400" size={28} />
                          <span>Oculto para todos los alumnos</span>
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
                        <div className="flex flex-col gap-2.5 w-full">
                          {course.resources.map((resource) => {
                            const isResActive = resource.active !== false;
                            return (
                              <div 
                                key={resource.id} 
                                className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm" 
                                style={{ 
                                  background: "var(--bg-primary)", 
                                  borderColor: "var(--border-color)",
                                  opacity: isResActive ? 1 : 0.65
                                }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800" style={{ fontSize: "1.25rem" }}>
                                    {TYPE_ICONS[resource.type] || "📁"}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold truncate text-sm">{resource.title}</p>
                                      {!isResActive && (
                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-gray-100 text-gray-500">Oculto</span>
                                      )}
                                    </div>
                                    <div className="flex gap-2 items-center text-[10px] text-muted mt-1">
                                      <span className="font-semibold">{resource.type}</span>
                                      {resource.theme && (
                                        <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(37, 99, 235, 0.08)", color: "var(--primary-color)" }}>
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
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-primary transition-colors"
                                    title="Ver archivo"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                  <button 
                                    onClick={() => toggleResourceActive(resource)}
                                    className={`p-1.5 rounded-lg transition-colors ${isResActive ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20" : "text-gray-400 hover:bg-gray-100"}`}
                                    title={isResActive ? "Ocultar material a alumnos" : "Mostrar material a alumnos"}
                                  >
                                    {isResActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <button 
                                    onClick={() => openEditModal(resource, course)}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted hover:text-blue-600 transition-colors"
                                    title="Editar material"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteResource(resource.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
                        <div className="flex flex-col gap-2.5 w-full">
                          {course.tasks.map((task) => {
                            const isTskActive = task.active !== false;
                            return (
                              <div 
                                key={task.id} 
                                className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm" 
                                style={{ 
                                  background: "var(--bg-primary)", 
                                  borderColor: "var(--border-color)",
                                  opacity: isTskActive ? 1 : 0.65
                                }}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold truncate text-sm">{task.title}</p>
                                    {!isTskActive && (
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-gray-100 text-gray-500">Oculto</span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted mt-1">
                                    <span className="font-medium">Vence: {new Date(task.dueDate).toLocaleDateString()}</span>
                                    {task.weight !== undefined && task.weight !== null && (
                                      <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981" }}>
                                        Peso: {task.weight}%
                                      </span>
                                    )}
                                    {task.theme && (
                                      <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(37, 99, 235, 0.08)", color: "var(--primary-color)" }}>
                                        {task.theme}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Link 
                                    href={`/docente/tareas/${task.id}`}
                                    className="py-1.5 px-3 rounded-lg hover:bg-gray-100 text-muted hover:text-primary transition-colors text-xs font-bold"
                                  >
                                    Ver/Calificar
                                  </Link>
                                  <button 
                                    onClick={() => toggleTaskActive(task)}
                                    className={`p-1.5 rounded-lg transition-colors ${isTskActive ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20" : "text-gray-400 hover:bg-gray-100"}`}
                                    title={isTskActive ? "Ocultar tarea a alumnos" : "Mostrar tarea a alumnos"}
                                  >
                                    {isTskActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <Link 
                                    href={`/docente/tareas/${task.id}/editar`}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted hover:text-blue-600 transition-colors"
                                    title="Editar tarea"
                                  >
                                    <Pencil size={14} />
                                  </Link>
                                  <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
              <h2 className="text-xl font-bold">{editingResource ? "Editar Recurso" : "Subir Recurso"} ({selectedCourse.name})</h2>
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
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{editingResource ? "Nuevo Archivo (Opcional)" : "Archivo *"}</label>
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
                {editingResource ? "Guardar Cambios" : "Subir Recurso"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
