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
  const [interactiveFile, setInteractiveFile] = useState<File | null>(null);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("0");
  const [duration, setDuration] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [type, setType] = useState("TASK");
  const [externalUrl, setExternalUrl] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [requiresFolder, setRequiresFolder] = useState(false);
  const [courses, setCourses] = useState<{id: string, name: string, groups: {id: string, name: string, grade?: {name: string}}[]}[]>([]);
  const [gradeGroups, setGradeGroups] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState<{id: string, name: string, active: boolean}[]>([]);
  const [allResources, setAllResources] = useState<{id: string, title: string, type: string}[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [courseThemes, setCourseThemes] = useState<{id: string, title: string}[]>([]);
  const [allStudents, setAllStudents] = useState<{id: string, name: string, groupName?: string, grade?: string, groupId?: string, group?: any}[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

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

  // Derive groups from selected course (only groups belonging to that course)
  useEffect(() => {
    const selectedCourse = courses.find(c => c.id === courseId);
    if (selectedCourse && selectedCourse.groups) {
      const flat = selectedCourse.groups.map(g => ({
        id: g.id,
        name: g.grade?.name ? `${g.grade.name} - ${g.name}` : g.name
      }));
      setGradeGroups(flat);
      // Do NOT auto-select groups — teacher must choose explicitly (one group per task)
      setGroupIds([]);
    } else {
      setGradeGroups([]);
      setGroupIds([]);
    }
  }, [courseId, courses]);

  useEffect(() => {
    // Fetch teacher's courses (includes groups for each course)
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

    // Fetch students
    fetch("/api/docente/estudiantes")
      .then(res => res.json())
      .then(data => {
        if (data.students) setAllStudents(data.students);
      })
      .catch(() => console.error("Failed to load students"));
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

    if (groupIds.length === 0) {
      setError("Debes seleccionar al menos un grupo.");
      return;
    }

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
    formData.append("studentIds", JSON.stringify(selectedStudentIds));
    formData.append("resourceIds", JSON.stringify(selectedResourceIds));
    formData.append("type", type);
    if (externalUrl) {
      formData.append("externalUrl", externalUrl);
    }
    formData.append("isExternal", String(isExternal));
    formData.append("requiresFolder", String(requiresFolder));
    if (file) {
      formData.append("file", file);
    }
    if (interactiveFile) {
      formData.append("interactiveFile", interactiveFile);
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
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-semibold text-xs block">
              Asignar a Grupos *
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setGroupIds(gradeGroups.map(g => g.id))}
                className="text-[#f98012] hover:underline font-medium cursor-pointer"
              >
                Seleccionar todos
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={() => setGroupIds([])}
                className="text-gray-500 hover:underline cursor-pointer"
              >
                Deseleccionar
              </button>
            </div>
          </div>
          <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto flex flex-col gap-2 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
            {gradeGroups.length === 0 ? (
              <p className="text-xs text-muted text-center py-2">
                {courseId ? "No hay grupos disponibles para este curso." : "Selecciona un curso primero."}
              </p>
            ) : (
              gradeGroups.map(g => {
                const isChecked = groupIds.includes(g.id);
                return (
                  <label key={g.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-primary">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGroupIds(prev => [...prev, g.id]);
                        } else {
                          setGroupIds(prev => prev.filter(id => id !== g.id));
                        }
                      }}
                      className="rounded"
                      style={{ accentColor: "#f98012" }}
                    />
                    <span>{g.name}</span>
                  </label>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-muted mt-1">
            Puedes asignar esta actividad a uno o varios grupos del curso simultáneamente.
          </p>
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
                onChange={e => setPeriod(e.target.value)}
                required
              >
                <option value="" disabled>Selecciona periodo</option>
                {(periods.filter(p => p.active).length > 0 ? periods.filter(p => p.active) : periods).map(p => (
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
              onChange={(e) => {
                const val = e.target.value;
                setType(val);
                if (val === "INTERACTIVE") {
                  if (!title) setTitle("Actividad Interactiva");
                  if (!description) setDescription("Completa la actividad interactiva directamente en la plataforma. Tu avance y calificación se registrarán automáticamente.");
                  setExternalUrl("");
                }
              }}
              required
            >
              <option value="TASK">Tarea (Hacer)</option>
              <option value="TASK_SABER">Tarea (Saber)</option>
              <option value="EXAM">Examen (Saber)</option>
              <option value="INTERACTIVE">Actividad Interactiva / Gamificada (Autocalificable)</option>
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

        {type === "INTERACTIVE" && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
              <span className="text-lg">🎮</span>
              <span>Actividad Interactiva con Calificación Automática</span>
            </div>
            <p className="text-xs text-purple-700 leading-relaxed">
              El estudiante completará la actividad directamente en la plataforma. Su avance y calificación (1.0 a 5.0) se sincronizarán en tiempo real con la planilla de notas.
            </p>
            <div className="text-xs text-purple-900 bg-purple-100/70 p-2.5 rounded-lg border border-purple-200 flex items-center gap-2 mt-1">
              <span>📁</span>
              <span>Puedes subir el archivo <strong>.html interactivo</strong> y también una <strong>guía de apoyo (PDF, DOCX)</strong> por separado más abajo.</span>
            </div>
          </div>
        )}

        {!isExternal && type === "TASK" && (
          <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl flex items-start gap-3">
            <input
              id="requiresFolder"
              type="checkbox"
              className="w-4 h-4 mt-0.5 rounded text-[#f98012] focus:ring-[#f98012]"
              style={{ cursor: "pointer" }}
              checked={requiresFolder}
              onChange={(e) => setRequiresFolder(e.target.checked)}
            />
            <div>
              <label htmlFor="requiresFolder" className="font-bold text-sm text-gray-900 cursor-pointer select-none flex items-center gap-1.5">
                📁 La entrega de esta tarea requiere una carpeta completa (Proyecto)
              </label>
              <p className="text-xs text-gray-600 mt-0.5">
                Al activar esta opción, el botón de entrega le abrirá directamente al estudiante la ventana de selección de carpetas sin tener que comprimir nada en ZIP.
              </p>
            </div>
          </div>
        )}

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

        {type === "INTERACTIVE" && (
          <div className="input-group p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <label className="block text-sm font-bold text-purple-900">
              🎮 Archivo HTML Interactivo (.html) *
            </label>
            <p className="text-xs text-purple-700">
              Sube el juego o simulador autocalificable creado en HTML / Canvas.
            </p>
            <label htmlFor="interactive-file" style={{ display: "block", border: "2px dashed #a855f7", borderRadius: "var(--radius-md)", padding: "1.25rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s", background: "white" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#7e22ce")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#a855f7")}>
              <UploadCloud size={28} className="mx-auto mb-1 text-purple-600" />
              <p className="text-sm font-semibold text-purple-900">{interactiveFile ? interactiveFile.name : "Haz clic para seleccionar el archivo .html"}</p>
              <p className="text-xs text-purple-600 mt-0.5">Solo archivos con extensión .html o .htm</p>
              <input id="interactive-file" type="file" accept=".html,.htm" className="hidden" onChange={e => setInteractiveFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        )}

        <div className="input-group">
          <label className="block text-sm font-medium mb-2">
            {type === "INTERACTIVE" ? "Guía de Apoyo o Documento Complementario (Opcional - PDF, DOCX, etc.)" : "Archivo Adjunto / Guía de Apoyo (Opcional)"}
          </label>
          <label htmlFor="task-file" style={{ display: "block", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-color)")}>
            <UploadCloud size={32} className="mx-auto mb-2" style={{ color: "var(--primary-color)" }} />
            <p className="text-sm font-medium">{file ? file.name : (type === "INTERACTIVE" ? "Haz clic para seleccionar la guía de apoyo (Opcional)" : "Haz clic para seleccionar un archivo")}</p>
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
