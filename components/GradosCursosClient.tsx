"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BookOpen, Layers, Users, Loader2, Save, X, KeyRound, Copy, Check, UserPlus, Eye, EyeOff } from "lucide-react";
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

interface Student {
  id: string;
  name: string;
  username: string;
  groupId: string | null;
  grade: string | null;
  groupName: string | null;
  passwordPlain?: string | null;
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

  // Student management state
  const [selectedGroupForStudents, setSelectedGroupForStudents] = useState<Group | null>(null);
  const [parentGradeOfSelectedGroup, setParentGradeOfSelectedGroup] = useState<Grade | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showStudentListModal, setShowStudentListModal] = useState(false);

  // Create student form states
  const [showCreateStudentInGroupModal, setShowCreateStudentInGroupModal] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [newStudentCredentials, setNewStudentCredentials] = useState<{ username: string; plainPassword: string } | null>(null);
  const [copiedStudent, setCopiedStudent] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

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

  const fetchStudents = useCallback(async () => {
    if (!selectedGroupForStudents) return;
    setLoadingStudents(true);
    setStudentError("");
    try {
      const endpoint = role === "admin" ? "/api/admin/estudiantes" : "/api/docente/estudiantes";
      const res = await fetch(endpoint);
      const data = await res.json();
      if (res.ok && data.students) {
        // Filter by the selected group ID
        const filtered = data.students.filter((s: any) => s.groupId === selectedGroupForStudents.id);
        setStudents(filtered);
      } else {
        setStudentError(data.error || "Error al obtener los estudiantes");
      }
    } catch {
      setStudentError("Error de conexión al obtener los estudiantes");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedGroupForStudents, role]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  useEffect(() => {
    if (selectedGroupForStudents) {
      fetchStudents();
    }
  }, [selectedGroupForStudents, fetchStudents]);

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
                          <button
                            title="Gestionar estudiantes"
                            onClick={() => {
                              setSelectedGroupForStudents(group);
                              setParentGradeOfSelectedGroup(grade);
                              setNewStudentCredentials(null);
                              setStudentName("");
                              setStudentPassword("");
                              setStudentError("");
                              setShowStudentListModal(true);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
                          >
                            <Users size={13} /> {group._count.students}
                          </button>
                          <button
                            title="Eliminar curso"
                            onClick={() => handleDeleteGroup(group)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
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

      {/* Students in Group Modal */}
      {showStudentListModal && selectedGroupForStudents && parentGradeOfSelectedGroup && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && !showCreateStudentInGroupModal && setShowStudentListModal(false)}
        >
          <div className="card animate-fade-in flex flex-col max-h-[85vh]" style={{ width: "100%", maxWidth: "700px", borderRadius: "1.25rem", background: "var(--bg-primary)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  <Users className="text-blue-500" size={24} />
                  Estudiantes del Curso {parentGradeOfSelectedGroup.name} - {selectedGroupForStudents.name}
                </h2>
                <p className="text-xs text-muted mt-1">Registra y administra los estudiantes inscritos en esta sección.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentListModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {studentError && <div className="alert alert-danger mb-4 py-2 px-3 text-sm">{studentError}</div>}

            {/* Main content split: List or Create Form */}
            <div className="flex-1 overflow-y-auto pr-1">
              {showCreateStudentInGroupModal ? (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!studentName.trim()) return;
                    setSavingStudent(true);
                    setStudentError("");
                    try {
                      const endpoint = role === "admin" ? "/api/admin/estudiantes" : "/api/docente/estudiantes";
                      const res = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: studentName.trim(),
                          groupId: selectedGroupForStudents.id,
                          password: studentPassword.trim() || undefined
                        })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setNewStudentCredentials({
                          username: data.student.username,
                          plainPassword: data.plainPassword
                        });
                        setStudentName("");
                        setStudentPassword("");
                        fetchStudents();
                        fetchGrades();
                      } else {
                        setStudentError(data.error || "Error al crear el estudiante");
                      }
                    } catch {
                      setStudentError("Error de conexión");
                    } finally {
                      setSavingStudent(false);
                    }
                  }}
                  className="space-y-4 p-4 border rounded-xl bg-gray-50 dark:bg-gray-900/40"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <h3 className="font-bold text-md text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <UserPlus size={18} /> Registrar Nuevo Estudiante
                  </h3>
                  
                  {newStudentCredentials ? (
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300 space-y-3">
                      <p className="text-sm font-semibold">¡Estudiante creado con éxito!</p>
                      <div className="grid grid-cols-2 gap-4 text-xs bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-100 dark:border-green-900/20">
                        <div>
                          <span className="block text-muted font-medium">Usuario:</span>
                          <span className="font-bold text-sm select-all">{newStudentCredentials.username}</span>
                        </div>
                        <div>
                          <span className="block text-muted font-medium">Contraseña:</span>
                          <span className="font-bold text-sm select-all">{newStudentCredentials.plainPassword}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`Usuario: ${newStudentCredentials.username}\nContraseña: ${newStudentCredentials.plainPassword}`);
                            setCopiedStudent(true);
                            setTimeout(() => setCopiedStudent(false), 2000);
                          }}
                          className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
                        >
                          {copiedStudent ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                          {copiedStudent ? "Copiado" : "Copiar credenciales"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewStudentCredentials(null);
                            setShowCreateStudentInGroupModal(false);
                          }}
                          className="btn btn-primary py-1 px-3 text-xs"
                        >
                          Listo / Volver
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="input-group">
                          <label className="font-semibold text-xs mb-1 block">Nombre Completo *</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Ej. Juan Pérez"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="input-group">
                          <label className="font-semibold text-xs mb-1 block">Contraseña (Opcional)</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Dejar en blanco para autogenerar"
                            value={studentPassword}
                            onChange={(e) => setStudentPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                        <button
                          type="button"
                          className="btn btn-secondary py-1.5 text-xs"
                          onClick={() => {
                            setShowCreateStudentInGroupModal(false);
                            setStudentName("");
                            setStudentPassword("");
                            setStudentError("");
                          }}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary py-1.5 text-xs" disabled={savingStudent}>
                          {savingStudent ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          Crear Estudiante
                        </button>
                      </div>
                    </>
                  )}
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-muted">
                      {students.length} {students.length === 1 ? "estudiante inscrito" : "estudiantes inscritos"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewStudentCredentials(null);
                        setShowCreateStudentInGroupModal(true);
                      }}
                      className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> Registrar Estudiante
                    </button>
                  </div>

                  {loadingStudents ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin text-blue-500" size={30} />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl border-dashed" style={{ borderColor: "var(--border-color)" }}>
                      <Users size={36} className="mx-auto text-muted opacity-30 mb-2" />
                      <p className="text-sm font-semibold text-muted">No hay estudiantes en este curso.</p>
                      <p className="text-xs text-muted mt-1">Registra tu primer estudiante haciendo clic en el botón superior.</p>
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900/60 text-xs font-bold text-muted border-b" style={{ borderColor: "var(--border-color)" }}>
                            <th className="p-3">Nombre</th>
                            <th className="p-3">Usuario</th>
                            <th className="p-3">Contraseña</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-sm" style={{ borderColor: "var(--border-color)" }}>
                          {students.map((student) => (
                            <tr key={student.id} className="hover:bg-gray-50/55 dark:hover:bg-gray-900/20">
                              <td className="p-3 font-semibold">{student.name}</td>
                              <td className="p-3 font-mono text-xs">{student.username}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs select-all">
                                    {visiblePasswords[student.id] 
                                      ? (student.passwordPlain || "********") 
                                      : "••••••••"}
                                  </span>
                                  {student.passwordPlain && (
                                    <button
                                      onClick={() => setVisiblePasswords(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-muted"
                                      title={visiblePasswords[student.id] ? "Ocultar" : "Mostrar"}
                                    >
                                      {visiblePasswords[student.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex justify-center items-center gap-2">
                                  {student.passwordPlain && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(`Usuario: ${student.username}\nContraseña: ${student.passwordPlain}`);
                                        // Simple alert/feedback using an interactive flow could be here, but standard Clipboard copy works great.
                                      }}
                                      className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                                      title="Copiar credenciales"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      const ok = await confirm({
                                        title: "Eliminar Estudiante",
                                        message: `¿Estás seguro de que deseas eliminar a "${student.name}"? Se perderán todas sus notas y registros de tareas.`,
                                        confirmText: "Eliminar",
                                        type: "danger"
                                      });
                                      if (!ok) return;
                                      
                                      try {
                                        const endpoint = role === "admin" ? "/api/admin/estudiantes" : "/api/docente/estudiantes";
                                        const res = await fetch(endpoint, {
                                          method: "DELETE",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ id: student.id })
                                        });
                                        if (res.ok) {
                                          fetchStudents();
                                          fetchGrades();
                                        } else {
                                          const data = await res.json();
                                          setStudentError(data.error || "Error al eliminar el estudiante");
                                        }
                                      } catch {
                                        setStudentError("Error de conexión");
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                                    title="Eliminar estudiante"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-4" style={{ borderColor: "var(--border-color)" }}>
              <button
                type="button"
                className="btn btn-secondary w-full sm:w-auto"
                onClick={() => {
                  if (showCreateStudentInGroupModal) {
                    setShowCreateStudentInGroupModal(false);
                    setNewStudentCredentials(null);
                  } else {
                    setShowStudentListModal(false);
                  }
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
