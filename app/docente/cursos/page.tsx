"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Plus, Edit2, Trash2, X, Save, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

interface Course {
  id: string;
  name: string;
  description: string | null;
  groups?: {
    id: string;
    name: string;
    grade?: {
      name: string;
    };
  }[];
  period1Active: boolean;
  period2Active: boolean;
  period3Active: boolean;
  period4Active: boolean;
  _count: { tasks: number; resources: number };
}

export default function CursosPage() {
  const confirm = useConfirm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({ name: "", description: "", groupIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/grados")
      .then(res => res.json())
      .then(data => {
        if (data.grades) {
          const flatGroups: any[] = [];
          data.grades.forEach((g: any) => {
            g.groups.forEach((gp: any) => {
              flatGroups.push({
                id: gp.id,
                name: `${g.name} - ${gp.name}`
              });
            });
          });
          setGradeGroups(flatGroups);
        }
      })
      .catch(() => console.error("Failed to load grade groups"));
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docente/cursos");
      const data = await res.json();
      if (data.courses) setCourses(data.courses);
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openCreateCourse = () => {
    setEditCourse(null);
    setCourseForm({ name: "", description: "", groupIds: [] });
    setError("");
    setShowCourseModal(true);
  };

  const openEditCourse = (c: Course) => {
    setEditCourse(c);
    setCourseForm({ 
      name: c.name, 
      description: c.description || "", 
      groupIds: c.groups ? c.groups.map(g => g.id) : [] 
    });
    setError("");
    setShowCourseModal(true);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const method = editCourse ? "PATCH" : "POST";
    const body = editCourse ? { id: editCourse.id, ...courseForm } : courseForm;
    try {
      const res = await fetch("/api/docente/cursos", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCourseModal(false);
        fetchCourses();
      } else {
        setError(data.error || "Error al guardar el curso");
      }
    } catch {
      setError("Error de conexión al guardar el curso");
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Eliminar Curso",
      message: `¿Eliminar el curso "${name}"? Se eliminarán todas sus tareas y recursos asociados de forma permanente.`,
      confirmText: "Eliminar",
      type: "danger",
    });
    if (!ok) return;

    try {
      await fetch("/api/docente/cursos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchCourses();
    } catch (err) {
      console.error("Error deleting course:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h1 className="text-2xl font-bold">Gestión Asignaturas</h1>
          <p className="text-muted text-sm mt-1">Crea y edita tus asignaturas académicas.</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={openCreateCourse}>
          <Plus size={18} /> Nueva Asignatura
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#f98012]" size={40} />
        </div>
      ) : courses.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={48} className="mx-auto mb-4 opacity-40 animate-pulse" />
          <p className="text-lg font-medium">No tienes asignaturas creadas.</p>
          <p className="text-sm mt-1">Comienza creando tu primera asignatura para subir recursos y programar tareas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="card flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.04)"
              }}
            >
              <div>
                <div className="flex justify-between items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-orange-50 text-[#f98012] dark:bg-orange-900/30">
                    <BookOpen size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      title="Editar asignatura"
                      onClick={() => openEditCourse(course)}
                      className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 text-muted hover:text-[#f98012] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      title="Eliminar asignatura"
                      onClick={() => deleteCourse(course.id, course.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-lg mt-4">{course.name}</h3>
                {course.groups && course.groups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {course.groups.map(group => (
                      <span key={group.id} className="px-2 py-0.5 rounded bg-orange-50 text-blue-700 dark:bg-orange-900/30 text-[10px] font-semibold border border-orange-200/50">
                        {group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-muted text-sm mt-2 line-clamp-2">
                  {course.description || "Sin descripción"}
                </p>
              </div>

              <div className="flex justify-between items-center border-t pt-4 mt-6 text-xs text-muted" style={{ borderColor: "var(--border-color)" }}>
                <span className="flex items-center gap-1">
                  📋 <strong>{course._count.tasks}</strong> tareas
                </span>
                <span className="flex items-center gap-1">
                  📁 <strong>{course._count.resources}</strong> recursos
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Modal */}
      {showCourseModal && mounted && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowCourseModal(false)}
        >
          <form onSubmit={saveCourse} className="modal-content" style={{ maxWidth: "480px" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editCourse ? "Editar Asignatura" : "Nueva Asignatura"}</h2>
              <button type="button" onClick={() => setShowCourseModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            
            <div className="input-group mb-4">
              <label className="font-semibold text-xs mb-1 block">Nombre de la Asignatura *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Física 11°"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                required
              />
            </div>
            
            <div className="input-group mb-4">
              <label className="font-semibold text-xs mb-1.5 block">Asignar a Grupos (Múltiple) *</label>
              
              <div className="flex justify-between items-center mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = gradeGroups.map(g => g.id);
                    const allSelected = allIds.every(id => courseForm.groupIds.includes(id));
                    setCourseForm({
                      ...courseForm,
                      groupIds: allSelected ? [] : allIds
                    });
                  }}
                  className="text-xs font-bold text-[#f98012] hover:underline"
                >
                  {gradeGroups.map(g => g.id).every(id => courseForm.groupIds.includes(id)) 
                    ? "Desmarcar todos" 
                    : "Seleccionar todos"}
                </button>
                <span className="text-[10px] text-muted font-medium">
                  {courseForm.groupIds.length} seleccionado(s)
                </span>
              </div>

              <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto flex flex-col gap-2 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
                {gradeGroups.map(g => {
                  const isChecked = courseForm.groupIds.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? courseForm.groupIds.filter(id => id !== g.id)
                            : [...courseForm.groupIds, g.id];
                          setCourseForm({ ...courseForm, groupIds: newIds });
                        }}
                        className="rounded text-[#f98012] focus:ring-[#f98012]"
                      />
                      <span>{g.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Descripción</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Descripción de la asignatura…"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editCourse ? "Guardar Cambios" : "Crear Asignatura"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
