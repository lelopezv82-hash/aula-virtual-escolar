"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import "./page.css";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container flex flex-col items-center justify-center">
      <div className="glass-panel landing-card animate-fade-in">
        <div className="logo-container">
          <div className="logo-image-wrapper">
            <Image 
              src="/book_laptop_logo.png" 
              alt="Aula Virtual Logo" 
              width={180} 
              height={180} 
              className="logo-image"
              priority
            />
          </div>
          <h1 className="logo-text">Aula Virtual</h1>
          <p className="subtitle">
            Conectando conocimiento, innovación y aprendizaje.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger animate-fade-in mt-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4 text-left">
          <div className="input-group">
            <label htmlFor="username">Usuario</label>
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                id="username"
                type="text"
                className="input-field with-icon"
                placeholder="Ej. juan.perez"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrapper relative">
              <Lock className="input-icon" size={20} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input-field with-icon pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
        </form>
      </div>
      
      <div className="background-decorations">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
    </div>
  );
}
