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
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("0");
  const [duration, setDuration] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [type, setType] = useState("TASK");
  const [isExternal, setIsExternal] = useState(false);
  const [gradeGroups, setGradeGroups] = useState<{id: string, name: string}[]>([]);
  const [allCourses, setAllCourses] = useState<{id: string, name: string, groups: {id: string, name: string, grade?: {name: string}}[]}[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<{id: string, name: string, active: boolean}[]>([]);
  const [courseId, setCourseId] = useState("");
  const [allResources, setAllResources] = useState<{id: string, title: string, type: string}[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [courseThemes, setCourseThemes] = useState<{id: string, title: string}[]>([]);
  const [allStudents, setAllStudents] = useState<{id: string, name: string, groupName?: string, grade?: string, groupId?: string, group?: any}[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

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

  // When courseId changes (set from task data), derive groups from allCourses
  useEffect(() => {
    if (!courseId || allCourses.length === 0) return;
    const course = allCourses.find(c => c.id === courseId);
    if (course?.groups) {
      setGradeGroups(course.groups.map(g => ({
        id: g.id,
        name: g.grade?.name ? `${g.grade.name} - ${g.name}` : g.name
      })));
    }
  }, [courseId, allCourses]);

  useEffect(() => {
    // Fetch teacher's courses (includes groups per course)
    fetch("/api/docente/cursos")
      .then(res => res.json())
      .then(data => { if (data.courses) setAllCourses(data.courses); })
      .catch(() => console.error("Failed to load courses"));

    // Fetch active periods
    fetch("/api/docente/periodos")
      .then(res => res.json())
      .then(data => {
        if (data.periods) setPeriods(data.periods);
      })
      .catch(() => console.error("Failed to load periods"));

    // Fetch students
    fetch("/api/docente/estudiantes")
      .then(res => res.json())
      .then(data => {
        if (data.students) setAllStudents(data.students);
      })
      .catch(() => console.error("Failed to load students"));

    fetch(`/api/docente/tareas/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.task) {
          setTitle(data.task.title);
          setDescription(data.task.description || "");
          setSelectedThemes(data.task.themes ? data.task.themes.map((th: any) => th.title) : (data.task.theme ? [data.task.theme] : []));
          setPeriod(data.task.period || "");
          setWeight(data.task.weight !== undefined ? String(data.task.weight) : "0");
          setDuration(data.task.duration !== null && data.task.duration !== undefined ? String(data.task.duration) : "");
          setGroupIds(data.task.groups ? data.task.groups.map((g: any) => g.id) : []);
          setType(data.task.type || "TASK");
          setIsExternal(data.task.isExternal || false);
          setDueDate(toColombiaISOString(data.task.dueDate));
          setExistingAttachment(data.task.attachmentUrl || null);
          setCourseId(data.task.courseId || "");
          setSelectedResourceIds(data.task.resources ? data.task.resources.map((r: any) => r.id) : []);
          setSelectedStudentIds(data.task.assignedStudents ? data.task.assignedStudents.map((s: any) => s.id) : []);
        } else {
          setError("No se pudo cargar la tarea");
        }
      })
      .catch(() => setError("Error de conexión al cargar la tarea"))
      .finally(() => setFetching(false));
  }, [taskId]);

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
    formData.append("theme", JSON.stringify(selectedThemes));
    if (period) formData.append("period", period);
    formData.append("weight", weight);
    if (duration) formData.append("duration", duration);
    formData.append("groupIds", JSON.stringify(groupIds));
    formData.append("studentIds", JSON.stringify(selectedStudentIds));
    formData.append("resourceIds", JSON.stringify(selectedResourceIds));
    formData.append("type", type);
    formData.append("isExternal", String(isExternal));
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
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#f98012]" size={40} /></div>;
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
              className="text-xs font-bold text-[#f98012] hover:underline"
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
                    className="rounded text-[#f98012] focus:ring-[#f98012]"
                  />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Asignación a Estudiantes Específicos */}
        <div className="input-group">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-semibold flex items-center gap-1.5">
              <span>Estudiantes Específicos</span>
              <span className="text-xs font-normal text-muted">(Opcional: asignación individual adicional)</span>
            </label>
            {selectedStudentIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-xs text-red-500 hover:underline"
              >
                Limpiar ({selectedStudentIds.length} seleccionados)
              </button>
            )}
          </div>
          <input
            type="text"
            className="input-field mb-2 text-sm py-1.5"
            placeholder="Buscar estudiante por nombre..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto flex flex-col gap-2 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
            {groupIds.length === 0 ? (
              <p className="text-xs text-muted text-center py-2">
                Selecciona al menos un grupo arriba para ver y asignar estudiantes.
              </p>
            ) : (() => {
              const filtered = allStudents.filter(s => {
                const belongsToGroup = (s.groupId && groupIds.includes(s.groupId)) || (s.group?.id && groupIds.includes(s.group.id));
                if (!belongsToGroup) return false;
                if (!studentSearch) return true;
                const q = studentSearch.toLowerCase().trim();
                return s.name.toLowerCase().includes(q) || (s.groupName && s.groupName.toLowerCase().includes(q));
              });

              if (filtered.length === 0) {
                return (
                  <p className="text-xs text-muted text-center py-2">
                    No se encontraron estudiantes {studentSearch ? "con esa búsqueda" : "en los grupos seleccionados"}.
                  </p>
                );
              }

              return filtered.map(s => {
                const isChecked = selectedStudentIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center justify-between gap-2 text-sm cursor-pointer hover:text-primary py-0.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? selectedStudentIds.filter(id => id !== s.id)
                            : [...selectedStudentIds, s.id];
                          setSelectedStudentIds(newIds);
                        }}
                        className="rounded text-[#f98012] focus:ring-[#f98012]"
                      />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    {s.groupName && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {s.groupName}
                      </span>
                    )}
                  </label>
                );
              });
            })()}
          </div>
        </div>

        <div className="flex gap-4">
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
              {periods.map(p => (
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
              <option value="TASK_SABER">Tarea (Saber)</option>
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
