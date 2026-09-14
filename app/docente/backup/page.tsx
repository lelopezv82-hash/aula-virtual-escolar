"use client";

import { useState } from "react";
import { Download, Upload, Shield, FileJson, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function BackupPage() {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [loadingJson, setLoadingJson] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const downloadBackup = async (format: "json" | "excel") => {
    const setLoading = format === "json" ? setLoadingJson : setLoadingExcel;
    setLoading(true);
    setStatus({ type: null, message: "" });

    try {
      const res = await fetch(`/api/backup?format=${format}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al descargar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup_aula_${timestamp}.${format === "excel" ? "xlsx" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: "success", message: `Respaldo ${format === "excel" ? "Excel" : "JSON"} descargado exitosamente.` });
    } catch (e: any) {
      setStatus({ type: "error", message: e.message ?? "Error desconocido" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;

    setLoadingRestore(true);
    setStatus({ type: null, message: "" });

    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Error al restaurar");

      setStatus({ type: "success", message: data.message });
      setRestoreFile(null);
    } catch (e: any) {
      setStatus({ type: "error", message: e.message ?? "Error desconocido" });
    } finally {
      setLoadingRestore(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Copia de Seguridad</h1>
          <p className="text-gray-500 text-sm">Descarga un respaldo completo de la información del sistema</p>
        </div>
      </div>

      {/* Status message */}
      {status.type && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg mb-6 ${
            status.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          )}
          <span className="text-sm">{status.message}</span>
        </div>
      )}

      {/* Download section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Descargar Respaldo
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Descarga toda la información del sistema: estudiantes, actividades, entregas y calificaciones.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => downloadBackup("json")}
              disabled={loadingJson || loadingExcel}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingJson ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              Respaldo Completo (JSON)
            </button>

            <button
              onClick={() => downloadBackup("excel")}
              disabled={loadingJson || loadingExcel}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Respaldo Notas (Excel)
            </button>
          </div>

          <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 pt-2">
            <li><strong>JSON</strong>: Contiene todos los datos del sistema (apto para restaurar)</li>
            <li><strong>Excel</strong>: Contiene estudiantes, grupos, actividades y notas en hojas separadas</li>
          </ul>
        </div>
      </div>

      {/* Restore section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
          <h2 className="font-semibold text-amber-800 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Restaurar Respaldo
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Nota:</strong> La restauración solo actualiza entregas y notas existentes. No elimina datos actuales.
            Solo disponible para administradores.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo JSON de respaldo
            </label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {restoreFile && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              Archivo seleccionado: <strong>{restoreFile.name}</strong> ({(restoreFile.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <button
            onClick={handleRestore}
            disabled={!restoreFile || loadingRestore}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingRestore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Restaurar Respaldo
          </button>
        </div>
      </div>
    </div>
  );
}
