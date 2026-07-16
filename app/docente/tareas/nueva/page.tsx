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
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("0");
  const [duration, setDuration] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [type, setType] = useState("TASK");
  const [isExternal, setIsExternal] = useState(false);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<{id: string, name: string, active: boolean}[]>([]);
  const [allResources, setAllResources] = useState<{id: string, title: string, type: string}[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [courseThemes, setCourseThemes] = useState<{id: string, title: string}[]>([]);

  const [isPeriodLocked, setIsPeriodLocked] = useState(false);
  const [isCourseLocked, setIsCourseLocked] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    if (!courseId) {
      setCourseThemes([]);
      return;
    }
    fetch(`/api/docente/temas?courseId=${courseId}`)
      .then(res => res.json())
      .then(data => {
        if (data.themes) setCourseThemes(data.themes);
      })
      .catch(() => console.error("Failed to load themes for course"));
  }, [courseId]);

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

  useEffect(() => {
    if (!courseId) {
      setAllResources([]);
      return;
    }
    fetch(`/api/docente/recursos?courseId=${courseId}`)
      .then(res => res.json())
      .then(data => {
        if (data.resources) setAllResources(data.resources);
      })
      .catch(() => console.error("Failed to load resources for course"));
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("dueDate", dueDate);
    formData.append("courseId", courseId);
    formData.append("theme", JSON.stringify(selectedThemes));
    if (period) formData.append("period", period);
    formData.append("weight", weight);
    if (duration) formData.append("duration", duration);
    formData.append("groupIds", JSON.stringify(groupIds));
    formData.append("resourceIds", JSON.stringify(selectedResourceIds));
    formData.append("type", type);
    formData.append("isExternal", String(isExternal));
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
              className="text-xs font-bold text-[#f98012] hover:underline"
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
                    className="rounded text-[#f98012] focus:ring-[#f98012]"
                  />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Vincular con Recursos/Guías */}
        <div className="border-l-4 border-[#f97316] bg-orange-50 dark:bg-orange-900/10 rounded-r-lg p-4">
          <label className="font-bold text-xs mb-2 flex items-center gap-1.5 text-[#f97316]">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Vincular con Recurso o Guía (Opcional)
          </label>
          {allResources.length === 0 ? (
            <div className="text-center py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No hay recursos creados para esta asignatura.{" "}
                <a href="/docente/contenido" target="_blank" className="text-[#f97316] hover:underline font-bold">
                  Ir a Gestión Contenido
                </a>{" "}
                para agregar materiales.
              </p>
            </div>
          ) : (
            <div className="border border-orange-200 dark:border-orange-800 rounded-lg max-h-[150px] overflow-y-auto flex flex-col divide-y divide-orange-100 dark:divide-orange-900/30 bg-white dark:bg-gray-900">
              {allResources.filter(r => r.type !== 'THEME').map(r => {
                const isChecked = selectedResourceIds.includes(r.id);
                const typeLabel = r.type === "GUIDE" ? "Guía" : r.type === "VIDEO" ? "Video" : r.type === "LINK" ? "Enlace" : r.type;
                return (
                  <label key={r.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors ${ isChecked ? "bg-orange-50 dark:bg-orange-900/10" : "" }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const newIds = isChecked
                          ? selectedResourceIds.filter(id => id !== r.id)
                          : [...selectedResourceIds, r.id];
                        setSelectedResourceIds(newIds);
                      }}
                      className="w-3.5 h-3.5 rounded text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="text-xs font-semibold flex-1 truncate">{r.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">{typeLabel}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className="input-group flex-1">
            <label className="font-semibold text-xs mb-1.5 block">Temas Asociados</label>
            <div className="border rounded-lg p-2.5 max-h-[120px] overflow-y-auto flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
              {[...courseThemes].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })).map(t => {
                const isChecked = selectedThemes.includes(t.title);
                return (
                  <label key={t.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const newThemes = isChecked
                          ? selectedThemes.filter(title => title !== t.title)
                          : [...selectedThemes, t.title];
                        setSelectedThemes(newThemes);
                      }}
                      className="rounded text-[#f98012] focus:ring-[#f98012]"
                    />
                    <span>{t.title}</span>
                  </label>
                );
              })}
              {courseThemes.length === 0 && <span className="text-xs text-muted italic">No hay temas creados en esta asignatura.</span>}
            </div>
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

        <div className="flex gap-4">
          <div className="input-group flex-1">
            <label htmlFor="type">Tipo *</label>
            <select
              id="type"
              className="input-field"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              <option value="TASK">Tarea (Hacer)</option>
              <option value="EXAM">Examen (Saber)</option>
            </select>
          </div>
          <div className="input-group flex-1 flex items-center gap-2 pt-6">
            <input
              id="isExternal"
              type="checkbox"
              className="w-4 h-4 rounded text-[#f98012] focus:ring-[#f98012]"
              style={{ cursor: "pointer" }}
              checked={isExternal}
              onChange={(e) => setIsExternal(e.target.checked)}
            />
            <label htmlFor="isExternal" className="font-semibold text-sm cursor-pointer select-none">
              Trabajo fuera de la plataforma (Calificación manual)
            </label>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="title">Título de la Tarea / Examen</label>
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
            <label htmlFor="dueDate">{isExternal ? "Fecha y Hora Límite (Opcional)" : "Fecha y Hora Límite *"}</label>
            <input
              id="dueDate"
              type="datetime-local"
              className="input-field"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required={!isExternal}
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
