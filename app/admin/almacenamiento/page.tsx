"use client";

import { useState, useEffect } from "react";
import { Database, Trash2, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export default function AlmacenamientoPage() {
  const confirm = useConfirm();
  const [stats, setStats] = useState({ submissionsCount: 0, resourcesCount: 0, totalFilesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/almacenamiento");
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.error || "No se pudieron obtener las estadísticas de almacenamiento.");
      }
    } catch {
      setError("Error de conexión al obtener estadísticas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClear = async (action: "clearSubmissions" | "clearResources", title: string, message: string) => {
    const ok = await confirm({
      title,
      message,
      confirmText: "Vaciar Espacio",
      type: "danger"
    });

    if (!ok) return;

    setActionLoading(action);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/almacenamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Limpieza realizada correctamente.");
        fetchStats();
      } else {
        setError(data.error || "Error al realizar la limpieza.");
      }
    } catch {
      setError("Error de conexión al procesar la limpieza.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="dashboard-header flex justify-between items-center mb-6">
        <div>
          <h1 className="flex items-center gap-2">
            <Database className="text-blue-600" />
            Control de Almacenamiento
          </h1>
          <p className="text-muted text-sm">
            Monitorea el espacio ocupado y vacía archivos para liberar espacio en el sistema.
          </p>
        </div>
        <button className="btn btn-secondary flex items-center gap-1.5 text-sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="alert alert-danger mb-5">{error}</div>}
      {success && (
        <div className="alert alert-success mb-5 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="card text-center py-12">
          <RefreshCw className="animate-spin text-blue-500 mx-auto mb-3" size={36} />
          <p className="text-muted">Calculando archivos almacenados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="card text-center flex flex-col items-center p-6">
            <div className="p-3 rounded-full mb-3" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-color)" }}>
              <Database size={24} />
            </div>
            <h3 className="text-sm font-semibold text-muted mb-1">Archivos en el Sistema</h3>
            <p className="text-3xl font-extrabold">{stats.totalFilesCount}</p>
          </div>

          <div className="card text-center flex flex-col items-center p-6">
            <div className="p-3 rounded-full mb-3" style={{ background: "rgba(107, 114, 128, 0.1)", color: "var(--text-secondary)" }}>
              <Database size={24} />
            </div>
            <h3 className="text-sm font-semibold text-muted mb-1">Entregas de Estudiantes</h3>
            <p className="text-3xl font-extrabold">{stats.submissionsCount}</p>
          </div>

          <div className="card text-center flex flex-col items-center p-6">
            <div className="p-3 rounded-full mb-3" style={{ background: "rgba(107, 114, 128, 0.1)", color: "var(--text-secondary)" }}>
              <Database size={24} />
            </div>
            <h3 className="text-sm font-semibold text-muted mb-1">Recursos de Docentes</h3>
            <p className="text-3xl font-extrabold">{stats.resourcesCount}</p>
          </div>
        </div>
      )}

      <div className="card border-l-4 border-yellow-500 mb-8 p-5" style={{ background: "rgba(245, 158, 11, 0.05)" }}>
        <div className="flex gap-3">
          <ShieldAlert className="text-yellow-600 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-yellow-800">Zona de Mantenimiento Crítico</h3>
            <p className="text-xs text-yellow-700 mt-1">
              Las siguientes acciones eliminarán archivos de almacenamiento y registros de la base de datos de manera definitiva. Úsalo al final del periodo académico para liberar espacio.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="card flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-4">
          <div>
            <h3 className="font-bold text-lg">Vaciar Entregas de Estudiantes</h3>
            <p className="text-sm text-muted mt-1 max-w-xl">
              Elimina los archivos subidos por los estudiantes para sus tareas y resetea sus estados a pendientes. Esto mantendrá las tareas pero borrará los archivos físicos entregados.
            </p>
          </div>
          <button
            className="btn btn-secondary flex items-center gap-1.5 self-start md:self-auto"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => handleClear(
              "clearSubmissions",
              "¿Vaciar Entregas de Estudiantes?",
              "Esta acción eliminará todos los archivos subidos por los estudiantes de forma permanente. Las calificaciones actuales no se perderán, pero los archivos no estarán disponibles."
            )}
            disabled={actionLoading !== null || stats.submissionsCount === 0}
          >
            {actionLoading === "clearSubmissions" ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Vaciar Entregas
          </button>
        </div>

        <div className="card flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-4">
          <div>
            <h3 className="font-bold text-lg">Eliminar Recursos de Docentes</h3>
            <p className="text-sm text-muted mt-1 max-w-xl">
              Elimina los archivos adjuntos y documentos que los profesores han subido a sus cursos. Los enlaces externos (URLs) se conservarán, pero los archivos PDF, Word, imágenes, etc., se eliminarán por completo.
            </p>
          </div>
          <button
            className="btn btn-secondary flex items-center gap-1.5 self-start md:self-auto"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => handleClear(
              "clearResources",
              "¿Eliminar Recursos de Docentes?",
              "Esta acción borrará físicamente todos los archivos (PDF, imágenes, Word) subidos por los docentes en todos los cursos de manera irreversible."
            )}
            disabled={actionLoading !== null || stats.resourcesCount === 0}
          >
            {actionLoading === "clearResources" ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Vaciar Recursos
          </button>
        </div>
      </div>
    </div>
  );
}
