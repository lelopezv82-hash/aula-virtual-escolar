"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Search, Edit2, Trash2, KeyRound, Copy, Check,
  X, Save, Loader2, Eye, EyeOff, Upload, FileSpreadsheet
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Teacher {
  id: string;
  name: string;
  username: string;
  passwordPlain?: string | null;
  createdAt: string;
}

interface NewCredentials {
  username: string;
  plainPassword: string;
}

export default function DocentesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({ name: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Import CSV/Excel states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/docentes");
      const data = await res.json();
      if (data.teachers) setTeachers(data.teachers);
    } catch (err) {
      console.error("Error loading teachers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.username.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditTeacher(null);
    setFormData({ name: "", password: "" });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const openEdit = (teacher: Teacher) => {
    setEditTeacher(teacher);
    setFormData({
      name: teacher.name,
      password: teacher.passwordPlain || ""
    });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewCredentials(null);
    setEditTeacher(null);
    setShowModalPassword(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editTeacher ? "PATCH" : "POST";
      const body = editTeacher
        ? { id: editTeacher.id, ...formData }
        : formData;
      const res = await fetch("/api/admin/docentes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (!editTeacher && data.plainPassword) {
          setNewCredentials({ username: data.teacher.username, plainPassword: data.plainPassword });
        } else {
          closeModal();
        }
        fetchTeachers();
      } else {
        setError(data.error || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al docente ${name}? Esta acción eliminará permanentemente sus cursos y es irreversible.`)) return;
    try {
      const res = await fetch("/api/admin/docentes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchTeachers();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
      }
    } catch {
      alert("Error de conexión");
    }
  };

  const handleResetPassword = async (teacher: Teacher) => {
    const newPass = Math.random().toString(36).slice(-8);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/docentes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teacher.id, name: teacher.name, password: newPass }),
      });
      if (res.ok) {
        setNewCredentials({ username: teacher.username, plainPassword: newPass });
        setShowModal(true);
        setEditTeacher(null);
      } else {
        const data = await res.json();
        alert(data.error || "Error al reiniciar contraseña");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(false);
    }
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
            return {
              name: String(name).trim()
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
            return {
              name: String(name).trim()
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
      const res = await fetch("/api/admin/docentes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: importData }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResults(data.createdTeachers);
        fetchTeachers();
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
    const text = importResults.map(t => `Nombre: ${t.name} | Usuario: ${t.username} | Contraseña: ${t.plainPassword}`).join("\n");
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
          <h1>Gestión de Docentes</h1>
          <p>Administra las cuentas de profesores, credenciales de acceso y asignaciones.</p>
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
            <UserPlus size={18} /> Nuevo Docente
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
              placeholder="Buscar por nombre, usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-muted text-sm">{filtered.length} docente(s)</span>
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
                  <th className="py-3 px-4 font-medium">Fecha de Registro</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted">
                      {search ? "No se encontraron resultados." : "No hay docentes registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((teacher) => (
                    <tr key={teacher.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td className="py-3 px-4 font-medium">{teacher.name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{teacher.username}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {teacher.passwordPlain ? (
                              visiblePasswords[teacher.id] ? teacher.passwordPlain : "••••••••"
                            ) : (
                              <span className="text-muted italic text-xs">No disponible</span>
                            )}
                          </span>
                          {teacher.passwordPlain && (
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                              className="p-1 rounded text-muted hover:text-primary hover:bg-gray-100 transition-colors"
                              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "0.25rem" }}
                              title={visiblePasswords[teacher.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {visiblePasswords[teacher.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">
                        {new Date(teacher.createdAt).toLocaleDateString("es-CO")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <button title="Editar" onClick={() => openEdit(teacher)}
                            className="p-2 rounded-md hover:bg-blue-50 transition-colors" style={{ color: "var(--primary-color)" }}>
                            <Edit2 size={16} />
                          </button>
                          <button title="Reiniciar contraseña" onClick={() => handleResetPassword(teacher)}
                            className="p-2 rounded-md hover:bg-yellow-50 transition-colors" style={{ color: "var(--warning)" }}>
                            <KeyRound size={16} />
                          </button>
                          <button title="Eliminar" onClick={() => handleDelete(teacher.id, teacher.name)}
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

      {/* Single Teacher Modal */}
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
                  Comparte estas credenciales con el docente. La contraseña <strong>no se puede recuperar</strong> después de cerrar esta ventana.
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
                    {editTeacher ? "Editar Docente" : "Nuevo Docente"}
                  </h2>
                  <button type="button" onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="input-group">
                  <label>Nombre Completo *</label>
                  <input type="text" className="input-field" placeholder="Ej. Prof. Carlos Gómez"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div className="input-group">
                  <label>{editTeacher ? "Contraseña" : "Contraseña (opcional)"}</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showModalPassword ? "text" : "password"} 
                      className="input-field" 
                      style={{ paddingRight: "2.5rem" }}
                      placeholder={editTeacher ? "Contraseña actual del docente" : "Dejar vacío para generar automáticamente"}
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
                    {editTeacher ? "Modifica este campo para cambiar la contraseña del docente." : "Si no escribes una, se generará automáticamente."}
                  </p>
                </div>

                {!editTeacher && (
                  <div style={{ padding: "0.75rem", background: "rgba(37,99,235,0.07)", borderRadius: "var(--radius-md)", fontSize: "0.875rem", color: "var(--primary-color)" }}>
                    ℹ️ El usuario se generará automáticamente a partir del nombre.
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editTeacher ? "Guardar Cambios" : "Crear Docente"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV/Excel Import Modal */}
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
                Importar Docentes desde CSV / Excel
              </h2>
              <button type="button" onClick={closeImportModal} className="p-1 rounded hover:bg-gray-100" disabled={importing}>
                <X size={20} />
              </button>
            </div>

            {importError && <div className="alert alert-danger mb-4">{importError}</div>}

            {importResults ? (
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-emerald-600">
                  🎉 ¡Importación exitosa! ({importResults.length} docentes creados)
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
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="p-2 font-medium">{t.name}</td>
                          <td className="p-2" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.username}</td>
                          <td className="p-2" style={{ fontFamily: "monospace", fontWeight: "bold" }}>{t.plainPassword}</td>
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
                  Sube un archivo CSV o Excel (.xlsx, .xls) con los datos de los docentes. El archivo debe incluir encabezados. 
                  La columna sugerida es: <strong>Nombre</strong> (o en inglés: <em>name</em>).
                </p>

                <div className="mb-4">
                  <label htmlFor="teacher-csv-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "2rem", textAlign: "center", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
                    <Upload size={32} className="mx-auto mb-2 text-blue-600" />
                    <p className="text-sm font-semibold">{importFile ? importFile.name : "Seleccionar Archivo CSV / Excel"}</p>
                    <p className="text-xs text-muted mt-1">Formatos soportados: .csv, .xlsx, .xls</p>
                    <input id="teacher-csv-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                {importData.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm mb-2 text-muted uppercase">Vista previa de docentes ({importData.length})</h3>
                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
                      <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
                        <thead style={{ background: "var(--bg-primary)", position: "sticky", top: 0 }}>
                          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <th className="p-2 font-medium">Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td className="p-2 font-medium">{row.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importData.length > 10 && (
                        <div className="p-2 text-center text-muted text-xs bg-gray-50 border-t">
                          Y {importData.length - 10} docentes más...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeImportModal} disabled={importing}>Cancelar</button>
                  <button type="button" className="btn btn-primary" onClick={executeImport} disabled={importing || importData.length === 0}>
                    {importing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    {importing ? "Importando..." : `Importar ${importData.length} Docentes`}
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
