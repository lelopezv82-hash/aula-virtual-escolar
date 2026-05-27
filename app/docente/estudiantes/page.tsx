"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Search, Edit2, Trash2, KeyRound, Copy, Check,
  X, Save, Loader2, Upload, FileSpreadsheet, Download,
  Eye, EyeOff
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Student {
  id: string;
  name: string;
  username: string;
  grade: string | null;
  groupName: string | null;
  passwordPlain?: string | null;
}

interface NewCredentials {
  username: string;
  plainPassword: string;
}

export default function EstudiantesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({ name: "", grade: "", groupName: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Import CSV states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docente/estudiantes");
      const data = await res.json();
      if (data.students) setStudents(data.students);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.grade || "").includes(search) ||
    (s.groupName || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditStudent(null);
    setFormData({ name: "", grade: "", groupName: "", password: "" });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    setEditStudent(student);
    setFormData({
      name: student.name,
      grade: student.grade || "",
      groupName: student.groupName || "",
      password: student.passwordPlain || ""
    });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewCredentials(null);
    setEditStudent(null);
    setShowModalPassword(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editStudent ? "PATCH" : "POST";
      const body = editStudent
        ? { id: editStudent.id, ...formData }
        : formData;
      const res = await fetch("/api/docente/estudiantes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (!editStudent && data.plainPassword) {
          setNewCredentials({ username: data.student.username, plainPassword: data.plainPassword });
        } else {
          closeModal();
        }
        fetchStudents();
      } else {
        setError(data.error || "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${name}? Esta acción es irreversible.`)) return;
    await fetch("/api/docente/estudiantes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchStudents();
  };

  const handleResetPassword = async (student: Student) => {
    const newPass = Math.random().toString(36).slice(-8);
    setSaving(true);
    await fetch("/api/docente/estudiantes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, name: student.name, password: newPass }),
    });
    setSaving(false);
    setNewCredentials({ username: student.username, plainPassword: newPass });
    setShowModal(true);
    setEditStudent(null);
  };

  const copyCredentials = () => {
    if (!newCredentials) return;
    navigator.clipboard.writeText(`Usuario: ${newCredentials.username}\nContraseña: ${newCredentials.plainPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // CSV / Excel Import Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError("");
    setImportData([]);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const arrayBuffer = evt.target?.result as ArrayBuffer;
          const data = new Uint8Array(arrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
          
          const mapped = jsonData.map((row: any) => {
            const name = row.Nombre || row.nombre || row.name || row.Name || '';
            const grade = row.Grado || row.grado || row.grade || row.Grade || '';
            const groupName = row.Grupo || row.grupo || row.groupName || row.group || row.Group || '';
            return {
              name: String(name).trim(),
              grade: String(grade).trim(),
              groupName: String(groupName).trim()
            };
          }).filter((item: any) => item.name !== "");

          if (mapped.length === 0) {
            setImportError("No se encontraron registros con nombre en el archivo Excel. Asegúrate de tener una columna llamada 'Nombre'.");
          } else {
            setImportData(mapped);
          }
        } catch (err: any) {
          setImportError("Error al procesar el archivo Excel: " + err.message);
        }
      };
      reader.onerror = () => {
        setImportError("Error al leer el archivo Excel.");
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const mapped = results.data.map((row: any) => {
            const name = row.Nombre || row.nombre || row.name || row.Name || '';
            const grade = row.Grado || row.grado || row.grade || row.Grade || '';
            const groupName = row.Grupo || row.grupo || row.groupName || row.group || row.Group || '';
            return {
              name: String(name).trim(),
              grade: String(grade).trim(),
              groupName: String(groupName).trim()
            };
          }).filter((item: any) => item.name !== "");

          if (mapped.length === 0) {
            setImportError("No se encontraron registros con nombre en el archivo CSV. Asegúrate de tener una columna llamada 'Nombre'.");
          } else {
            setImportData(mapped);
          }
        },
        error: (err) => {
          setImportError("Error al procesar el archivo CSV: " + err.message);
        }
      });
    }
  };

  const executeImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/docente/estudiantes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: importData }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResults(data.createdStudents);
        fetchStudents();
      } else {
        setImportError(data.error || "Error al realizar la importación.");
      }
    } catch {
      setImportError("Error de red al intentar importar.");
    } finally {
      setImporting(false);
    }
  };

  const copyAllImportCredentials = () => {
    if (!importResults) return;
    const text = importResults.map(s => `Nombre: ${s.name} | Usuario: ${s.username} | Contraseña: ${s.plainPassword}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportData([]);
    setImportResults(null);
    setImportError("");
  };

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1>Gestión de Estudiantes</h1>
          <p>Administra los alumnos, credenciales y grupos.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex items-center gap-2" onClick={() => {
            setImportFile(null);
            setImportData([]);
            setImportResults(null);
            setImportError("");
            setShowImportModal(true);
          }}>
            <Upload size={18} /> Importar CSV / Excel
          </button>
          <button className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
            <UserPlus size={18} /> Nuevo Estudiante
          </button>
        </div>
      </div>

      <div className="card w-full">
        <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
          <div style={{ position: "relative", maxWidth: "320px", width: "100%" }}>
            <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: "2.75rem" }}
              placeholder="Buscar por nombre, usuario, grado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-muted text-sm">{filtered.length} estudiante(s)</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th className="py-3 px-4 font-medium">Nombre</th>
                  <th className="py-3 px-4 font-medium">Usuario</th>
                  <th className="py-3 px-4 font-medium">Contraseña</th>
                  <th className="py-3 px-4 font-medium">Curso / Grupo</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-muted">
                      {search ? "No se encontraron resultados." : "No hay estudiantes registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((student) => (
                    <tr key={student.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td className="py-3 px-4 font-medium">{student.name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{student.username}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {student.passwordPlain ? (
                              visiblePasswords[student.id] ? student.passwordPlain : "••••••••"
                            ) : (
                              <span className="text-muted italic text-xs">No disponible</span>
                            )}
                          </span>
                          {student.passwordPlain && (
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                              className="p-1 rounded text-muted hover:text-primary hover:bg-gray-100 transition-colors"
                              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "0.25rem" }}
                              title={visiblePasswords[student.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {visiblePasswords[student.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {(student.grade || student.groupName) ? (
                          <span className="badge badge-info">
                            {student.grade ? `Grado ${student.grade}` : ""}{student.grade && student.groupName ? " – " : ""}{student.groupName || ""}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <button title="Editar" onClick={() => openEdit(student)}
                            className="p-2 rounded-md hover:bg-blue-50 transition-colors" style={{ color: "var(--primary-color)" }}>
                            <Edit2 size={16} />
                          </button>
                          <button title="Reiniciar contraseña" onClick={() => handleResetPassword(student)}
                            className="p-2 rounded-md hover:bg-yellow-50 transition-colors" style={{ color: "var(--warning)" }}>
                            <KeyRound size={16} />
                          </button>
                          <button title="Eliminar" onClick={() => handleDelete(student.id, student.name)}
                            className="p-2 rounded-md hover:bg-red-50 transition-colors" style={{ color: "var(--danger)" }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Student Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: "1rem"
          }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="card" style={{ width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Credentials Display */}
            {newCredentials ? (
              <div>
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                  🎉 Credenciales generadas
                </h2>
                <p className="text-muted text-sm mb-4">
                  Comparte estas credenciales con el estudiante. La contraseña <strong>no se puede recuperar</strong> después de cerrar esta ventana.
                </p>
                <div style={{
                  background: "var(--bg-primary)", border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)", padding: "1.25rem", fontFamily: "monospace",
                  fontSize: "1.1rem", lineHeight: "2rem", marginBottom: "1rem"
                }}>
                  <div><span style={{ color: "var(--text-muted)" }}>Usuario:</span> <strong>{newCredentials.username}</strong></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Contraseña:</span> <strong>{newCredentials.plainPassword}</strong></div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button className="btn btn-secondary" onClick={copyCredentials}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                  <button className="btn btn-primary" onClick={closeModal}>
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    {editStudent ? "Editar Estudiante" : "Nuevo Estudiante"}
                  </h2>
                  <button type="button" onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="input-group">
                  <label>Nombre Completo *</label>
                  <input type="text" className="input-field" placeholder="Ej. Ana Martínez López"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="input-group">
                    <label>Grado</label>
                    <input type="text" className="input-field" placeholder="Ej. 10"
                      value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Grupo</label>
                    <input type="text" className="input-field" placeholder="Ej. A"
                      value={formData.groupName} onChange={e => setFormData({ ...formData, groupName: e.target.value })} />
                  </div>
                </div>

                <div className="input-group">
                  <label>{editStudent ? "Contraseña" : "Contraseña (opcional)"}</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showModalPassword ? "text" : "password"} 
                      className="input-field" 
                      style={{ paddingRight: "2.5rem" }}
                      placeholder={editStudent ? "Contraseña actual del estudiante" : "Dejar vacío para generar automáticamente"}
                      value={formData.password} 
                      onChange={e => setFormData({ ...formData, password: e.target.value })} 
                    />
                    {formData.password && (
                      <button
                        type="button"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        style={{
                          position: "absolute",
                          right: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center"
                        }}
                        title={showModalPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showModalPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                  <p className="text-muted text-xs mt-1">
                    {editStudent ? "Modifica este campo para cambiar la contraseña del estudiante." : "Si no escribes una, se generará automáticamente."}
                  </p>
                </div>

                {!editStudent && (
                  <div style={{ padding: "0.75rem", background: "rgba(37,99,235,0.07)", borderRadius: "var(--radius-md)", fontSize: "0.875rem", color: "var(--primary-color)" }}>
                    ℹ️ El usuario se generará automáticamente a partir del nombre.
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editStudent ? "Guardar Cambios" : "Crear Estudiante"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: "1rem"
          }}
          onClick={(e) => e.target === e.currentTarget && closeImportModal()}
        >
          <div className="card" style={{ width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" />
                Importar Estudiantes desde CSV / Excel
              </h2>
              <button type="button" onClick={closeImportModal} className="p-1 rounded hover:bg-gray-100" disabled={importing}>
                <X size={20} />
              </button>
            </div>

            {importError && <div className="alert alert-danger mb-4">{importError}</div>}

            {importResults ? (
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-emerald-600">
                  🎉 ¡Importación exitosa! ({importResults.length} estudiantes creados)
                </h3>
                <p className="text-muted text-sm mb-4">
                  Copia y guarda estas credenciales. Por seguridad, no se volverán a mostrar las contraseñas generadas.
                </p>

                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "1rem" }}>
                  <table className="w-full text-left text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead style={{ background: "var(--bg-primary)", position: "sticky", top: 0 }}>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <th className="p-2 font-medium">Nombre</th>
                        <th className="p-2 font-medium">Usuario</th>
                        <th className="p-2 font-medium">Contraseña</th>
                        <th className="p-2 font-medium">Grupo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="p-2 font-medium">{s.name}</td>
                          <td className="p-2" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{s.username}</td>
                          <td className="p-2" style={{ fontFamily: "monospace", fontWeight: "bold" }}>{s.plainPassword}</td>
                          <td className="p-2 text-muted">{s.grade ? `${s.grade}°${s.groupName || ''}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 justify-end border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button className="btn btn-secondary flex items-center gap-2" onClick={copyAllImportCredentials}>
                    {copiedAll ? <Check size={16} /> : <Copy size={16} />}
                    {copiedAll ? "¡Credenciales Copiadas!" : "Copiar Todo el Reporte"}
                  </button>
                  <button className="btn btn-primary" onClick={closeImportModal}>
                    Terminar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-muted text-sm mb-4">
                  Sube un archivo CSV o Excel (.xlsx, .xls) con los datos de los estudiantes. El archivo debe incluir encabezados. 
                  Las columnas sugeridas son: <strong>Nombre</strong>, <strong>Grado</strong>, <strong>Grupo</strong> (o en inglés: <em>name, grade, groupName</em>).
                </p>

                <div className="mb-4">
                  <label htmlFor="csv-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "2rem", textAlign: "center", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
                    <Upload size={32} className="mx-auto mb-2 text-blue-600" />
                    <p className="text-sm font-semibold">{importFile ? importFile.name : "Seleccionar Archivo CSV / Excel"}</p>
                    <p className="text-xs text-muted mt-1">Formatos soportados: .csv, .xlsx, .xls</p>
                    <input id="csv-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                {importData.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm mb-2 text-muted uppercase">Vista previa de estudiantes ({importData.length})</h3>
                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
                      <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
                        <thead style={{ background: "var(--bg-primary)", position: "sticky", top: 0 }}>
                          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <th className="p-2 font-medium">Nombre</th>
                            <th className="p-2 font-medium">Grado</th>
                            <th className="p-2 font-medium">Grupo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td className="p-2 font-medium">{row.name}</td>
                              <td className="p-2 text-muted">{row.grade || '—'}</td>
                              <td className="p-2 text-muted">{row.groupName || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importData.length > 10 && (
                        <div className="p-2 text-center text-muted text-xs bg-gray-50 border-t">
                          Y {importData.length - 10} alumnos más...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeImportModal} disabled={importing}>Cancelar</button>
                  <button type="button" className="btn btn-primary" onClick={executeImport} disabled={importing || importData.length === 0}>
                    {importing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    {importing ? "Importando..." : `Importar ${importData.length} Estudiantes`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
