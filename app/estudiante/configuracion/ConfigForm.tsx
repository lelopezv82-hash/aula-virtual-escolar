"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Eye, EyeOff } from "lucide-react";

export default function ConfigForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [securityPin, setSecurityPin] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [hasExistingQuestion, setHasExistingQuestion] = useState(false);
  const [hasExistingPin, setHasExistingPin] = useState(false);

  useEffect(() => {
    const fetchCurrentConfig = async () => {
      try {
        const res = await fetch("/api/auth/current-password");
        if (res.ok) {
          const data = await res.json();
          if (data.passwordPlain) {
            setCurrentPassword(data.passwordPlain);
          }
        }
        const secRes = await fetch("/api/estudiante/configuracion");
        if (secRes.ok) {
          const secData = await secRes.json();
          if (secData.securityQuestion) {
            setSecurityQuestion(secData.securityQuestion);
            setHasExistingQuestion(true);
          }
          if (secData.hasPin) {
            setHasExistingPin(true);
          }
          if (secData.recoveryEmail) {
            setRecoveryEmail(secData.recoveryEmail);
          }
        }
      } catch (err) {
        console.error("Error fetching student configuration", err);
      }
    };
    fetchCurrentConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword) {
      if (!currentPassword) {
        setMessage({ type: "danger", text: "Ingresa tu contraseña actual para cambiarla." });
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
    }

    if (securityPin && !/^\d{4}$/.test(securityPin.trim())) {
      setMessage({ type: "danger", text: "El PIN de seguridad debe tener exactamente 4 dígitos numéricos (ej. 1234)." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/estudiante/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: newPassword ? currentPassword : undefined,
          newPassword: newPassword || undefined,
          securityQuestion: securityQuestion || undefined,
          securityAnswer: securityAnswer || undefined,
          securityPin: securityPin || undefined,
          recoveryEmail: recoveryEmail,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Configuración, correo de recuperación y datos de seguridad actualizados correctamente." });
        setNewPassword("");
        setConfirmPassword("");
        setSecurityAnswer("");
        setSecurityPin("");
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
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
        <div style={{ position: "relative" }}>
          <input
            type={showCurrent ? "text" : "password"}
            className="input-field"
            style={{ paddingRight: "2.5rem" }}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
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
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="flex-col sm:grid">
        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Nueva Contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showNew ? "text" : "password"}
              className="input-field"
              style={{ paddingRight: "2.5rem" }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
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
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
        </div>

        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Confirmar Nueva Contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              className="input-field"
              style={{ paddingRight: "2.5rem" }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
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
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Security Options */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">🔐 Pregunta de Seguridad y PIN (Para recuperar clave si la olvidas)</h3>
          <p className="text-xs text-muted">Configura una pregunta secreta o un PIN de 4 dígitos para recuperar tu contraseña automáticamente en la pantalla de inicio de sesión.</p>
        </div>

        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Pregunta de Seguridad
          </label>
          <select
            className="input-field text-sm"
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
          >
            <option value="">-- Selecciona una pregunta --</option>
            <option value="¿Nombre de tu primera mascota?">¿Nombre de tu primera mascota?</option>
            <option value="¿Nombre de tu primera escuela o colegio?">¿Nombre de tu primera escuela o colegio?</option>
            <option value="¿Ciudad donde naciste?">¿Ciudad donde naciste?</option>
            <option value="¿Nombre de tu deporte o juego favorito?">¿Nombre de tu deporte o juego favorito?</option>
            <option value="¿Nombre de tu mejor amigo de la infancia?">¿Nombre de tu mejor amigo de la infancia?</option>
          </select>
        </div>

        {securityQuestion && (
          <div className="input-group">
            <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Respuesta Secreta
            </label>
            <input
              type="text"
              className="input-field"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="Escribe tu respuesta aquí"
            />
          </div>
        )}

        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            PIN Secreto (4 dígitos numéricos) {hasExistingPin && <span className="text-xs font-normal text-emerald-600">(✓ PIN configurado)</span>}
          </label>
          <input
            type="password"
            maxLength={4}
            className="input-field w-36 text-center font-mono tracking-widest font-bold"
            value={securityPin}
            onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 1234"
          />
        </div>

        <div className="input-group">
          <label className="font-semibold text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>
            📧 Correo Electrónico de Recuperación (Opción 3)
          </label>
          <input
            type="email"
            className="input-field"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            placeholder="ejemplo@estudiante.edu.co"
          />
          <p className="text-[11px] text-muted mt-1">Si olvidas tu clave en el login, podrás solicitar un código o enlace de recuperación enviado a este correo.</p>
        </div>
      </div>

      <div className="pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {loading ? "Guardando..." : "Guardar Cambios y Configuración"}
        </button>
      </div>
    </form>
  );
}
