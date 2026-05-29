"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BookOpen, Layers, Users, Loader2, Save, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

interface Group {
  id: string;
  name: string;
  _count: { students: number };
}

interface Grade {
  id: string;
  name: string;
  groups: Group[];
}

interface GradosCursosClientProps {
  role: "admin" | "docente";
}

export default function GradosCursosClient({ role }: GradosCursosClientProps) {
  const confirm = useConfirm();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGrade, setSavingGrade] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  // Modals / forms state
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeName, setGradeName] = useState("");
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [groupName, setGroupName] = useState("");

  const [error, setError] = useState("");

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/grados");
      const data = await res.json();
      if (res.ok && data.grades) {
        setGrades(data.grades);
      } else {
        setError(data.error || "Error al cargar los grados");
      }
    } catch {
      setError("Error de conexión al cargar los grados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName.trim()) return;
    setSavingGrade(true);
    setError("");

    try {
      const res = await fetch("/api/grados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "grade", name: gradeName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGradeModal(false);
        setGradeName("");
        fetchGrades();
      } else {
        setError(data.error || "Error al guardar el grado");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !selectedGrade) return;
    setSavingGroup(true);
    setError("");

    try {
      const res = await fetch("/api/grados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "group", 
          name: groupName.trim(),
          gradeId: selectedGrade.id
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGroupModal(false);
        setGroupName("");
        setSelectedGrade(null);
        fetchGrades();
      } else {
        setError(data.error || "Error al guardar el curso");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGrade = async (grade: Grade) => {
    const ok = await confirm({
      title: "Eliminar Grado",
      message: `¿Estás seguro de que deseas eliminar el grado "${grade.name}"? Se eliminarán todos sus cursos y los estudiantes asignados quedarán sin curso.`,
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/grados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "grade", id: grade.id })
      });
      if (res.ok) {
        fetchGrades();
      }
    } catch {
      console.error("Failed to delete grade");
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    const ok = await confirm({
      title: "Eliminar Curso",
      message: `¿Estás seguro de que deseas eliminar el curso "${group.name}"? Los estudiantes asociados quedarán sin curso.`,
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/grados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", id: group.id })
      });
      if (res.ok) {
        fetchGrades();
      }
    } catch {
      console.error("Failed to delete group");
    }
  };

  const openAddGroup = (grade: Grade) => {
    setSelectedGrade(grade);
    setGroupName("");
    setError("");
    setShowGroupModal(true);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h1 className="text-2xl font-bold">Grados y Cursos</h1>
          <p className="text-muted text-sm mt-1">Estructura académica de la institución escolar.</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={() => { setGradeName(""); setError(""); setShowGradeModal(true); }}>
          <Plus size={18} /> Nuevo Grado
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      ) : grades.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <Layers size={48} className="mx-auto mb-4 opacity-40 animate-pulse" />
          <p className="text-lg font-medium">No hay grados creados en el sistema.</p>
          <p className="text-sm mt-1">Comienza creando tu primer Grado escolar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grades.map((grade) => (
            <div
              key={grade.id}
              className="card flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.04)"
              }}
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                      <Layers size={20} />
                    </div>
                    <h3 className="font-extrabold text-lg">{grade.name}</h3>
                  </div>
                  <button
                    title="Eliminar grado"
                    onClick={() => handleDeleteGrade(grade)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 mt-4 min-h-[120px]">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Cursos / Grupos</p>
                  {grade.groups.length === 0 ? (
                    <p className="text-muted text-xs italic py-4">No hay cursos en este grado.</p>
                  ) : (
                    grade.groups.map(group => (
                      <div 
                        key={group.id} 
                        className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-gray-800 transition-all hover:translate-x-0.5" 
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                            Curso
                          </span>
                          <span className="font-semibold text-sm truncate">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Users size={12} /> {group._count.students}
                          </span>
                          <button
                            title="Eliminar curso"
                            onClick={() => handleDeleteGroup(group)}
                            className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-4 mt-6" style={{ borderColor: "var(--border-color)" }}>
                <button 
                  onClick={() => openAddGroup(grade)}
                  className="btn btn-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Agregar Curso / Grupo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grade Modal */}
      {showGradeModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowGradeModal(false)}
        >
          <form onSubmit={handleAddGrade} className="card animate-fade-in" style={{ width: "100%", maxWidth: "440px", borderRadius: "1.25rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Crear Nuevo Grado</h2>
              <button type="button" onClick={() => setShowGradeModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Nombre del Grado *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Décimo, Once, 10°"
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowGradeModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingGrade}>
                {savingGrade ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Crear Grado
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && selectedGrade && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowGroupModal(false)}
        >
          <form onSubmit={handleAddGroup} className="card animate-fade-in" style={{ width: "100%", maxWidth: "440px", borderRadius: "1.25rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Nuevo Curso / Grupo ({selectedGrade.name})</h2>
              <button type="button" onClick={() => setShowGroupModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Nombre del Curso / Grupo *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. A, B, 10-A, 10-B"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingGroup}>
                {savingGroup ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Crear Curso
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
