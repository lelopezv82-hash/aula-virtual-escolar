"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, User, Lock, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import "./login.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        if (data.user.role === "ADMIN") {
          router.push("/admin");
        } else if (data.user.role === "TEACHER") {
          router.push("/docente");
        } else {
          router.push("/estudiante");
        }
      } else {
        setError(data.error || "Error al iniciar sesión");
      }
    } catch (err) {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container flex items-center justify-center">
      <div className="login-card glass-panel animate-fade-in">
        <div className="login-header text-center">
          <Link href="/" className="inline-flex justify-center mb-4">
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              <BookOpen size={40} color="var(--primary-color)" />
            </div>
          </Link>
          <h2 className="text-2xl font-bold mb-2">Bienvenido de nuevo</h2>
          <p className="text-muted">Ingresa tus credenciales para continuar</p>
        </div>

        {error && (
          <div className="alert alert-danger animate-fade-in mt-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
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
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                id="password"
                type="password"
                className="input-field with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
