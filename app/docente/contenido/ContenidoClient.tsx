"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Edit2, Trash2, FileText, ClipboardList, BookOpen, 
  UploadCloud, X, Save, Loader2, ExternalLink, Eye
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import Link from "next/link";


interface Group {
  id: string;
  name: string;
  grade: {
    name: string;
  };
}

interface Resource {
  id: string;
  title: string;
  type: string;
  url: string;
  theme?: string | null;
  period?: string | null;
  active?: boolean;
  publishAt?: string | null;
  groups: Group[];
  gdriveEmail?: string | null;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  attachmentUrl?: string | null;
  theme?: string | null;
  weight?: number | null;
  period?: string | null;
  active?: boolean;
  publishAt?: string | null;
  allowLateSubmission?: boolean;
  lateSubmissionUntil?: string | null;
  groups: Group[];
  gdriveEmail?: string | null;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  period1Active?: boolean;
  period2Active?: boolean;
  period3Active?: boolean;
  period4Active?: boolean;
  groups: Group[];
  resources: Resource[];
  tasks: Task[];
}

interface Period {
  id: string;
  name: string;
  active: boolean;
}

interface ContenidoClientProps {
  courses: Course[];
  initialPeriods: Period[];
}

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default function ContenidoClient({ courses, initialPeriods }: ContenidoClientProps) {
  const router = useRouter();
  const confirm = useConfirm();
  
  const [activeTab, setActiveTab] = useState<"tareas" | "materiales">("tareas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [activePeriodTab, setActivePeriodTab] = useState(initialPeriods[0]?.name || "Periodo 1");

  // Periods CRUD modals state
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodForm, setPeriodForm] = useState({ name: "" });

  const handleCreateOrUpdatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!periodForm.name || periodForm.name.trim() === "") {
      setError("El nombre es obligatorio");
      setLoading(false);
      return;
    }

    try {
      const url = "/api/docente/periodos";
      const method = editingPeriod ? "PATCH" : "POST";
      const body = editingPeriod 
        ? JSON.stringify({ id: editingPeriod.id, name: periodForm.name }) 
        : JSON.stringify({ name: periodForm.name });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body
      });
      const data = await res.json();
      if (res.ok) {
        setShowPeriodModal(false);
        // Refresh periods list
        const freshRes = await fetch("/api/docente/periodos");
        const freshData = await freshRes.json();
        if (freshData.periods) {
          setPeriods(freshData.periods);
          if (!editingPeriod) {
            setActivePeriodTab(periodForm.name.trim());
          } else if (activePeriodTab === editingPeriod.name) {
            setActivePeriodTab(periodForm.name.trim());
          }
        }
        router.refresh();
      } else {
        setError(data.error || "Error al guardar el periodo");
      }
    } catch {
      setError("Error de conexión al guardar el periodo");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePeriodActive = async (period: Period) => {
    const newVal = !period.active;
    try {
      const res = await fetch("/api/docente/periodos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id, active: newVal })
      });
      if (res.ok) {
        const freshRes = await fetch("/api/docente/periodos");
        const freshData = await freshRes.json();
        if (freshData.periods) {
          setPeriods(freshData.periods);
        }
        router.refresh();
      }
    } catch {
      console.error("Failed to toggle period status");
    }
  };

  const handleDeletePeriod = async (period: Period) => {
    const ok = await confirm({
      title: "Eliminar Periodo",
      message: `¿Estás seguro de que deseas eliminar el "${period.name}"? Todas las tareas y recursos de este periodo perderán su asignación.`,
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/docente/periodos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: period.id })
      });
      if (res.ok) {
        const freshRes = await fetch("/api/docente/periodos");
        const freshData = await freshRes.json();
        if (freshData.periods) {
          setPeriods(freshData.periods);
          if (activePeriodTab === period.name) {
            setActivePeriodTab(freshData.periods[0]?.name || "Periodo 1");
          }
        }
        router.refresh();
      }
    } catch {
      console.error("Failed to delete period");
    }
  };

  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const hasFiltersApplied = selectedTheme !== "" || selectedPeriod !== "";

  // Extract all unique non-null themes and periods across all tasks in all courses
  const allTasks = courses.flatMap(c => c.tasks);
  const uniqueThemes = Array.from(new Set(allTasks.map(t => t.theme).filter(Boolean))) as string[];
  const uniquePeriods = periods.map(p => p.name);

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    courseId: "",
    title: "",
    description: "",
    dueDate: "",
    theme: "",
    period: periods[0]?.name || "Periodo 1",
    weight: 0,
    allowLateSubmission: false,
    lateSubmissionUntil: "",
    groupIds: [] as string[],
    publishAt: ""
  });
  const [taskFile, setTaskFile] = useState<File | null>(null);

  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState({
    courseId: "",
    title: "",
    type: "PDF",
    link: "",
    theme: "",
    period: periods[0]?.name || "Periodo 1",
    groupIds: [] as string[],
    publishAt: ""
  });
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  // Available groups for selection based on selected course
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);

  // Update available groups when course changes in forms
  useEffect(() => {
    const selectedCourseId = activeTab === "tareas" ? taskForm.courseId : resourceForm.courseId;
    if (selectedCourseId) {
      const course = courses.find(c => c.id === selectedCourseId);
      setAvailableGroups(course ? course.groups : []);
    } else {
      setAvailableGroups([]);
    }
  }, [taskForm.courseId, resourceForm.courseId, activeTab, courses]);

  // Tasks actions
  const openNewTaskModal = (courseId?: string, periodName?: string) => {
    setError("");
    setEditingTask(null);
    setTaskForm({
      courseId: courseId || courses[0]?.id || "",
      title: "",
      description: "",
      dueDate: "",
      theme: "",
      period: periodName || periods[0]?.name || "Periodo 1",
      weight: 0,
      allowLateSubmission: false,
      lateSubmissionUntil: "",
      groupIds: [],
      publishAt: ""
    });
    setTaskFile(null);
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: Task, courseId: string) => {
    setError("");
    setEditingTask(task);
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
    const formattedDueDate = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "";
    const formattedLateUntil = task.lateSubmissionUntil ? new Date(task.lateSubmissionUntil).toISOString().slice(0, 16) : "";
    const formattedPublishAt = task.publishAt ? new Date(task.publishAt).toISOString().slice(0, 16) : "";

    setTaskForm({
      courseId,
      title: task.title,
      description: task.description || "",
      dueDate: formattedDueDate,
      theme: task.theme || "",
      period: task.period || "Periodo 1",
      weight: task.weight || 0,
      allowLateSubmission: task.allowLateSubmission || false,
      lateSubmissionUntil: formattedLateUntil,
      groupIds: task.groups.map(g => g.id),
      publishAt: formattedPublishAt
    });
    setTaskFile(null);
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (taskForm.groupIds.length === 0) {
      setError("Debes seleccionar al menos un grupo.");
      setLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append("courseId", taskForm.courseId);
    fd.append("title", taskForm.title);
    fd.append("description", taskForm.description);
    fd.append("dueDate", new Date(taskForm.dueDate).toISOString());
    fd.append("theme", taskForm.theme);
    fd.append("period", taskForm.period);
    fd.append("weight", taskForm.weight.toString());
    fd.append("allowLateSubmission", taskForm.allowLateSubmission ? "true" : "false");
    if (taskForm.allowLateSubmission && taskForm.lateSubmissionUntil) {
      fd.append("lateSubmissionUntil", new Date(taskForm.lateSubmissionUntil).toISOString());
    }
    fd.append("groupIds", JSON.stringify(taskForm.groupIds));
    if (taskForm.publishAt) {
      fd.append("publishAt", new Date(taskForm.publishAt).toISOString());
    } else {
      fd.append("publishAt", "");
    }
    if (taskFile) fd.append("file", taskFile);

    try {
      const url = editingTask ? `/api/docente/tareas/${editingTask.id}` : "/api/docente/tareas";
      const method = editingTask ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (res.ok) {
        setShowTaskModal(false);
        router.refresh();
      } else {
        setError(data.error || "Error al guardar la tarea");
      }
    } catch {
      setError("Error de conexión al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar Tarea",
      message: "¿Eliminar esta tarea y todas sus entregas/calificaciones asociadas?",
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/docente/tareas/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Error al eliminar la tarea");
      }
    } catch {
      console.error("Failed to delete task");
    }
  };

  const toggleTaskActive = async (task: Task) => {
    const newVal = task.active !== false ? false : true;
    try {
      await fetch(`/api/docente/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newVal })
      });
      router.refresh();
    } catch {
      console.error("Failed to toggle task status");
    }
  };

  // Resources actions
  const openNewResourceModal = (courseId?: string, periodName?: string) => {
    setError("");
    setEditingResource(null);
    setResourceForm({
      courseId: courseId || courses[0]?.id || "",
      title: "",
      type: "PDF",
      link: "",
      theme: "",
      period: periodName || periods[0]?.name || "Periodo 1",
      groupIds: [],
      publishAt: ""
    });
    setResourceFile(null);
    setShowResourceModal(true);
  };

  const openEditResourceModal = (resource: Resource, courseId: string) => {
    setError("");
    setEditingResource(resource);
    const formattedPublishAt = resource.publishAt ? new Date(resource.publishAt).toISOString().slice(0, 16) : "";
    setResourceForm({
      courseId,
      title: resource.title,
      type: resource.type,
      link: resource.type === "LINK" ? resource.url : "",
      theme: resource.theme || "",
      period: resource.period || "Periodo 1",
      groupIds: resource.groups.map(g => g.id),
      publishAt: formattedPublishAt
    });
    setResourceFile(null);
    setShowResourceModal(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (resourceForm.groupIds.length === 0) {
      setError("Debes seleccionar al menos un grupo.");
      setLoading(false);
      return;
    }

    const fd = new FormData();
    if (editingResource) {
      fd.append("id", editingResource.id);
    } else {
      fd.append("courseId", resourceForm.courseId);
    }
    fd.append("title", resourceForm.title);
    fd.append("type", resourceForm.type);
    fd.append("period", resourceForm.period);
    fd.append("theme", resourceForm.theme);
    if (resourceForm.type === "LINK") {
      fd.append("link", resourceForm.link);
    } else if (resourceFile) {
      fd.append("file", resourceFile);
    }
    fd.append("groupIds", JSON.stringify(resourceForm.groupIds));
    if (resourceForm.publishAt) {
      fd.append("publishAt", new Date(resourceForm.publishAt).toISOString());
    } else {
      fd.append("publishAt", "");
    }

    try {
      const url = "/api/docente/recursos";
      const method = editingResource ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (res.ok) {
        setShowResourceModal(false);
        router.refresh();
      } else {
        setError(data.error || "Error al guardar el recurso");
      }
    } catch {
      setError("Error de conexión al guardar el recurso");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar Material",
      message: "¿Estás seguro de que deseas eliminar este material de clase?",
      confirmText: "Eliminar",
      type: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/docente/recursos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Error al eliminar el recurso");
      }
    } catch {
      console.error("Failed to delete resource");
    }
  };

  const toggleResourceActive = async (resource: Resource) => {
    const newVal = resource.active !== false ? false : true;
    try {
      await fetch("/api/docente/recursos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resource.id, active: newVal })
      });
      router.refresh();
    } catch {
      console.error("Failed to toggle resource status");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-base">
      
      {/* Tabs */}
      <div className="flex gap-4 border-b pb-1" style={{ borderColor: "var(--border-color)" }}>
        <button
          onClick={() => setActiveTab("tareas")}
          className={`pb-3 px-2 font-bold text-sm md:text-base border-b-2 transition-all ${
            activeTab === "tareas" 
              ? "border-blue-600 text-blue-600 font-extrabold" 
              : "border-transparent text-muted hover:text-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <ClipboardList size={18} />
            Gestión de Tareas
          </span>
        </button>
        <button
          onClick={() => setActiveTab("materiales")}
          className={`pb-3 px-2 font-bold text-sm md:text-base border-b-2 transition-all ${
            activeTab === "materiales" 
              ? "border-blue-600 text-blue-600 font-extrabold" 
              : "border-transparent text-muted hover:text-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText size={18} />
            Gestión de Materiales
          </span>
        </button>

      </div>

      {courses.length === 0 ? (
        <div className="card text-center py-16 text-muted">
          <BookOpen size={56} className="mx-auto mb-4 opacity-35" />
          <p className="font-semibold text-lg">No tienes asignaturas activas.</p>
          <p className="text-sm mt-1">Crea una asignatura en la sección &quot;Mis Asignaturas&quot; para empezar a gestionar contenido.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Header Action Row */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h3 className="font-bold text-base md:text-lg">
              {activeTab === "tareas" ? "Tareas y Evaluaciones Asignadas" : "Materiales de Clase Compartidos"}
            </h3>
            <button
              onClick={() => activeTab === "tareas" ? openNewTaskModal() : openNewResourceModal()}
              className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              <Plus size={18} />
              {activeTab === "tareas" ? "Nueva Tarea" : "Subir Material"}
            </button>
          </div>

          {/* List and Tables */}
          {activeTab === "tareas" && (
            <div className="flex flex-col gap-6">
              {/* Global Filter Toolbar */}
              {allTasks.length > 0 && (uniqueThemes.length > 0 || uniquePeriods.length > 0) && (
                <div className="card p-4 flex flex-wrap gap-4 items-center mb-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <span className="font-semibold text-sm text-muted">Filtrar Tareas:</span>
                  {uniqueThemes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted font-medium">Tema:</label>
                      <select 
                        className="input-field py-1 px-3 text-xs h-auto" 
                        value={selectedTheme} 
                        onChange={e => setSelectedTheme(e.target.value)}
                        style={{ width: "160px" }}
                      >
                        <option value="">Todos los temas</option>
                        {uniqueThemes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                  {uniquePeriods.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted font-medium">Periodo:</label>
                      <select 
                        className="input-field py-1 px-3 text-xs h-auto" 
                        value={selectedPeriod} 
                        onChange={e => setSelectedPeriod(e.target.value)}
                        style={{ width: "160px" }}
                      >
                        <option value="">Todos los periodos</option>
                        {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {courses.map(course => {
                // Filter tasks of the course client-side
                const filteredTasks = course.tasks.filter(task => {
                  const matchTheme = !selectedTheme || task.theme === selectedTheme;
                  const matchPeriod = !selectedPeriod || task.period === selectedPeriod;
                  return matchTheme && matchPeriod;
                });

                if (hasFiltersApplied && filteredTasks.length === 0) return null;

                return (
                  <div key={course.id} className="card w-full">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <ClipboardList className="text-blue-600" />
                      {course.name}
                    </h2>
                    
                    <div className="flex flex-col gap-5">
                      {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4", "Otros"].map(periodName => {
                        const periodTasks = filteredTasks.filter(t => {
                          if (periodName === "Otros") {
                            return !t.period || !["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].includes(t.period);
                          }
                          return t.period === periodName;
                        });

                        if (periodName === "Otros" && periodTasks.length === 0) return null;

                        const isPeriodActive = periodName === "Otros" || (() => {
                          const p = periods.find(p => p.name.toLowerCase() === periodName.toLowerCase());
                          return p ? p.active : true;
                        })();

                        return (
                          <div key={periodName} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', opacity: isPeriodActive ? 1 : 0.6 }}>
                            <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isPeriodActive ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                                {periodName}
                              </span>
                              <div className="flex items-center gap-2">
                                {!isPeriodActive && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">Oculto para Alumnos</span>}
                                {periodName !== "Otros" && (
                                  <button
                                    onClick={() => openNewTaskModal(course.id, periodName)}
                                    className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Crear Tarea
                                  </button>
                                )}
                              </div>
                            </h4>
                            
                            {periodTasks.length === 0 ? (
                              <p className="text-muted text-xs italic p-2">No hay tareas creadas en este periodo.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" style={{ borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                      <th className="py-2 px-4 font-medium text-xs">Título</th>
                                      <th className="py-2 px-4 font-medium text-xs">Grado</th>
                                      <th className="py-2 px-4 font-medium text-xs">Grupo</th>
                                      <th className="py-2 px-4 font-medium text-xs">Tema</th>
                                      <th className="py-2 px-4 font-medium text-xs">Porcentaje</th>
                                      <th className="py-2 px-4 font-medium text-xs">Fecha Límite</th>
                                      <th className="py-2.5 px-4 font-bold text-center text-xs">Estado</th>
                                      <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periodTasks.map(task => (
                                      <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <td className="py-3 px-4 font-semibold text-sm text-slate-800">
                                          <div className="flex flex-col gap-0.5">
                                            <span>{task.title}</span>
                                            {task.gdriveEmail && (
                                              <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5" title="Cuenta de Google Drive de almacenamiento">
                                                ☁️ {task.gdriveEmail}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{task.groups?.[0]?.grade?.name || "Sin Grado"}</td>
                                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{task.groups?.map(g => g.name).join(", ") || "Sin Grupo"}</td>
                                        <td className="py-3 px-4">
                                          {task.theme ? (
                                            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
                                              {task.theme}
                                            </span>
                                          ) : (
                                            <span className="text-xs text-muted italic">-</span>
                                          )}
                                        </td>
                                        <td className="py-3 px-4">
                                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                            {task.weight !== undefined && task.weight !== null ? task.weight : 0}%
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-muted text-sm">
                                          {new Date(task.dueDate).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                           <div className="flex flex-col items-center justify-center gap-1">
                                             <button
                                               type="button"
                                               onClick={() => toggleTaskActive(task)}
                                               className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
                                               style={{
                                                 width: "42px",
                                                 height: "22px",
                                                 borderRadius: "9999px",
                                                 background: task.active !== false ? "var(--success, #10b981)" : "#cbd5e1",
                                                 border: "none",
                                                 padding: 0,
                                                 outline: "none"
                                               }}
                                               title={task.active !== false ? "Visible para alumnos (Click para ocultar)" : "Oculto para alumnos (Click para mostrar)"}
                                             >
                                               <span
                                                 className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                                                 style={{
                                                   width: "18px",
                                                   height: "18px",
                                                   transform: task.active !== false ? "translateX(22px)" : "translateX(2px)",
                                                   boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                                 }}
                                               />
                                             </button>
                                             {task.active !== false && task.publishAt && new Date(task.publishAt) > new Date() && (
                                               <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50" title={`Se publicará el ${new Date(task.publishAt).toLocaleString()}`}>
                                                 Programada
                                               </span>
                                             )}
                                           </div>
                                         </td>
                                        <td className="py-3 px-4 text-right">
                                          <div className="flex justify-end gap-2">
                                            {task.attachmentUrl && (
                                              <a
                                                href={task.attachmentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                                                title="Ver enlace/archivo adjunto"
                                              >
                                                <ExternalLink size={12} /> Guía
                                              </a>
                                            )}
                                            <Link
                                              href={`/docente/tareas/${task.id}`}
                                              className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                                            >
                                              <Eye size={12} /> Ver/Calificar
                                            </Link>
                                            <button
                                              onClick={() => openEditTaskModal(task, course.id)}
                                              className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                                              style={{ color: "var(--primary-color)" }}
                                            >
                                              <Edit2 size={12} /> Editar
                                            </button>
                                            <button
                                              onClick={() => handleDeleteTask(task.id)}
                                              className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                                              style={{ color: "var(--danger)" }}
                                            >
                                              <Trash2 size={12} /> Eliminar
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {courses.every(c => c.tasks.length === 0) && (
                <div className="card text-center py-12 text-muted">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No has creado ninguna tarea aún.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "materiales" && (
            <div className="flex flex-col gap-6">
              {courses.map(course => {
                return (
                  <div key={course.id} className="card w-full">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <BookOpen className="text-blue-600" />
                      {course.name}
                    </h2>
                    
                    <div className="flex flex-col gap-5">
                      {[...periods.map(p => p.name), "Otros"].map(periodName => {
                        const periodResources = course.resources.filter(r => {
                          if (periodName === "Otros") {
                            return !r.period || !periods.map(p => p.name).includes(r.period);
                          }
                          return r.period === periodName;
                        });

                        if (periodName === "Otros" && periodResources.length === 0) return null;

                        const isPeriodActive = periodName === "Otros" || (() => {
                          const p = periods.find(p => p.name === periodName);
                          return p ? p.active : true;
                        })();

                        return (
                          <div key={periodName} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', opacity: isPeriodActive ? 1 : 0.6 }}>
                            <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isPeriodActive ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                                {periodName}
                              </span>
                              <div className="flex items-center gap-2">
                                {!isPeriodActive && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">Oculto para Alumnos</span>}
                                {periodName !== "Otros" && (
                                  <button
                                    onClick={() => openNewResourceModal(course.id, periodName)}
                                    className="btn btn-primary py-1 px-2.5 text-[11px] h-auto flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Subir Material
                                  </button>
                                )}
                              </div>
                            </h4>
                            
                            {periodResources.length === 0 ? (
                              <p className="text-muted text-xs italic p-2">No hay materiales de clase compartidos en este periodo.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" style={{ borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                      <th className="py-2 px-4 font-medium text-xs">Título</th>
                                      <th className="py-2 px-4 font-medium text-xs">Tipo</th>
                                      <th className="py-2 px-4 font-medium text-xs">Grado</th>
                                      <th className="py-2 px-4 font-medium text-xs">Grupo</th>
                                      <th className="py-2 px-4 font-medium text-xs">Tema</th>
                                      <th className="py-2.5 px-4 font-bold text-center text-xs">Estado</th>
                                      <th className="py-2 px-4 font-medium text-xs text-right">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periodResources.map(res => (
                                      <tr key={res.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <td className="py-3 px-4 font-semibold text-sm text-slate-800">
                                          <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                              <span>{TYPE_ICONS[res.type] || "📁"}</span>
                                              <span>{res.title}</span>
                                            </div>
                                            {res.gdriveEmail && (
                                              <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5" title="Cuenta de Google Drive de almacenamiento">
                                                ☁️ {res.gdriveEmail}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs font-semibold text-slate-650">{res.type}</td>
                                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                                          {Array.from(new Set(res.groups.map(g => g.grade?.name))).filter(Boolean).join(", ") || "Sin Grado"}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                                          {res.groups.map(g => g.name).join(", ") || "Sin Grupo"}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500 font-semibold">{res.theme || "-"}</td>
                                        <td className="py-3 px-4 text-center">
                                           <div className="flex flex-col items-center justify-center gap-1">
                                             <button
                                               type="button"
                                               onClick={() => toggleResourceActive(res)}
                                               className="relative inline-flex items-center cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none"
                                               style={{
                                                 width: "42px",
                                                 height: "22px",
                                                 borderRadius: "9999px",
                                                 background: res.active !== false ? "var(--success, #10b981)" : "#cbd5e1",
                                                 border: "none",
                                                 padding: 0,
                                                 outline: "none"
                                               }}
                                               title={res.active !== false ? "Visible para alumnos (Click para ocultar)" : "Oculto para alumnos (Click para mostrar)"}
                                             >
                                               <span
                                                 className="pointer-events-none inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                                                 style={{
                                                   width: "18px",
                                                   height: "18px",
                                                   transform: res.active !== false ? "translateX(22px)" : "translateX(2px)",
                                                   boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                                 }}
                                               />
                                             </button>
                                             {res.active !== false && res.publishAt && new Date(res.publishAt) > new Date() && (
                                               <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50" title={`Se publicará el ${new Date(res.publishAt).toLocaleString()}`}>
                                                 Programado
                                               </span>
                                             )}
                                           </div>
                                         </td>
                                        <td className="py-3 px-4 text-right">
                                          <div className="flex justify-end gap-2">
                                            <a href={res.url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Ver enlace/archivo">
                                              <ExternalLink size={16} />
                                            </a>
                                            <button
                                              onClick={() => openEditResourceModal(res, course.id)}
                                              className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                                              title="Editar"
                                            >
                                              <Edit2 size={16} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteResource(res.id)}
                                              className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                                              title="Eliminar"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {courses.every(c => c.resources.length === 0) && (
                <div className="card text-center py-12 text-muted">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No has subido ningún material aún.</p>
                </div>
              )}
            </div>
          )}


        </div>
      )}

      {/* Task Modal (Create & Edit) */}
      {showTaskModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowTaskModal(false)}>
          <form onSubmit={handleSaveTask} className="card w-full max-w-lg animate-fade-in" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingTask ? "Editar Tarea" : "Nueva Tarea"}</h2>
              <button type="button" onClick={() => setShowTaskModal(false)} className="p-1 rounded hover:bg-slate-150"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4 text-xs font-bold">{error}</div>}

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Asignatura *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={taskForm.courseId} 
                  onChange={e => setTaskForm({ ...taskForm, courseId: e.target.value })} required>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Periodo *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={taskForm.period} 
                  onChange={e => setTaskForm({ ...taskForm, period: e.target.value })} required>
                  {periods.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {taskForm.period && !periods.find(p => p.name === taskForm.period)?.active && (
                    <option value={taskForm.period}>{taskForm.period}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Título de la Tarea *</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs" placeholder="Ej. Taller de cinemática"
                  value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required />
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Tema *</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs" placeholder="Ej. Dinámica, Termodinámica"
                  value={taskForm.theme} onChange={e => setTaskForm({ ...taskForm, theme: e.target.value })} required />
              </div>
            </div>

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Porcentaje de la Nota (0-100) *</label>
                <input type="number" className="input-field py-1.5 px-3 text-xs" min="0" max="100"
                  value={taskForm.weight} onChange={e => setTaskForm({ ...taskForm, weight: parseInt(e.target.value, 10) || 0 })} required />
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Fecha Límite de Entrega *</label>
                <input type="datetime-local" className="input-field py-1.5 px-3 text-xs"
                  value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} required />
              </div>
            </div>

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Programar Publicación Automática (Fecha y Hora - Opcional)</label>
              <input type="datetime-local" className="input-field py-1.5 px-3 text-xs"
                value={taskForm.publishAt} onChange={e => setTaskForm({ ...taskForm, publishAt: e.target.value })} />
              <p className="text-[10px] text-muted mt-1">Dejar vacío para publicar inmediatamente. Si se define, la tarea se publicará automáticamente al llegar el momento.</p>
            </div>

            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 mb-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskForm.allowLateSubmission}
                  onChange={e => setTaskForm({ ...taskForm, allowLateSubmission: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Permitir entregas tardías (Prórroga)</span>
              </label>

              {taskForm.allowLateSubmission && (
                <div className="input-group mt-2">
                  <label className="text-[10px] font-bold mb-1">Fecha límite de prórroga *</label>
                  <input type="datetime-local" className="input-field py-1 px-2 text-xs"
                    value={taskForm.lateSubmissionUntil} onChange={e => setTaskForm({ ...taskForm, lateSubmissionUntil: e.target.value })} required />
                </div>
              )}
            </div>

            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Asignar a Grupos (Múltiple) *</label>
              <div className="border rounded-lg p-2.5 max-h-[120px] overflow-y-auto flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
                {availableGroups.map(g => {
                  const isChecked = taskForm.groupIds.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-primary">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? taskForm.groupIds.filter(id => id !== g.id)
                            : [...taskForm.groupIds, g.id];
                          setTaskForm({ ...taskForm, groupIds: newIds });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{g.grade.name} - {g.name}</span>
                    </label>
                  );
                })}
                {availableGroups.length === 0 && <span className="text-xs text-muted italic">Selecciona una asignatura para cargar los grupos.</span>}
              </div>
            </div>

            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Descripción de la Tarea</label>
              <textarea className="input-field py-1.5 px-3 text-xs h-20" placeholder="Escribe las instrucciones aquí..."
                value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold mb-1.5">{editingTask ? "Nuevo Archivo Adjunto (Opcional)" : "Archivo Adjunto (Opcional)"}</label>
              <label htmlFor="task-file" className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                <UploadCloud size={24} className="mx-auto mb-1.5 text-blue-500" />
                <p className="text-xs font-bold">{taskFile ? taskFile.name : "Selecciona una guía o archivo"}</p>
                <input id="task-file" type="file" className="hidden" onChange={e => setTaskFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowTaskModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary text-xs" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingTask ? "Guardar Cambios" : "Crear Tarea"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resource Modal (Create & Edit) */}
      {showResourceModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowResourceModal(false)}>
          <form onSubmit={handleSaveResource} className="card w-full max-w-lg animate-fade-in" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingResource ? "Editar Material" : "Nuevo Material"}</h2>
              <button type="button" onClick={() => setShowResourceModal(false)} className="p-1 rounded hover:bg-slate-150"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4 text-xs font-bold">{error}</div>}

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Asignatura *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.courseId} 
                  onChange={e => setResourceForm({ ...resourceForm, courseId: e.target.value })} required>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Periodo *</label>
                <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.period} 
                  onChange={e => setResourceForm({ ...resourceForm, period: e.target.value })} required>
                  {periods.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {resourceForm.period && !periods.find(p => p.name === resourceForm.period)?.active && (
                    <option value={resourceForm.period}>{resourceForm.period}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Título del Material *</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs" placeholder="Ej. Guía de Álgebra Lineal"
                  value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} required />
              </div>
              <div className="input-group flex-1">
                <label className="text-xs font-bold mb-1">Tema *</label>
                <input type="text" className="input-field py-1.5 px-3 text-xs" placeholder="Ej. Cinemática, Ecuaciones"
                  value={resourceForm.theme} onChange={e => setResourceForm({ ...resourceForm, theme: e.target.value })} required />
              </div>
            </div>

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Tipo de Material *</label>
              <select className="input-field py-1.5 px-3 text-xs" value={resourceForm.type} 
                onChange={e => setResourceForm({ ...resourceForm, type: e.target.value })}>
                <option value="PDF">📄 PDF</option>
                <option value="WORD">📝 Documento Word</option>
                <option value="PPT">📊 Presentación PPT</option>
                <option value="IMAGE">🖼️ Imagen</option>
                <option value="VIDEO">🎬 Video</option>
                <option value="LINK">🔗 Enlace Web</option>
              </select>
            </div>

            <div className="input-group mb-3">
              <label className="text-xs font-bold mb-1">Programar Publicación Automática (Fecha y Hora - Opcional)</label>
              <input type="datetime-local" className="input-field py-1.5 px-3 text-xs"
                value={resourceForm.publishAt} onChange={e => setResourceForm({ ...resourceForm, publishAt: e.target.value })} />
              <p className="text-[10px] text-muted mt-1">Dejar vacío para publicar inmediatamente. Si se define, el material se publicará automáticamente al llegar el momento.</p>
            </div>

            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Asignar a Grupos (Múltiple) *</label>
              <div className="border rounded-lg p-2.5 max-h-[120px] overflow-y-auto flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border-color)' }}>
                {availableGroups.map(g => {
                  const isChecked = resourceForm.groupIds.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-primary">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? resourceForm.groupIds.filter(id => id !== g.id)
                            : [...resourceForm.groupIds, g.id];
                          setResourceForm({ ...resourceForm, groupIds: newIds });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{g.grade.name} - {g.name}</span>
                    </label>
                  );
                })}
                {availableGroups.length === 0 && <span className="text-xs text-muted italic">Selecciona una asignatura para cargar los grupos.</span>}
              </div>
            </div>

            {resourceForm.type === "LINK" ? (
              <div className="input-group mb-4">
                <label className="text-xs font-bold mb-1">Dirección URL *</label>
                <input type="url" className="input-field py-1.5 px-3 text-xs" placeholder="https://ejemplo.com"
                  value={resourceForm.link} onChange={e => setResourceForm({ ...resourceForm, link: e.target.value })} required />
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5">{editingResource ? "Nuevo Archivo (Opcional)" : "Archivo de Recurso *"}</label>
                <label htmlFor="resource-file" className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                  <UploadCloud size={24} className="mx-auto mb-1.5 text-blue-500" />
                  <p className="text-xs font-bold">{resourceFile ? resourceFile.name : "Selecciona un archivo para subir"}</p>
                  <input id="resource-file" type="file" className="hidden" onChange={e => setResourceFile(e.target.files?.[0] || null)} required={!editingResource} />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowResourceModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary text-xs" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingResource ? "Guardar Cambios" : "Subir Material"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Period Modal (Create & Edit) */}
      {showPeriodModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowPeriodModal(false)}>
          <form onSubmit={handleCreateOrUpdatePeriod} className="card w-full max-w-md animate-fade-in" style={{ borderRadius: "1rem" }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingPeriod ? "Editar Periodo" : "Nuevo Periodo"}</h2>
              <button type="button" onClick={() => setShowPeriodModal(false)} className="p-1 rounded hover:bg-slate-150"><X size={20} /></button>
            </div>
            {error && <div className="alert alert-danger mb-4 text-xs font-bold">{error}</div>}

            <div className="input-group mb-4">
              <label className="text-xs font-bold mb-1">Nombre del Periodo *</label>
              <input 
                type="text" 
                className="input-field py-1.5 px-3 text-xs" 
                placeholder="Ej. Periodo 5, Semestre 1"
                value={periodForm.name} 
                onChange={e => setPeriodForm({ name: e.target.value })} 
                required 
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowPeriodModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary text-xs" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingPeriod ? "Guardar Cambios" : "Crear Periodo"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
