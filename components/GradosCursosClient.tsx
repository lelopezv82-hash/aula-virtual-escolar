"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BookOpen, Layers, Users, Loader2, Save, X, KeyRound, Copy, Check, UserPlus, Eye, EyeOff, Edit2, FileSpreadsheet, Upload } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

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

  // Edit states for Grades & Groups
  const [showEditGradeModal, setShowEditGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [editGradeName, setEditGradeName] = useState("");
  const [savingEditGrade, setSavingEditGrade] = useState(false);

  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [savingEditGroup, setSavingEditGroup] = useState(false);

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

  // Edit student states
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentPassword, setEditStudentPassword] = useState("");
  const [savingEditStudent, setSavingEditStudent] = useState(false);

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [detectedNames, setDetectedNames] = useState<string[]>([]);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importError, setImportError] = useState("");

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

  const handleEditGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGradeName.trim() || !editingGrade) return;
    setSavingEditGrade(true);
    setError("");
    try {
      const res = await fetch("/api/grados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "grade", id: editingGrade.id, name: editGradeName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditGradeModal(false);
        setEditingGrade(null);
        setEditGradeName("");
        fetchGrades();
      } else {
        setError(data.error || "Error al actualizar el grado");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSavingEditGrade(false);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupName.trim() || !editingGroup) return;
    setSavingEditGroup(true);
    setError("");
    try {
      const res = await fetch("/api/grados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", id: editingGroup.id, name: editGroupName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditGroupModal(false);
        setEditingGroup(null);
        setEditGroupName("");
        fetchGrades();
      } else {
        setError(data.error || "Error al actualizar el curso");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSavingEditGroup(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentName.trim() || !editingStudent || !selectedGroupForStudents) return;
    setSavingEditStudent(true);
    setStudentError("");
    try {
      const endpoint = role === "admin" ? "/api/admin/estudiantes" : "/api/docente/estudiantes";
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStudent.id,
          name: editStudentName.trim(),
          groupId: selectedGroupForStudents.id,
          password: editStudentPassword.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditStudentModal(false);
        setEditingStudent(null);
        setEditStudentName("");
        setEditStudentPassword("");
        fetchStudents();
        fetchGrades();
      } else {
        setStudentError(data.error || "Error al actualizar el estudiante");
      }
    } catch {
      setStudentError("Error de conexión");
    } finally {
      setSavingEditStudent(false);
    }
  };

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(null);
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      document.head.appendChild(script);
    });
  };

  const cleanExtractedText = (text: string): string[] => {
    const lines = text.split(/\r?\n/);
    const names: string[] = [];
    const blacklist = [
      "estudiante", "lista", "fecha", "grado", "curso", "materia", "nombre", "profesor", 
      "alumno", "docente", "institucion", "colegio", "escuela", "modulo", "periodo",
      "apellido", "correo", "email", "usuario", "contraseña", "password"
    ];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Basic formatting cleanup (remove numeric bullets or symbols like "1. ", "- ", etc.)
      line = line.replace(/^[\d+.\-\s*_•)]+/, "").trim();
      if (line.length < 5 || line.length > 60) continue;
      if (!line.includes(" ")) continue; // Needs to be at least a first name and a last name
      
      const lower = line.toLowerCase();
      const hasBlacklisted = blacklist.some(term => lower.includes(term));
      if (hasBlacklisted) continue;

      names.push(line);
    }
    return Array.from(new Set(names)); // deduplicate
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError("");
    setDetectedNames([]);

    const reader = new FileReader();

    try {
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        reader.onload = (evt) => {
          try {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            let extractedText = "";
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              json.forEach((row) => {
                row.forEach((cell: any) => {
                  if (typeof cell === "string") {
                    extractedText += cell + "\n";
                  }
                });
              });
            });
            const names = cleanExtractedText(extractedText);
            if (names.length === 0) {
              setImportError("No se encontraron nombres de estudiantes en el archivo. Verifica el formato.");
            } else {
              setDetectedNames(names);
            }
          } catch {
            setImportError("Error al procesar el archivo Excel.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith(".docx")) {
        reader.onload = async (evt) => {
          try {
            const arrayBuffer = evt.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            const names = cleanExtractedText(result.value);
            if (names.length === 0) {
              setImportError("No se encontraron nombres de estudiantes en el archivo Word.");
            } else {
              setDetectedNames(names);
            }
          } catch {
            setImportError("Error al procesar el archivo Word.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith(".pdf")) {
        reader.onload = async (evt) => {
          try {
            const arrayBuffer = evt.target?.result as ArrayBuffer;
            const pdfjs = await loadPdfJs();
            const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
            const pdf = await loadingTask.promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(" ");
              text += pageText + "\n";
            }
            const names = cleanExtractedText(text);
            if (names.length === 0) {
              setImportError("No se encontraron nombres en el PDF.");
            } else {
              setDetectedNames(names);
            }
          } catch (err: any) {
            console.error("PDF parsing error:", err);
            setImportError("Error al procesar el archivo PDF.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setImportError("Formato de archivo no soportado. Usa Excel (.xlsx/.xls), Word (.docx) o PDF (.pdf).");
      }
    } catch {
      setImportError("Error al abrir el archivo.");
    }
  };

  const handleBulkImportStudents = async () => {
    if (detectedNames.length === 0 || !selectedGroupForStudents) return;
    setImportingStudents(true);
    setImportError("");

    try {
      const endpoint = role === "admin" ? "/api/admin/estudiantes" : "/api/docente/estudiantes";
      let successCount = 0;
      let failCount = 0;

      for (const name of detectedNames) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name,
              groupId: selectedGroupForStudents.id
            })
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      await confirm({
        title: "Importación Finalizada",
        message: `Se importaron ${successCount} estudiantes con éxito. ${failCount > 0 ? `Fallaron ${failCount} registros.` : ""}`,
        confirmText: "Aceptar",
        type: "info"
      });

      setShowImportModal(false);
      setImportFile(null);
      setDetectedNames([]);
      fetchStudents();
      fetchGrades();
    } catch {
      setImportError("Error al realizar la importación masiva.");
    } finally {
      setImportingStudents(false);
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
                  <div className="flex items-center gap-1">
                    <button
                      title="Editar grado"
                      onClick={() => {
                        setEditingGrade(grade);
                        setEditGradeName(grade.name);
                        setShowEditGradeModal(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted hover:text-blue-600 transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      title="Eliminar grado"
                      onClick={() => handleDeleteGrade(grade)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
                        <div className="flex items-center gap-2">
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
                            title="Editar curso"
                            onClick={() => {
                              setEditingGroup(group);
                              setEditGroupName(group.name);
                              setShowEditGroupModal(true);
                            }}
                            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={13} />
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
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm font-semibold text-muted">
                      {students.length} {students.length === 1 ? "estudiante inscrito" : "estudiantes inscritos"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setDetectedNames([]);
                          setImportError("");
                          setShowImportModal(true);
                        }}
                        className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                      >
                        <Upload size={14} /> Importar (Excel/Word/PDF)
                      </button>
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
                    <div className="border rounded-xl overflow-x-auto" style={{ borderColor: "var(--border-color)" }}>
                      <table className="w-full text-left border-collapse min-w-[550px]">
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
                                      }}
                                      className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                                      title="Copiar credenciales"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setEditStudentName(student.name);
                                      setEditStudentPassword(student.passwordPlain || "");
                                      setStudentError("");
                                      setShowEditStudentModal(true);
                                    }}
                                    className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                                    title="Editar estudiante"
                                  >
                                    <Edit2 size={14} />
                                  </button>
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

      {/* Edit Grade Modal */}
      {showEditGradeModal && editingGrade && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowEditGradeModal(false)}
        >
          <form onSubmit={handleEditGrade} className="card animate-fade-in" style={{ width: "100%", maxWidth: "440px", borderRadius: "1.25rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Editar Grado</h2>
              <button type="button" onClick={() => setShowEditGradeModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Nombre del Grado *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Décimo, Once, 10°"
                value={editGradeName}
                onChange={(e) => setEditGradeName(e.target.value)}
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditGradeModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingEditGrade}>
                {savingEditGrade ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && editingGroup && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowEditGroupModal(false)}
        >
          <form onSubmit={handleEditGroup} className="card animate-fade-in" style={{ width: "100%", maxWidth: "440px", borderRadius: "1.25rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Editar Curso / Grupo</h2>
              <button type="button" onClick={() => setShowEditGroupModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="input-group mb-5">
              <label className="font-semibold text-xs mb-1 block">Nombre del Curso / Grupo *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. A, B, 10-A, 10-B"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditGroupModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingEditGroup}>
                {savingEditGroup ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditStudentModal && editingStudent && selectedGroupForStudents && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && setShowEditStudentModal(false)}
        >
          <form onSubmit={handleEditStudent} className="card animate-fade-in" style={{ width: "100%", maxWidth: "440px", borderRadius: "1.25rem", background: "var(--bg-primary)" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit2 className="text-blue-500" size={20} />
                Editar Estudiante
              </h2>
              <button type="button" onClick={() => setShowEditStudentModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="input-group">
                <label className="font-semibold text-xs mb-1 block">Nombre Completo *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="font-semibold text-xs mb-1 block">Contraseña (Dejar vacío para no cambiar)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nueva contraseña"
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 border-t pt-4 mt-5" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditStudentModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingEditStudent}>
                {savingEditStudent ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && selectedGroupForStudents && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: "1rem" }}
          onClick={(e) => e.target === e.currentTarget && !importingStudents && setShowImportModal(false)}
        >
          <div className="card animate-fade-in flex flex-col max-h-[85vh]" style={{ width: "100%", maxWidth: "550px", borderRadius: "1.25rem", background: "var(--bg-primary)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Upload className="text-blue-500" size={22} />
                  Importar Estudiantes
                </h2>
                <p className="text-xs text-muted mt-1">Sube un archivo Excel (.xlsx/.xls), Word (.docx) o PDF (.pdf) para registrar estudiantes.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                disabled={importingStudents}
              >
                <X size={20} />
              </button>
            </div>

            {importError && <div className="alert alert-danger mb-4 py-2 px-3 text-sm">{importError}</div>}

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/10 transition-colors relative" style={{ borderColor: "var(--border-color)" }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.docx,.pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={importingStudents}
                />
                <FileSpreadsheet className="mx-auto text-muted mb-2 opacity-60" size={40} />
                <p className="text-sm font-semibold">Seleccionar o arrastrar archivo</p>
                <p className="text-xs text-muted mt-1">Formatos soportados: Excel (.xlsx/.xls), Word (.docx) o PDF (.pdf)</p>
                {importFile && (
                  <p className="mt-3 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/20 py-1 px-3.5 rounded-full inline-block">
                    Archivo seleccionado: {importFile.name}
                  </p>
                )}
              </div>

              {detectedNames.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    Estudiantes Detectados ({detectedNames.length})
                  </p>
                  <div className="max-h-[200px] overflow-y-auto border rounded-xl p-2.5 bg-gray-50/50 dark:bg-gray-900/20 text-sm font-medium space-y-1.5 divide-y" style={{ borderColor: "var(--border-color)" }}>
                    {detectedNames.map((name, idx) => (
                      <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{name}</span>
                        <span className="text-muted font-mono">{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-4" style={{ borderColor: "var(--border-color)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowImportModal(false)}
                disabled={importingStudents}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkImportStudents}
                disabled={importingStudents || detectedNames.length === 0}
              >
                {importingStudents ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                Confirmar Importación ({detectedNames.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
