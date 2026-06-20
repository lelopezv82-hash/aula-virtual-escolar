"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, UploadCloud } from "lucide-react";
import Link from "next/link";
import { toColombiaISOString } from "@/lib/dateUtils";

export default function EditarTareaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [theme, setTheme] = useState("");
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("0");
  const [duration, setDuration] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{id: string, name: string}[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<{id: string, name: string, active: boolean}[]>([]);

  useEffect(() => {
    // Fetch grade groups
    fetch("/api/grados")
      .then(res => res.json())
      .then(data => {
        if (data.grades) {
          const flatGroups: any[] = [];
          data.grades.forEach((g: any) => {
            g.groups.forEach((gp: any) => {
              flatGroups.push({
                id: gp.id,
                name: `${g.name} - ${gp.name}`
              });
            });
          });
          setGradeGroups(flatGroups);
        }
      })
      .catch(() => console.error("Failed to load grade groups"));

    // Fetch active periods
    fetch("/api/docente/periodos")
      .then(res => res.json())
      .then(data => {
        if (data.periods) setPeriods(data.periods);
      })
      .catch(() => console.error("Failed to load periods"));

    fetch(`/api/docente/tareas/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          setTitle(data.task.title);
          setDescription(data.task.description || "");
          setTheme(data.task.theme || "");
          setPeriod(data.task.period || "");
          setWeight(data.task.weight !== undefined ? String(data.task.weight) : "0");
          setDuration(data.task.duration !== null && data.task.duration !== undefined ? String(data.task.duration) : "");
          setGroupIds(data.task.groups ? data.task.groups.map((g: any) => g.id) : []);
          // Convert date to local string for datetime-local input (yyyy-MM-ddThh:mm)
          setDueDate(toColombiaISOString(data.task.dueDate));
          setExistingAttachment(data.task.attachmentUrl || null);
        } else {
          setError("No se pudo cargar la tarea");
        }
      })
      .catch(() => setError("Error de conexión al cargar la tarea"))
      .finally(() => setFetching(false));
  }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("dueDate", dueDate);
    if (theme) formData.append("theme", theme);
    if (period) formData.append("period", period);
    formData.append("weight", weight);
    if (duration) formData.append("duration", duration);
    formData.append("groupIds", JSON.stringify(groupIds));
    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch(`/api/docente/tareas/${taskId}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/docente/contenido");
        router.refresh();
      } else {
        setError(data.error || "Error al actualizar la tarea");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/docente/contenido" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar Tarea</h1>
          <p className="text-muted text-sm">Modifica los detalles y recursos de la tarea</p>
        </div>
      </div>
      
      {/* Forms and content */}
      <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <div className="input-group">
          <label className="font-semibold text-xs mb-1.5 block">Asignar a Grupos (Múltiple) *</label>
          
          <div className="flex justify-between items-center mb-2">
            <button
              type="button"
              onClick={() => {
                const allIds = gradeGroups.map(g => g.id);
                const allSelected = allIds.every(id => groupIds.includes(id));
                setGroupIds(allSelected ? [] : allIds);
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              {gradeGroups.map(g => (g as any).id).every(id => groupIds.includes(id)) 
                ? "Desmarcar todos" 
                : "Seleccionar todos"}
            </button>
            <span className="text-[10px] text-muted font-medium">
              {groupIds.length} seleccionado(s)
            </span>
          </div>

          <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto flex flex-col gap-2 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
            {gradeGroups.map(g => {
              const isChecked = groupIds.includes(g.id);
              return (
                <label key={g.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const newIds = isChecked
                        ? groupIds.filter(id => id !== g.id)
                        : [...groupIds, g.id];
                      setGroupIds(newIds);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="input-group flex-1">
            <label htmlFor="theme">Tema</label>
            <input
              id="theme"
              type="text"
              className="input-field"
              placeholder="Ej. Cinemática, Álgebra"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              required
            />
          </div>
          <div className="input-group flex-1">
            <label htmlFor="period">Periodo *</label>
            <select
              id="period"
              className="input-field"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
            >
              <option value="" disabled>Selecciona periodo</option>
              {periods.filter(p => p.active || p.name === period).map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group flex-initial w-32">
            <label htmlFor="weight">Porcentaje (%)</label>
            <input
              id="weight"
              type="number"
              min="0"
              max="100"
              className="input-field"
              placeholder="0-100"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="title">Título de la Tarea</label>
          <input
            id="title"
            type="text"
            className="input-field"
            placeholder="Ej. Ensayo sobre la Revolución Industrial"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="description">Descripción e Instrucciones</label>
          <textarea
            id="description"
            className="input-field"
            placeholder="Detalla lo que los estudiantes deben hacer..."
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="input-group flex-1">
            <label htmlFor="dueDate">Fecha y Hora Límite *</label>
            <input
              id="dueDate"
              type="datetime-local"
              className="input-field"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="input-group flex-1">
            <label htmlFor="duration">Límite de Tiempo (minutos, opcional)</label>
            <input
              id="duration"
              type="number"
              min="1"
              placeholder="Ej. 60 (vacío para ilimitado)"
              className="input-field"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        {existingAttachment && (
          <div className="p-3 border rounded-md" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <p className="text-xs text-muted">Archivo adjunto actual:</p>
            <a href={existingAttachment} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline block truncate" style={{ color: 'var(--primary-color)' }}>
              {existingAttachment.split('/').pop()}
            </a>
          </div>
        )}

        <div className="input-group">
          <label className="block text-sm font-medium mb-2">Reemplazar / Añadir Archivo (Opcional)</label>
          <label htmlFor="task-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
            <UploadCloud size={32} className="mx-auto mb-2" style={{ color: "var(--primary-color)" }} />
            <p className="text-sm font-medium">{file ? file.name : "Haz clic para seleccionar un nuevo archivo"}</p>
            <p className="text-xs text-muted mt-1">PDF, Word, Excel, presentaciones o imágenes</p>
            <input id="task-file" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <Link href="/docente/contenido" className="btn btn-secondary">
            Cancelar
          </Link>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}
