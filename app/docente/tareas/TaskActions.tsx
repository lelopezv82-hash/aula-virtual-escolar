"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, Eye, Loader2 } from "lucide-react";
import Link from "next/link";

export default function TaskActions({ taskId }: { taskId: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta tarea? Esta acción eliminará permanentemente la tarea y todas las entregas de los estudiantes.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/docente/tareas/${taskId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar la tarea");
        setDeleting(false);
      }
    } catch (err) {
      alert("Error de conexión al servidor");
      setDeleting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      <Link href={`/docente/tareas/${taskId}`} className="btn btn-secondary text-sm flex items-center gap-1">
        <Eye size={14} /> Ver Entregas
      </Link>
      <Link href={`/docente/tareas/${taskId}/editar`} className="btn btn-secondary text-sm flex items-center gap-1" style={{ color: "var(--primary-color)" }}>
        <Edit2 size={14} /> Editar
      </Link>
      <button 
        type="button" 
        onClick={handleDelete} 
        disabled={deleting}
        className="btn btn-secondary text-sm flex items-center gap-1" 
        style={{ color: "var(--danger)" }}
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Eliminar
      </button>
    </div>
  );
}
