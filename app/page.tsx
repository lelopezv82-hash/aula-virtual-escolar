"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import "./page.css";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Password Recovery state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recStep, setRecStep] = useState<"user" | "options" | "security" | "email" | "success">("user");
  const [recUsername, setRecUsername] = useState("");
  const [recUserInfo, setRecUserInfo] = useState<any>(null);
  const [recAnswer, setRecAnswer] = useState("");
  const [recPin, setRecPin] = useState("");
  const [recEmailCode, setRecEmailCode] = useState("");
  const [recNewPassword, setRecNewPassword] = useState("");
  const [recError, setRecError] = useState("");
  const [recSuccess, setRecSuccess] = useState("");
  const [recLoading, setRecLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorField("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.user.mustChangePassword) {
          router.push("/change-password");
        } else if (data.user.role === "ADMIN" || data.user.role === "SUPER_ADMIN") {
          router.push("/admin");
        } else if (data.user.role === "TEACHER") {
          router.push("/docente");
        } else {
          router.push("/estudiante");
        }
      } else {
        setError(data.error || "Error al iniciar sesión");
        setErrorField(data.field || "both");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setErrorField("connection");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError("");
    setRecLoading(true);
    try {
      const res = await fetch("/api/auth/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-user", username: recUsername })
      });
      const data = await res.json();
      if (res.ok) {
        setRecUserInfo(data);
        setRecStep("options");
      } else {
        setRecError(data.error || "Usuario no encontrado");
      }
    } catch {
      setRecError("Error de conexión");
    } finally {
      setRecLoading(false);
    }
  };

  const handleVerifySecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError("");
    setRecLoading(true);
    try {
      const res = await fetch("/api/auth/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-security",
          username: recUsername,
          answer: recAnswer,
          pin: recPin,
          newPassword: recNewPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRecSuccess(data.message);
        setRecStep("success");
      } else {
        setRecError(data.error || "Respuesta o PIN incorrecto");
      }
    } catch {
      setRecError("Error de conexión");
    } finally {
      setRecLoading(false);
    }
  };

  const handleSendEmailToken = async () => {
    setRecError("");
    setRecLoading(true);
    try {
      const res = await fetch("/api/auth/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-email-token", username: recUsername })
      });
      const data = await res.json();
      if (res.ok) {
        setRecStep("email");
        if (data.code) setRecEmailCode(data.code);
      } else {
        setRecError(data.error || "Error enviando correo de recuperación");
      }
    } catch {
      setRecError("Error de conexión");
    } finally {
      setRecLoading(false);
    }
  };

  const handleVerifyEmailToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError("");
    setRecLoading(true);
    try {
      const res = await fetch("/api/auth/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-email-token",
          username: recUsername,
          emailCode: recEmailCode,
          newPassword: recNewPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRecSuccess(data.message);
        setRecStep("success");
      } else {
        setRecError(data.error || "Código incorrecto o expirado");
      }
    } catch {
      setRecError("Error de conexión");
    } finally {
      setRecLoading(false);
    }
  };

  const handleRequestTeacherReset = async () => {
    setRecError("");
    setRecLoading(true);
    try {
      const res = await fetch("/api/auth/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request-teacher-reset", username: recUsername })
      });
      const data = await res.json();
      if (res.ok) {
        setRecSuccess(data.message);
        setRecStep("success");
      } else {
        setRecError(data.error || "Error enviando solicitud");
      }
    } catch {
      setRecError("Error de conexión");
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <div className="landing-container flex flex-col items-center justify-center">
      <div className="glass-panel landing-card animate-fade-in">
        <div className="logo-container">
          <h1 className="logo-text">Aula Virtual</h1>
          <p className="subtitle">
            Conectando conocimiento, innovación y aprendizaje.
          </p>
        </div>

        {error && errorField === "connection" && (
          <div className="alert alert-danger animate-fade-in mt-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4 text-left">
          <div className="input-group">
            <label htmlFor="username">Usuario</label>
            <div className="input-wrapper relative">
              <User className="input-icon" size={20} />
              <input
                id="username"
                type="text"
                className={`input-field with-icon ${(errorField === "username" || errorField === "both") ? "is-invalid" : ""}`}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorField === "username" || errorField === "both") {
                    setErrorField("");
                    setError("");
                  }
                }}
                required
              />
              {(errorField === "username" || errorField === "both") && (
                <div className="speech-bubble">
                  {errorField === "both" ? "El usuario es incorrecto" : error}
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrapper relative">
              <Lock className="input-icon" size={20} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`input-field with-icon pr-10 ${(errorField === "password" || errorField === "both") ? "is-invalid" : ""}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorField === "password" || errorField === "both") {
                    setErrorField("");
                    setError("");
                  }
                }}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
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
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              {(errorField === "password" || errorField === "both") && (
                <div className="speech-bubble">
                  {error}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-4 btn-lg"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Ingresar <ArrowRight size={20} />
              </>
            )}
          </button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => {
                setShowRecoveryModal(true);
                setRecStep("user");
                setRecUsername("");
                setRecError("");
                setRecSuccess("");
                setRecAnswer("");
                setRecPin("");
                setRecEmailCode("");
                setRecNewPassword("");
              }}
              className="text-xs font-semibold text-[#f98012] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>
      </div>

      {/* Password Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in text-left flex flex-col gap-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                🔑 Recuperar Contraseña
              </h3>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {recError && (
              <div className="alert alert-danger text-xs font-semibold p-2.5 rounded-lg">
                {recError}
              </div>
            )}

            {/* STEP 1: Enter Username */}
            {recStep === "user" && (
              <form onSubmit={handleCheckUser} className="flex flex-col gap-3">
                <p className="text-xs text-muted">
                  Ingresa tu nombre de usuario para buscar las opciones de recuperación asociadas a tu cuenta.
                </p>
                <div className="input-group">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Usuario
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field text-sm"
                    value={recUsername}
                    onChange={e => setRecUsername(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={recLoading || !recUsername.trim()}
                    className="btn btn-primary text-xs flex items-center gap-1"
                  >
                    {recLoading ? <Loader2 className="animate-spin" size={14} /> : "Continuar ➔"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Choose Method (Option 1 vs Option 2 vs Option 3) */}
            {recStep === "options" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Hola <strong className="text-orange-600">{recUserInfo?.name}</strong>. Elige cómo deseas restablecer tu clave:
                </p>

                {recUserInfo?.hasSecurity && (
                  <button
                    onClick={() => setRecStep("security")}
                    className="p-3 rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20 text-left hover:border-orange-500 transition-all flex flex-col gap-1 group"
                  >
                    <span className="font-bold text-xs text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                      🔐 Responder Pregunta Secreta / PIN
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Restablece tu contraseña de forma inmediata respondiendo tu pregunta o PIN.
                    </span>
                  </button>
                )}

                {recUserInfo?.hasEmail && (
                  <button
                    onClick={handleSendEmailToken}
                    disabled={recLoading}
                    className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-left hover:border-emerald-500 transition-all flex flex-col gap-1 group"
                  >
                    <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      📧 Enviar Código a mi Correo de Recuperación ({recUserInfo.maskedEmail})
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Utiliza el correo registrado en tu configuración para recibir un código de verificación.
                    </span>
                  </button>
                )}

                <button
                  onClick={handleRequestTeacherReset}
                  disabled={recLoading}
                  className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-left hover:border-blue-500 transition-all flex flex-col gap-1 group"
                >
                  <span className="font-bold text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    📢 Solicitar Restablecimiento al Docente / Admin
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Notifica a tu profesor o administrador para que reasigne tu contraseña en el sistema.
                  </span>
                </button>

                <div className="flex justify-start mt-2">
                  <button
                    onClick={() => setRecStep("user")}
                    className="text-xs text-muted hover:underline"
                  >
                    ← Volver
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3A: Security Question / PIN Answer Form */}
            {recStep === "security" && (
              <form onSubmit={handleVerifySecurity} className="flex flex-col gap-3">
                {recUserInfo?.securityQuestion && (
                  <div className="input-group">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                      Pregunta: <span className="text-orange-600">{recUserInfo.securityQuestion}</span>
                    </label>
                    <input
                      type="text"
                      className="input-field text-sm"
                      placeholder="Tu respuesta secreta"
                      value={recAnswer}
                      onChange={e => setRecAnswer(e.target.value)}
                    />
                  </div>
                )}

                {recUserInfo?.hasPin && (
                  <div className="input-group">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                      O tu PIN Secreto (4 dígitos)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      className="input-field text-sm w-32 tracking-widest text-center font-bold font-mono"
                      placeholder="Ej. 1234"
                      value={recPin}
                      onChange={e => setRecPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                )}

                <div className="input-group">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-field text-sm"
                    placeholder="Mínimo 6 caracteres"
                    value={recNewPassword}
                    onChange={e => setRecNewPassword(e.target.value)}
                  />
                </div>

                <div className="flex justify-between items-center mt-2">
                  <button
                    type="button"
                    onClick={() => setRecStep("options")}
                    className="text-xs text-muted hover:underline"
                  >
                    ← Volver
                  </button>
                  <button
                    type="submit"
                    disabled={recLoading || (!recAnswer && !recPin) || !recNewPassword}
                    className="btn btn-primary text-xs flex items-center gap-1"
                  >
                    {recLoading ? <Loader2 className="animate-spin" size={14} /> : "Restablecer Clave"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3B: Email Verification Code Form (Option 3) */}
            {recStep === "email" && (
              <form onSubmit={handleVerifyEmailToken} className="flex flex-col gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  📩 Código generado para <strong>{recUserInfo?.maskedEmail}</strong>. Ingresa el código de 6 dígitos para continuar.
                </div>

                <div className="input-group">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Código de 6 dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    className="input-field text-sm tracking-widest text-center font-mono font-bold w-40 mx-auto"
                    placeholder="123456"
                    value={recEmailCode}
                    onChange={e => setRecEmailCode(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-field text-sm"
                    placeholder="Mínimo 6 caracteres"
                    value={recNewPassword}
                    onChange={e => setRecNewPassword(e.target.value)}
                  />
                </div>

                <div className="flex justify-between items-center mt-2">
                  <button
                    type="button"
                    onClick={() => setRecStep("options")}
                    className="text-xs text-muted hover:underline"
                  >
                    ← Volver
                  </button>
                  <button
                    type="submit"
                    disabled={recLoading || !recEmailCode || !recNewPassword}
                    className="btn btn-primary text-xs flex items-center gap-1"
                  >
                    {recLoading ? <Loader2 className="animate-spin" size={14} /> : "Verificar y Cambiar Clave"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success */}
            {recStep === "success" && (
              <div className="flex flex-col gap-3 text-center py-2">
                <div className="text-4xl">🎉</div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {recSuccess}
                </p>
                <button
                  onClick={() => setShowRecoveryModal(false)}
                  className="btn btn-primary text-xs w-full mt-2"
                >
                  Entendido / Volver al Login
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      <div className="background-decorations">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
    </div>
  );
}
