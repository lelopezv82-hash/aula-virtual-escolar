"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

interface ConfigFormProps {
  initialName: string;
}

export default function ConfigForm({ initialName }: ConfigFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchCurrentPassword = async () => {
      try {
        const res = await fetch("/api/auth/current-password");
        if (res.ok) {
          const data = await res.json();
          if (data.passwordPlain) {
            setCurrentPassword(data.passwordPlain);
          }
        }
      } catch (err) {
        console.error("Error fetching current password", err);
      }
    };
    fetchCurrentPassword();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "danger", text: "La nueva contraseña y su confirmación no coinciden." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/docente/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Perfil actualizado correctamente." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh(); // Refresh layout to update teacher name in sidebar
      } else {
        setMessage({ type: "danger", text: data.error || "Ocurrió un error al actualizar." });
      }
    } catch {
      setMessage({ type: "danger", text: "Error de red al intentar actualizar." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-[500px]">
      {message && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      <div className="input-group">
        <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
          Nombre Completo *
        </label>
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Tu nombre completo"
        />
      </div>

      <div className="border-t pt-5 mt-2" style={{ borderColor: "var(--border-color)" }}>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <KeyRound size={18} className="text-amber-500" />
          Cambiar Contraseña
        </h3>
        
        <div className="flex flex-col gap-4">
          <p className="text-muted text-xs mb-1">
            Completa estos campos únicamente si deseas actualizar tu contraseña de acceso.
          </p>

          <div className="input-group">
            <label className="font-semibold text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Contraseña Actual
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                className="input-field"
                style={{ paddingRight: "2.5rem" }}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              {currentPassword && (
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
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
                  title={showCurrent ? "Ocultar" : "Mostrar"}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="flex-col sm:grid">
            <div className="input-group">
              <label className="font-semibold text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Nueva Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  className="input-field"
                  style={{ paddingRight: "2.5rem" }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
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
                    title={showNew ? "Ocultar" : "Mostrar"}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>

            <div className="input-group">
              <label className="font-semibold text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Confirmar Nueva Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  className="input-field"
                  style={{ paddingRight: "2.5rem" }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                />
                {confirmPassword && (
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
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
                    title={showConfirm ? "Ocultar" : "Mostrar"}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {loading ? "Guardando..." : "Guardar Configuración"}
        </button>
      </div>
    </form>
  );
}
