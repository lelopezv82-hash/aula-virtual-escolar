"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Cloud, Loader2, Trash2, Plus, HardDrive, CheckCircle2, AlertTriangle } from "lucide-react";
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
  const [poolStats, setPoolStats] = useState({ totalLimit: 0, totalUsage: 0, totalFree: 0, hasPooled: false });
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/docente/configuracion");
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.isConnected);
        setAccounts(data.accounts || []);
        setPoolStats(data.poolStats || { totalLimit: 0, totalUsage: 0, totalFree: 0, hasPooled: false });
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
    <div className="flex flex-col gap-4">
      {message && (
        <div className={`alert alert-${message.type} animate-fade-in`}>
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      {/* Header status block */}
      <div className={`p-3 rounded-lg border flex items-center gap-2.5 ${
        isConnected 
          ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-250 dark:border-emerald-900/60" 
          : "bg-amber-50/50 dark:bg-amber-950/10 border-amber-250 dark:border-amber-900/60"
      }`}>
        <Cloud size={20} className={isConnected ? "text-emerald-500" : "text-amber-500"} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {isConnected ? `Pool de Google Drive Activo` : "Almacenamiento Local Activo"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {isConnected 
              ? `${accounts.length} ${accounts.length === 1 ? 'cuenta vinculada y unida' : 'cuentas vinculadas y unidas'}` 
              : "Los archivos se guardarán en la nube local del sistema."}
          </p>
        </div>
        {isConnected ? (
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        )}
      </div>

      <p className="text-xs text-muted leading-relaxed">
        Tus archivos y las entregas de tus estudiantes se guardarán en tu pool de almacenamiento. El sistema distribuirá de manera inteligente los archivos priorizando las cuentas con más espacio libre.
      </p>

      {/* Combined Progress Bar */}
      {isConnected && (
        <div className="p-3.5 rounded-lg bg-gray-100/50 dark:bg-zinc-900/40 border border-gray-200/60 dark:border-zinc-800/80">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              <HardDrive size={13} />
              Almacenamiento Total Combinado
            </span>
            <span className="text-xs text-muted font-semibold">
              {formatBytes(poolStats.totalUsage)} / {poolStats.hasPooled ? "Compartido (100 TB)" : formatBytes(poolStats.totalLimit)}
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
            <span>{formatBytes(poolStats.totalFree)} libres</span>
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
          <div className="flex flex-col gap-2.5">
            {accounts.map((acc) => {
              const usagePercentage = acc.limit > 0 ? (acc.usage / acc.limit) * 100 : 0;
              return (
                <div 
                  key={acc.id} 
                  className="p-3 rounded-lg border border-gray-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative group hover:border-gray-250 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-xs font-semibold truncate text-emerald-600 dark:text-emerald-400" title={acc.email}>
                      {acc.email}
                    </p>
                    <p className="text-[10px] text-muted">
                      Espacio: {formatBytes(acc.usage)} / {acc.isPooled ? "Compartido (100 TB)" : formatBytes(acc.limit)} ({usagePercentage.toFixed(1)}% usado)
                    </p>
                    
                    {/* Micro progress bar for individual account */}
                    <div className="w-full max-w-[200px] bg-gray-150 dark:bg-zinc-850 rounded-full h-1 overflow-hidden mt-0.5">
                      <div 
                        className="bg-emerald-400 dark:bg-emerald-500 h-1 rounded-full transition-all duration-500" 
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleDisconnect(acc.id, acc.email)}
                      disabled={actionLoadingId === acc.id}
                      className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 cursor-pointer transition-all hover:bg-rose-50 dark:hover:bg-rose-950/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-250/50"
                      style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                    >
                      {actionLoadingId === acc.id ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Desvincular
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workspace Note */}
      {poolStats.hasPooled && (
        <div className="mt-1 p-2.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-150 dark:border-blue-900/40 rounded-lg text-[10px] text-muted leading-relaxed flex items-start gap-1.5">
          <span className="text-blue-500 font-semibold shrink-0">ℹ</span>
          <span>
            <strong>Nota sobre Google Workspace:</strong> Al usar un correo institucional, Google reporta el límite de almacenamiento total compartido de tu colegio (100 TB). Tu capacidad de subida personal está sujeta al límite asignado por el administrador de tu institución.
          </span>
        </div>
      )}

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
