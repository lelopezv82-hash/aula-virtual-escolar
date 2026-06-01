"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Cloud, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

function GoogleDriveConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasFolder, setHasFolder] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();

    // Check query parameters for OAuth results
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "google_connected") {
      setMessage({ type: "success", text: "¡Tu cuenta de Google Drive se ha conectado exitosamente!" });
      router.replace("/docente/configuracion");
    } else if (error) {
      let errorText = "Ocurrió un error al intentar vincular tu cuenta de Google.";
      if (error === "google_auth_failed") errorText = "La autenticación con Google falló.";
      if (error === "invalid_callback") errorText = "Respuesta inválida de Google.";
      if (error === "not_authorized") errorText = "Sesión no autorizada.";
      if (error === "session_mismatch") errorText = "La sesión no coincide.";
      if (error === "missing_credentials") errorText = "Faltan credenciales de Google en el servidor.";
      setMessage({ type: "danger", text: errorText });
      router.replace("/docente/configuracion");
    }
  }, [searchParams]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/docente/configuracion");
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.isConnected);
        setHasFolder(data.hasFolder);
      }
    } catch (err) {
      console.error("Error fetching Google Drive status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to the API route that starts the Google auth flow
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de que deseas desvincular Google Drive? Las nuevas subidas de archivos volverán a guardarse en la nube del sistema.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch("/api/docente/configuracion", {
        method: "DELETE",
      });

      if (res.ok) {
        setIsConnected(false);
        setHasFolder(false);
        setMessage({ type: "success", text: "Google Drive desvinculado correctamente." });
      } else {
        setMessage({ type: "danger", text: "No se pudo desvincular Google Drive." });
      }
    } catch {
      setMessage({ type: "danger", text: "Error de red al intentar desvincular." });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span className="text-sm text-muted">Cargando estado de almacenamiento...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[500px]">
      {message && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      <div className="p-4 rounded-lg border" style={{ borderColor: isConnected ? "var(--success)" : "var(--border-color)", background: "var(--bg-secondary)" }}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full mt-1" style={{ background: isConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)" }}>
            <Cloud size={24} style={{ color: isConnected ? "var(--success)" : "var(--warning)" }} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">
              Almacenamiento: {isConnected ? "Google Drive Vinculado" : "Nube Local Activa"}
            </h4>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {isConnected
                ? "Tus archivos y las entregas de tus estudiantes se guardarán automáticamente en tu Google Drive personal (en la carpeta 'Aula Virtual Escolar')."
                : "Vincula tu Google Drive para que los archivos subidos al sistema por ti o por tus estudiantes se guarden directamente en tu cuenta y no consuman espacio de la base de datos."}
            </p>

            <div className="mt-4 flex items-center gap-3">
              {isConnected ? (
                <button
                  type="button"
                  className="btn btn-secondary text-xs py-1 px-3"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  {disconnecting ? <Loader2 className="animate-spin" size={12} /> : null}
                  Desvincular Cuenta
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary text-xs py-1 px-3"
                  onClick={handleConnect}
                >
                  Vincular Google Drive
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoogleDriveConfig() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span className="text-sm text-muted">Cargando...</span>
      </div>
    }>
      <GoogleDriveConfigContent />
    </Suspense>
  );
}
