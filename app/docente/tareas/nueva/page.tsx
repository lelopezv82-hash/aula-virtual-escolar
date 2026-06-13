"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, UploadCloud } from "lucide-react";
import Link from "next/link";

export default function NuevaTareaPage() {
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [courseId, setCourseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [theme, setTheme] = useState("");
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("0");
  const [duration, setDuration] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<{id: string, name: string, active: boolean}[]>([]);

  const [isPeriodLocked, setIsPeriodLocked] = useState(false);
  const [isCourseLocked, setIsCourseLocked] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Fetch teacher's courses
    fetch("/api/docente/cursos")
      .then(res => res.json())
      .then(data => {
        if (data.courses) setCourses(data.courses);
        const c = searchParams.get("courseId");
        if (c) {
          setCourseId(c);
          setIsCourseLocked(true);
        } else if (data.courses?.length > 0) {
          setCourseId(data.courses[0].id);
        }
      })
      .catch(() => console.error("Failed to load courses"));

    // Fetch active periods
    fetch("/api/docente/periodos")
      .then(res => res.json())
      .then(data => {
        if (data.periods) {
          setPeriods(data.periods);
          const p = searchParams.get("periodo");
          if (!p && data.periods.length > 0) {
            const firstActive = data.periods.find((x: any) => x.active);
            if (firstActive) setPeriod(firstActive.name);
          }
        }
      })
      .catch(() => console.error("Failed to load periods"));

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
  }, [searchParams]);

  useEffect(() => {
    const p = searchParams.get("periodo");
    if (p) {
      setPeriod(p);
      setIsPeriodLocked(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("dueDate", dueDate);
    formData.append("courseId", courseId);
    if (theme) formData.append("theme", theme);
    if (period) formData.append("period", period);
    formData.append("weight", weight);
    if (duration) formData.append("duration", duration);
    formData.append("groupIds", JSON.stringify(groupIds));
    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/docente/tareas", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/docente/contenido");
        router.refresh();
      } else {
        setError(data.error || "Error al crear la tarea");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/docente/contenido" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nueva Tarea</h1>
          <p className="text-muted text-sm">Crea una nueva asignación para tus estudiantes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="courseId">Curso</label>
          {isCourseLocked ? (
            <select
              id="courseId"
              className="input-field bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
              value={courseId}
              disabled
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <select 
              id="courseId" 
              className="input-field"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="" disabled>Selecciona un curso</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

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
              {gradeGroups.map(g => g.id).every(id => groupIds.includes(id)) 
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
            {isPeriodLocked ? (
              <input
                id="period"
                type="text"
                className="input-field bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                value={period}
                disabled
              />
            ) : (
              <select
                id="period"
                className="input-field"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
              >
                <option value="" disabled>Selecciona periodo</option>
                {periods.filter(p => p.active).map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            )}
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

        <div className="input-group">
          <label className="block text-sm font-medium mb-2">Archivo Adjunto / Guía de Apoyo (Opcional)</label>
          <label htmlFor="task-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
            <UploadCloud size={32} className="mx-auto mb-2" style={{ color: "var(--primary-color)" }} />
            <p className="text-sm font-medium">{file ? file.name : "Haz clic para seleccionar un archivo"}</p>
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
            Guardar Tarea
          </button>
        </div>
      </form>
    </div>
  );
}
