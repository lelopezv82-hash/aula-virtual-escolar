"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, Plus, Edit2, Trash2, X, Save, Loader2, Eye, EyeOff, Star } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

interface Course {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
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
  saberPercent: number;
  hacerPercent: number;
  serPercent: number;
  _count: { tasks: number; resources: number };
}

interface StudentGrade {
  id: string;
  name: string;
  username: string;
  grade: number | null;
}

export default function CursosPage() {
  const confirm = useConfirm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({ name: "", description: "", groupIds: [] as string[], saberPercent: 30, hacerPercent: 50, serPercent: 20, finalPercent: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  // Additional Grades Modal
  const [showGradesModal, setShowGradesModal] = useState(false);
  const [gradesModalCourse, setGradesModalCourse] = useState<Course | null>(null);
  const [gradesModalPeriod, setGradesModalPeriod] = useState<string>("");
  const [gradesModalGroup, setGradesModalGroup] = useState<{ id: string, name: string } | null>(null);
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradesError, setGradesError] = useState("");
  const [gradesSaved, setGradesSaved] = useState(false);

  // Real period names from DB
  const [dbPeriods, setDbPeriods] = useState<{ name: string; active: boolean }[]>([]);

  useEffect(() => {
    setMounted(true);
    // Fetch real period names from DB
    fetch("/api/periodos")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.periods)) {
          setDbPeriods(data.periods);
        }
      })
      .catch(() => console.error("Failed to load periods"));
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
    setCourseForm({ name: "", description: "", groupIds: [], saberPercent: 30, hacerPercent: 50, serPercent: 20, finalPercent: 0 });
    setError("");
    setShowCourseModal(true);
  };

  const openEditCourse = (c: Course) => {
    setEditCourse(c);
    setCourseForm({ 
      name: c.name, 
      description: c.description || "", 
      groupIds: c.groups ? c.groups.map(g => g.id) : [],
      saberPercent: c.saberPercent ?? 30,
      hacerPercent: c.hacerPercent ?? 50,
      serPercent: c.serPercent ?? 20,
      finalPercent: (c as any).finalPercent ?? 0,
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

  const toggleCourseActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/docente/cursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !currentActive }),
      });
      if (res.ok) {
        fetchCourses();
      }
    } catch (err) {
      console.error("Error toggling course state:", err);
    }
  };

  const openGradesModal = async (course: Course, period: string, groupId?: string) => {
    setGradesModalCourse(course);
    setGradesModalPeriod(period);
    
    const groupObj = groupId ? course.groups?.find(g => g.id === groupId) : null;
    const groupName = groupObj ? (groupObj.grade?.name ? `${groupObj.grade.name} - ${groupObj.name}` : groupObj.name) : "";
    setGradesModalGroup(groupObj ? { id: groupObj.id, name: groupName } : null);

    setGradesError("");
    setGradesSaved(false);
    setShowGradesModal(true);
    setLoadingStudents(true);
    try {
      const url = `/api/docente/cursos/${course.id}/additional-grades?period=${period}${groupId ? `&groupId=${groupId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.students) {
        setStudents(data.students);
        const inputs: Record<string, string> = {};
        data.students.forEach((s: StudentGrade) => {
          inputs[s.id] = s.grade !== null ? String(s.grade) : "";
        });
        setGradeInputs(inputs);
      } else {
        setGradesError(data.error || "Error al cargar estudiantes");
      }
    } catch {
      setGradesError("Error de conexión");
    } finally {
      setLoadingStudents(false);
    }
  };

  const saveAdditionalGrades = async () => {
    if (!gradesModalCourse) return;
    setSavingGrades(true);
    setGradesError("");
    setGradesSaved(false);
    const grades = students.map(s => ({
      studentId: s.id,
      grade: gradeInputs[s.id] !== "" ? Number(gradeInputs[s.id]) : null,
    }));
    try {
      const res = await fetch(`/api/docente/cursos/${gradesModalCourse.id}/additional-grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: gradesModalPeriod, grades }),
      });
      const data = await res.json();
      if (res.ok) {
        setGradesSaved(true);
        setTimeout(() => setGradesSaved(false), 2500);
      } else {
        setGradesError(data.error || "Error al guardar notas");
      }
    } catch {
      setGradesError("Error de conexión");
    } finally {
      setSavingGrades(false);
    }
  };

  // Map course period flags to real DB period names (by index order)
  const activePeriods = (course: Course) => {
    const flags = [course.period1Active, course.period2Active, course.period3Active, course.period4Active];
    const sorted = [...dbPeriods].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const result: string[] = [];
    flags.forEach((active, i) => {
      if (active && sorted[i]) result.push(sorted[i].name);
    });
    return result;
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
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-orange-50 text-[#f98012] dark:bg-orange-900/30">
                      <BookOpen size={22} />
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      course.active 
                        ? "bg-green-50 text-green-700 border border-green-200" 
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      {course.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      title={course.active ? "Desactivar asignatura" : "Activar asignatura"}
                      onClick={() => toggleCourseActive(course.id, course.active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        course.active
                          ? "hover:bg-orange-50 text-[#f98012]"
                          : "hover:bg-gray-100 text-gray-400"
                      }`}
                    >
                      {course.active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
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
                      <span key={group.id} className="px-2 py-0.5 rounded bg-orange-50 text-[#e06d09] dark:bg-orange-900/30 text-[10px] font-semibold border border-orange-200/50">
                        {group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-muted text-sm mt-2 line-clamp-2">
                  {course.description || "Sin descripción"}
                </p>


              </div>

              <div className="flex justify-between items-center border-t pt-4 mt-6" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    📋 <strong>{course._count.tasks}</strong> tareas
                  </span>
                  <span className="flex items-center gap-1">
                    📁 <strong>{course._count.resources}</strong> recursos
                  </span>
                </div>
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

            {/* Pesos de Evaluación */}
            {(() => {
              const formTotalPct = courseForm.saberPercent + courseForm.hacerPercent + courseForm.serPercent + courseForm.finalPercent;
              return (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30 mb-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
                      Pesos de Evaluación
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      formTotalPct === 100
                        ? "text-green-700 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                        : "text-red-700 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                    }`}>
                      Total: {formTotalPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Saber (Exámenes)", colorText: "text-purple-700 dark:text-purple-400", bgInput: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300", key: "saberPercent" },
                      { label: "Hacer (Tareas)", colorText: "text-orange-700 dark:text-orange-400", bgInput: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300", key: "hacerPercent" },
                      { label: "Ser (Actitudinal)", colorText: "text-yellow-800 dark:text-yellow-500", bgInput: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800 text-yellow-850 dark:text-yellow-400", key: "serPercent" },
                      { label: "Examen Final", colorText: "text-sky-700 dark:text-sky-400", bgInput: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300", key: "finalPercent" },
                    ].map(({ label, colorText, bgInput, key }) => (
                      <div key={key} className="input-group">
                        <label className={`block font-bold text-[11px] mb-1.5 ${colorText}`}>{label} *</label>
                        <div className={`flex items-center border rounded-lg px-2.5 py-1 ${bgInput}`}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={courseForm[key as keyof typeof courseForm]}
                            onChange={(e) => setCourseForm({ ...courseForm, [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                            className="w-full text-center font-bold bg-transparent border-none outline-none text-xs p-0 focus:ring-0"
                          />
                          <span className="font-semibold text-xs ml-1">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {formTotalPct !== 100 && (
                    <p className="text-[10px] text-red-500 font-semibold mt-3 text-center">
                      ⚠️ La suma de los porcentajes debe ser exactamente 100%.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || (courseForm.saberPercent + courseForm.hacerPercent + courseForm.serPercent + courseForm.finalPercent) !== 100}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editCourse ? "Guardar Cambios" : "Crear Asignatura"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Additional Grades Modal */}
      {showGradesModal && mounted && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowGradesModal(false)}
        >
          <div className="modal-content" style={{ maxWidth: "520px" }}>
            <div className="flex justify-between items-center mb-1">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star size={20} style={{ color: "#f98012" }} />
                  Nota del Ser — {gradesModalPeriod}
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  {gradesModalCourse?.name} {gradesModalGroup && `— ${gradesModalGroup.name}`}
                </p>
              </div>
              <button type="button" onClick={() => setShowGradesModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-muted mb-4 mt-2 p-3 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              Ingresa la nota del ser de cada estudiante para este período (escala 1.0 – 5.0). 
              Deja el campo vacío para no asignar nota.
            </p>

            {gradesError && <div className="alert alert-danger mb-3">{gradesError}</div>}
            {gradesSaved && (
              <div className="alert alert-success mb-3 flex items-center gap-2">
                ✅ Notas guardadas correctamente.
              </div>
            )}

            {loadingStudents ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#f98012]" size={32} />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">
                No hay estudiantes asignados a esta asignatura.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {students.map(student => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
                  >
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                    >
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{student.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="0.1"
                        placeholder="—"
                        value={gradeInputs[student.id] ?? ""}
                        onChange={(e) => setGradeInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="input-field text-center font-bold"
                        style={{ width: "72px", padding: "0.4rem 0.5rem", fontSize: "0.95rem" }}
                      />
                      <span className="text-xs text-muted">/ 5.0</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4 mt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowGradesModal(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingGrades || loadingStudents}
                onClick={saveAdditionalGrades}
              >
                {savingGrades ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar Notas
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
