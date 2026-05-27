"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Search, Edit2, Trash2, KeyRound, Copy, Check,
  X, Save, Loader2, Eye, EyeOff
} from "lucide-react";

interface AdminUser {
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

export default function AdministradoresPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({ name: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/administradores");
      const data = await res.json();
      if (data.admins) setAdmins(data.admins);
    } catch (err) {
      console.error("Error loading admins:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const filtered = admins.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.username.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditAdmin(null);
    setFormData({ name: "", password: "" });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const openEdit = (admin: AdminUser) => {
    setEditAdmin(admin);
    setFormData({
      name: admin.name,
      password: admin.passwordPlain || ""
    });
    setError("");
    setNewCredentials(null);
    setShowModalPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewCredentials(null);
    setEditAdmin(null);
    setShowModalPassword(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editAdmin ? "PATCH" : "POST";
      const body = editAdmin
        ? { id: editAdmin.id, ...formData }
        : formData;
      const res = await fetch("/api/admin/administradores", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (!editAdmin && data.plainPassword) {
          setNewCredentials({ username: data.admin.username, plainPassword: data.plainPassword });
        } else {
          closeModal();
        }
        fetchAdmins();
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
    if (!confirm(`¿Estás seguro de que deseas eliminar al administrador ${name}? Esta acción es irreversible.`)) return;
    try {
      const res = await fetch("/api/admin/administradores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchAdmins();
      } else {
        alert(data.error || "Error al eliminar");
      }
    } catch {
      alert("Error de conexión");
    }
  };

  const handleResetPassword = async (admin: AdminUser) => {
    const newPass = Math.random().toString(36).slice(-8);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/administradores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, name: admin.name, password: newPass }),
      });
      if (res.ok) {
        setNewCredentials({ username: admin.username, plainPassword: newPass });
        setShowModal(true);
        setEditAdmin(null);
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

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1>Gestión de Administradores</h1>
          <p>Administra las cuentas con privilegios de administrador del sistema.</p>
        </div>
        <div>
          <button className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
            <UserPlus size={18} /> Nuevo Administrador
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
          <span className="text-muted text-sm">{filtered.length} administrador(es)</span>
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
                      {search ? "No se encontraron resultados." : "No hay administradores registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((admin) => (
                    <tr key={admin.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td className="py-3 px-4 font-medium">{admin.name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{admin.username}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {admin.passwordPlain ? (
                              visiblePasswords[admin.id] ? admin.passwordPlain : "••••••••"
                            ) : (
                              <span className="text-muted italic text-xs">No disponible</span>
                            )}
                          </span>
                          {admin.passwordPlain && (
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [admin.id]: !prev[admin.id] }))}
                              className="p-1 rounded text-muted hover:text-primary hover:bg-gray-100 transition-colors"
                              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "0.25rem" }}
                              title={visiblePasswords[admin.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {visiblePasswords[admin.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">
                        {new Date(admin.createdAt).toLocaleDateString("es-CO")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <button title="Editar" onClick={() => openEdit(admin)}
                            className="p-2 rounded-md hover:bg-blue-50 transition-colors" style={{ color: "var(--primary-color)" }}>
                            <Edit2 size={16} />
                          </button>
                          <button title="Reiniciar contraseña" onClick={() => handleResetPassword(admin)}
                            className="p-2 rounded-md hover:bg-yellow-50 transition-colors" style={{ color: "var(--warning)" }}>
                            <KeyRound size={16} />
                          </button>
                          <button title="Eliminar" onClick={() => handleDelete(admin.id, admin.name)}
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

      {/* Single Admin Modal */}
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
                  Comparte estas credenciales con el nuevo administrador. La contraseña <strong>no se puede recuperar</strong> después de cerrar esta ventana.
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
                    {editAdmin ? "Editar Administrador" : "Nuevo Administrador"}
                  </h2>
                  <button type="button" onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="input-group">
                  <label>Nombre Completo *</label>
                  <input type="text" className="input-field" placeholder="Ej. Administrador Secundario"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div className="input-group">
                  <label>{editAdmin ? "Contraseña" : "Contraseña (opcional)"}</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showModalPassword ? "text" : "password"} 
                      className="input-field" 
                      style={{ paddingRight: "2.5rem" }}
                      placeholder={editAdmin ? "Contraseña actual del administrador" : "Dejar vacío para generar automáticamente"}
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
                    {editAdmin ? "Modifica este campo para cambiar la contraseña del administrador." : "Si no escribes una, se generará automáticamente."}
                  </p>
                </div>

                {!editAdmin && (
                  <div style={{ padding: "0.75rem", background: "rgba(37,99,235,0.07)", borderRadius: "var(--radius-md)", fontSize: "0.875rem", color: "var(--primary-color)" }}>
                    ℹ️ El usuario se generará automáticamente a partir del nombre.
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editAdmin ? "Guardar Cambios" : "Crear Administrador"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
