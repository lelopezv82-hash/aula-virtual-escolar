"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";

export default function ConfigForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "danger", text: "Todos los campos son obligatorios." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "danger", text: "La nueva contraseña y su confirmación no coinciden." });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "danger", text: "La nueva contraseña debe tener al menos 6 caracteres." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/estudiante/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Contraseña actualizada correctamente." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
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
        <div className={`alert alert-${message.type} animate-fade-in`} style={{
          padding: "1rem",
          borderRadius: "var(--radius-md)",
          backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
          color: message.type === "success" ? "var(--success)" : "var(--danger)",
          border: `1px solid ${message.type === "success" ? "var(--success)" : "var(--danger)"}`,
        }}>
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      <div className="input-group">
        <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
          Contraseña Actual
        </label>
        <input
          type="password"
          className="input-field"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          placeholder="••••••••"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="flex-col sm:grid">
        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Nueva Contraseña
          </label>
          <input
            type="password"
            className="input-field"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Confirmar Nueva Contraseña
          </label>
          <input
            type="password"
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Repite la contraseña"
          />
        </div>
      </div>

      <div className="pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: "var(--success)" }}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {loading ? "Guardando..." : "Cambiar Contraseña"}
        </button>
      </div>
    </form>
  );
}
