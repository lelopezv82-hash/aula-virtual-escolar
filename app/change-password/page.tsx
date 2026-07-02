"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import "../login/login.css";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Wait a short moment to show success message before redirecting
        setTimeout(() => {
          if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
            router.push("/admin");
          } else if (data.role === "TEACHER") {
            router.push("/docente");
          } else {
            router.push("/estudiante");
          }
        }, 1500);
      } else {
        setError(data.error || "Error al actualizar la contraseña");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container flex items-center justify-center">
      <div className="login-card glass-panel animate-fade-in" style={{ maxWidth: "460px" }}>
        <div className="login-header text-center">
          <div className="inline-flex justify-center mb-4">
            <div className="p-3 rounded-full" style={{ background: "var(--primary-light)", color: "var(--primary-color)" }}>
              <BookOpen size={40} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Actualiza tu contraseña</h2>
          <p className="text-muted text-sm" style={{ lineHeight: "1.4" }}>
            Por motivos de seguridad, debes cambiar tu contraseña inicial antes de poder acceder a la plataforma.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger animate-fade-in mt-4">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success animate-fade-in mt-4" style={{
            backgroundColor: "rgba(25, 135, 84, 0.1)",
            color: "var(--success)",
            border: "1px solid rgba(25, 135, 84, 0.2)",
            padding: "1rem",
            borderRadius: "var(--radius-md)"
          }}>
            ✓ Contraseña actualizada. Redirigiendo al panel...
          </div>
        )}

        {!success && (
          <form onSubmit={handlePasswordChange} className="mt-6 flex flex-col gap-4">
            <div className="input-group">
              <label htmlFor="currentPassword">Contraseña Actual</label>
              <div className="input-wrapper relative">
                <Lock className="input-icon" size={20} />
                <input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  className="input-field with-icon pr-10"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showCurrent ? "Ocultar" : "Mostrar"}
                >
                  {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="newPassword">Nueva Contraseña</label>
              <div className="input-wrapper relative">
                <Lock className="input-icon" size={20} />
                <input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  className="input-field with-icon pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showNew ? "Ocultar" : "Mostrar"}
                >
                  {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
              <div className="input-wrapper relative">
                <Lock className="input-icon" size={20} />
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  className="input-field with-icon pr-10"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showConfirm ? "Ocultar" : "Mostrar"}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Actualizar Contraseña <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="background-decorations">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
    </div>
  );
}
