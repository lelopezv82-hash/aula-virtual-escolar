"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Cloud, Loader2, ChevronDown, ChevronUp, Trash2, Plus, HardDrive } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

// Helper function to format bytes into human readable format
const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 0.1) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
  return `${gb.toFixed(2)} GB`;
};

function GoogleDriveConfigContent() {
  const router = useRouter();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [poolStats, setPoolStats] = useState({ totalLimit: 0, totalUsage: 0, totalFree: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/docente/configuracion");
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.isConnected);
        setAccounts(data.accounts || []);
        setPoolStats(data.poolStats || { totalLimit: 0, totalUsage: 0, totalFree: 0 });
      }
    } catch (err) {
      console.error("Error fetching Google Drive status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [searchParams, fetchStatus, router]);

  const handleConnect = () => {
    // Redirect to the API route that starts the Google auth flow
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = async (accountId: string, email: string) => {
    const ok = await confirm({
      title: "Desvincular Cuenta",
      message: `¿Estás seguro de que deseas desvincular la cuenta de Google Drive (${email})? Los archivos de esta cuenta seguirán en tu Drive, pero las nuevas subidas se realizarán en las cuentas restantes del pool.`,
      confirmText: "Desvincular",
      cancelText: "Cancelar",
      type: "danger"
    });

    if (!ok) {
      return;
    }

    setActionLoadingId(accountId);
    try {
      const res = await fetch(`/api/docente/configuracion?accountId=${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Google Drive (${email}) desvinculado correctamente.` });
        fetchStatus();
      } else {
        setMessage({ type: "danger", text: "No se pudo desvincular la cuenta de Google Drive." });
      }
    } catch {
      setMessage({ type: "danger", text: "Error de red al intentar desvincular." });
    } finally {
      setActionLoadingId(null);
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

  // Combined utilization percentage
  const combinedUsePercentage = poolStats.totalLimit > 0 
    ? (poolStats.totalUsage / poolStats.totalLimit) * 100 
    : 0;

  return (
    <div className="flex flex-col gap-4 max-w-[500px]">
      {message && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowConfig(!showConfig)}
        className="w-full flex items-center justify-between text-left focus:outline-none p-3 rounded-lg border border-gray-150 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 transition-all hover:bg-gray-100/30 dark:hover:bg-zinc-800/20"
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <Cloud size={18} className={isConnected ? "text-emerald-500" : "text-amber-500"} />
          Estado: {isConnected ? `Pool de Google Drive Activo (${accounts.length} ${accounts.length === 1 ? 'cuenta' : 'cuentas'})` : "Almacenamiento Local Activo"}
        </span>
        {showConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {showConfig && (
        <div className="p-4 rounded-lg border animate-fade-in flex flex-col gap-4" style={{ borderColor: isConnected ? "var(--success)" : "var(--border-color)", background: "var(--bg-secondary)" }}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full mt-1" style={{ background: isConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)" }}>
              <Cloud size={24} style={{ color: isConnected ? "var(--success)" : "var(--warning)" }} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">
                Configuración de Google Drive
              </h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Tus archivos y las entregas de tus estudiantes se guardarán automáticamente en tu pool de almacenamiento. El sistema distribuirá de manera inteligente los archivos priorizando las cuentas con más espacio libre.
              </p>
            </div>
          </div>

          {/* Combined Progress Bar */}
          {isConnected && (
            <div className="p-3.5 rounded-lg bg-gray-100/50 dark:bg-zinc-900/40 border border-gray-200/60 dark:border-zinc-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  <HardDrive size={13} />
                  Almacenamiento Combinado
                </span>
                <span className="text-xs text-muted font-semibold">
                  {formatBytes(poolStats.totalUsage)} / {formatBytes(poolStats.totalLimit)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-850 rounded-full h-2.5 overflow-hidden mb-1.5">
                <div 
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${combinedUsePercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted font-medium">
                <span>{combinedUsePercentage.toFixed(1)}% usado</span>
                <span>{formatBytes(poolStats.totalFree)} disponibles de espacio libre</span>
              </div>
            </div>
          )}

          {/* Accounts List */}
          <div className="flex flex-col gap-2.5 mt-1">
            <h5 className="text-[10px] font-bold tracking-wider text-muted uppercase">Cuentas vinculadas al pool</h5>
            
            {accounts.length === 0 ? (
              <p className="text-xs text-muted italic p-3 text-center bg-gray-150/10 dark:bg-zinc-900/10 rounded-lg border border-dashed border-gray-150 dark:border-zinc-800">
                No tienes cuentas vinculadas. Vincula tu primer Google Drive para empezar a expandir tu espacio de almacenamiento.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.map((acc) => {
                  const usagePercentage = acc.limit > 0 ? (acc.usage / acc.limit) * 100 : 0;
                  return (
                    <div 
                      key={acc.id} 
                      className="p-3 rounded-lg border border-gray-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-col gap-2 relative group hover:border-gray-250 dark:hover:border-zinc-700 transition-all"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-gray-800 dark:text-gray-250" title={acc.email}>
                            {acc.email}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">
                            Espacio: {formatBytes(acc.usage)} / {formatBytes(acc.limit)} ({usagePercentage.toFixed(1)}% usado)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(acc.id, acc.email)}
                          disabled={actionLoadingId === acc.id}
                          className="p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all focus:outline-none cursor-pointer"
                          title="Desvincular cuenta"
                        >
                          {actionLoadingId === acc.id ? (
                            <Loader2 className="animate-spin" size={13} />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>

                      {/* Micro progress bar for individual account */}
                      <div className="w-full bg-gray-150 dark:bg-zinc-850 rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-emerald-400 dark:bg-emerald-500 h-1 rounded-full transition-all duration-500" 
                          style={{ width: `${usagePercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 pt-3 border-t border-gray-150 dark:border-zinc-800/80 flex justify-end">
            <button
              type="button"
              className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold cursor-pointer transition-all hover:opacity-90 active:scale-95"
              onClick={handleConnect}
            >
              <Plus size={14} />
              {accounts.length > 0 ? "Vincular otra cuenta" : "Vincular Google Drive"}
            </button>
          </div>
        </div>
      )}
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
