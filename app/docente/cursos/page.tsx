"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Edit2, Trash2, X, Save, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

interface Course {
  id: string;
  name: string;
  description: string | null;
  period1Active: boolean;
  period2Active: boolean;
  period3Active: boolean;
  period4Active: boolean;
  _count: { tasks: number; resources: number };
}

export default function CursosPage() {
  const confirm = useConfirm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          <h1 className="text-2xl font-bold">Mis Cursos</h1>
          <p className="text-muted text-sm mt-1">Crea y edita tus asignaturas académicas.</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={openCreateCourse}>
          <Plus size={18} /> Nuevo Curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      ) : courses.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={48} className="mx-auto mb-4 opacity-40 animate-pulse" />
          <p className="text-lg font-medium">No tienes cursos creados.</p>
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
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                    <BookOpen size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      title="Editar curso"
                      onClick={() => openEditCourse(course)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted hover:text-blue-600 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      title="Eliminar curso"
                      onClick={() => deleteCourse(course.id, course.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-lg mt-4">{course.name}</h3>
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
      {showCourseModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowCourseModal(false)}
        >
          <form onSubmit={saveCourse} className="card animate-fade-in" style={{ width: "100%", maxWidth: "480px", borderRadius: "1.25rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editCourse ? "Editar Curso" : "Nuevo Curso"}</h2>
              <button type="button" onClick={() => setShowCourseModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            {error && <div className="alert alert-danger mb-4">{error}</div>}
            
            <div className="input-group mb-4">
              <label className="font-semibold text-xs mb-1 block">Nombre del Curso *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Física 11°"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                required
              />
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Descripción</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Descripción del curso…"
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
                {editCourse ? "Guardar Cambios" : "Crear Curso"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
