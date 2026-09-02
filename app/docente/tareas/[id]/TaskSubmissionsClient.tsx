"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  CheckCircle, Clock, Download, Users, CheckSquare, Square, 
  MinusSquare, Sparkles, X, ShieldAlert, Calendar, Search
} from "lucide-react";
import { useRouter } from "next/navigation";
import StudentLateSubmissionToggle from "./StudentLateSubmissionToggle";
import ResetSubmissionButton from "./ResetSubmissionButton";
import ResetAllSubmissionsButton from "./ResetAllSubmissionsButton";
import GDriveEmailDisplay from "@/components/GDriveEmailDisplay";
import BulkProrrogaModal from "./BulkProrrogaModal";
import { useConfirm } from "@/components/ConfirmProvider";

interface StudentData {
  id: string;
  name: string;
  groupId: string | null;
}

interface SubmissionData {
  id: string;
  studentId: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  fileUrl: string | null;
  submittedAt: string | null;
  allowLateSubmission: boolean;
  lateSubmissionUntil: string | null;
  gdriveEmail: string | null;
}

interface GroupData {
  id: string;
  name: string;
  grade?: { name: string } | null;
}

interface TaskSubmissionsClientProps {
  task: {
    id: string;
    title: string;
    type: string;
    isExternal: boolean;
    period: string | null;
    theme: string | null;
    courseName: string;
    allowLateSubmission: boolean;
  };
  groups: GroupData[];
  students: StudentData[];
  assignedStudentIds?: string[];
  submissions: SubmissionData[];
}

export default function TaskSubmissionsClient({
  task,
  groups,
  students,
  assignedStudentIds = [],
  submissions
}: TaskSubmissionsClientProps) {
  const router = useRouter();
  const confirm = useConfirm();

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filter students by search term
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));

  // Toggle single student selection
  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  // Toggle all students in a specific group
  const handleToggleGroup = (groupStudentIds: string[]) => {
    const allSelected = groupStudentIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !groupStudentIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...groupStudentIds])));
    }
  };

  // Select/Deselect all students globally
  const handleSelectAllGlobal = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  // Quick action: Remove prórroga from selected students
  const handleRemoveProrrogaSelected = async () => {
    if (selectedStudentIds.length === 0) return;

    const shouldProceed = await confirm({
      title: "¿Quitar prórroga?",
      message: `¿Estás seguro de que deseas revocar el permiso de prórroga para los ${selectedStudentIds.length} estudiantes seleccionados? Si la fecha general ya venció, no podrán enviar la tarea.`,
      confirmText: "Sí, quitar prórroga",
      cancelText: "Cancelar",
      type: "warning"
    });

    if (!shouldProceed) return;

    setBulkLoading(true);
    try {
      const res = await fetch(`/api/docente/tareas/${task.id}/prorroga`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          allowLateSubmission: false,
          lateSubmissionUntil: null
        })
      });

      if (res.ok) {
        router.refresh();
        setSelectedStudentIds([]);
      } else {
        await confirm({
          title: "Error",
          message: "No se pudo actualizar la prórroga de los estudiantes seleccionados.",
          confirmText: "Aceptar",
          cancelText: null,
          type: "danger"
        });
      }
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Error de red",
        message: "Hubo un error de conexión al procesar la solicitud.",
        confirmText: "Aceptar",
        cancelText: null,
        type: "danger"
      });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
      {/* Search & Global Selection Toolbar */}
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-2xs no-print">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Buscar estudiante por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-zinc-700 dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f98012]/20 focus:border-[#f98012]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={handleSelectAllGlobal}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
              <>
                <CheckSquare size={14} className="text-[#f98012]" /> Deseleccionar todo ({filteredStudents.length})
              </>
            ) : (
              <>
                <Square size={14} /> Seleccionar todos ({filteredStudents.length})
              </>
            )}
          </button>

          {selectedStudentIds.length > 0 && (
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#f98012] hover:bg-[#e06d09] text-white shadow-xs transition-all flex items-center gap-1.5 animate-fade-in"
            >
              <Calendar size={14} /> Dar Prórroga ({selectedStudentIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Multi-Selection */}
      {selectedStudentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-zinc-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-zinc-700/80 backdrop-blur-md flex items-center gap-4 animate-slide-up no-print max-w-[95vw] sm:max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#f98012] animate-pulse" />
            <span className="text-sm font-semibold whitespace-nowrap">
              <strong>{selectedStudentIds.length}</strong> {selectedStudentIds.length === 1 ? 'estudiante seleccionado' : 'estudiantes seleccionados'}
            </span>
          </div>

          <div className="h-5 w-[1px] bg-zinc-700 hidden sm:block" />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={bulkLoading}
              className="px-3.5 py-1.5 text-xs font-bold bg-[#f98012] hover:bg-[#e06d09] text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar size={14} /> Asignar Prórroga
            </button>

            <button
              type="button"
              onClick={handleRemoveProrrogaSelected}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Quitar permiso de prórroga a los seleccionados"
            >
              <ShieldAlert size={14} /> Quitar Prórroga
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={bulkLoading}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Deseleccionar todos"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tables rendered by group */}
      {groups && groups.length > 0 ? (
        groups.map(group => {
          const groupStudents = filteredStudents.filter(s => s.groupId === group.id);
          const allGroupStudentIds = groupStudents.map(s => s.id);
          const isGroupAllSelected = allGroupStudentIds.length > 0 && allGroupStudentIds.every(id => selectedStudentIds.includes(id));
          const isGroupPartiallySelected = allGroupStudentIds.some(id => selectedStudentIds.includes(id)) && !isGroupAllSelected;

          return (
            <div key={group.id} className="card w-full mb-6">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">
                      Estado de las entregas: Grado {group.grade?.name || "Sin Grado"} - Grupo {group.name}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-muted font-medium">
                      {groupStudents.length} estudiantes
                    </span>
                  </div>

                  {task.type === "EXAM" && (
                    <ResetAllSubmissionsButton
                      taskId={task.id}
                      groupId={group.id}
                      groupName={`${group.grade?.name || ""}-${group.name}`}
                      studentCount={groupStudents.length}
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs mt-1.5 text-muted font-medium no-print">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Periodo: {task.period?.replace(/periodo\s*/i, "") || "Sin Periodo"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Grado: {group.grade?.name || "Sin Grado"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Grupo: {group.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Asignatura: {task.courseName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Tema: {task.theme || "Sin Tema"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Título: {task.title}
                  </span>
                </div>
              </div>

              {groupStudents.length === 0 ? (
                <p className="text-muted text-sm italic p-4 text-center">
                  {searchTerm ? "No hay estudiantes que coincidan con la búsqueda." : "No hay estudiantes registrados en este grupo."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th className="py-2 px-3 w-10 text-center no-print">
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(allGroupStudentIds)}
                            title="Seleccionar / Deseleccionar grupo"
                            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-300 transition-colors"
                          >
                            {isGroupAllSelected ? (
                              <CheckSquare size={16} className="text-[#f98012]" />
                            ) : isGroupPartiallySelected ? (
                              <MinusSquare size={16} className="text-[#f98012]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="py-2 px-4 font-medium">Estudiante</th>
                        <th className="py-2 px-4 font-medium">Estado</th>
                        <th className="py-2 px-4 font-medium text-center">Entrega Tardía</th>
                        <th className="py-2 px-4 font-medium">Fecha de Envío</th>
                        <th className="py-2 px-4 font-medium text-right no-print">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStudents.map(student => {
                        const submission = submissions.find(s => s.studentId === student.id);
                        const isSubmitted = submission && submission.status !== "PENDING";
                        const isGraded = submission && submission.status === "GRADED";
                        const allowLate = submission ? submission.allowLateSubmission : false;
                        const isSelected = selectedStudentIds.includes(student.id);

                        return (
                          <tr 
                            key={student.id} 
                            style={{ borderBottom: '1px solid var(--border-color)' }}
                            className={`transition-colors ${isSelected ? "bg-orange-50/40 dark:bg-orange-950/15" : "hover:bg-gray-50/60 dark:hover:bg-zinc-800/30"}`}
                          >
                            <td className="py-3 px-3 text-center no-print">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectStudent(student.id)}
                                className="w-4 h-4 rounded text-[#f98012] focus:ring-[#f98012]/30 cursor-pointer accent-[#f98012]"
                              />
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-zinc-100">
                              {student.name}
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const isStudentAssigned = assignedStudentIds ? assignedStudentIds.includes(student.id) : false;

                                if (isGraded || (submission && submission.grade != null)) {
                                  return (
                                    <span className="badge badge-success flex w-fit items-center gap-1">
                                      <CheckCircle size={12}/> Calificada: {submission?.grade}
                                    </span>
                                  );
                                }
                                if (!isStudentAssigned) {
                                  return (
                                    <span className="badge badge-danger flex w-fit items-center gap-1 font-semibold">
                                      <ShieldAlert size={12}/> No asistió (1.0)
                                    </span>
                                  );
                                }
                                if (isSubmitted) {
                                  return (
                                    <span className="badge badge-info">Entregada</span>
                                  );
                                }
                                return (
                                  <span className="badge badge-warning flex w-fit items-center gap-1">
                                    <Clock size={12}/> Pendiente
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StudentLateSubmissionToggle
                                taskId={task.id}
                                studentId={student.id}
                                studentName={student.name}
                                initialAllowLate={allowLate}
                                initialLateUntil={submission?.lateSubmissionUntil ? new Date(submission.lateSubmissionUntil).toISOString() : null}
                                disabled={task.allowLateSubmission}
                              />
                            </td>
                            <td className="py-3 px-4 text-muted">
                              {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
                            </td>
                            <td className="py-3 px-4 text-right no-print">
                              {submission ? (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex justify-end gap-2">
                                    {task.type !== "EXAM" && submission.fileUrl && (
                                      <a href={submission.fileUrl} target="_blank" download className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1">
                                        <Download size={14} /> Archivo
                                      </a>
                                    )}
                                    {task.type === "EXAM" && (
                                      <ResetSubmissionButton 
                                        taskId={task.id}
                                        studentId={student.id}
                                        studentName={student.name}
                                        hasSubmission={!!submission}
                                      />
                                    )}
                                    {(task.type !== "EXAM" || isSubmitted || task.isExternal) && (
                                      <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="btn btn-primary text-sm px-2 py-1">
                                        Calificar
                                      </Link>
                                    )}
                                  </div>
                                  {submission.gdriveEmail && (
                                    <GDriveEmailDisplay email={submission.gdriveEmail} context="task_details" />
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted text-sm">Sin entrega</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      ) : (
        /* Fallback if no groups defined */
        <div className="card w-full">
          <div className="mb-4 no-print">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-bold">Estado de las entregas</h2>
              {task.type === "EXAM" && (
                <ResetAllSubmissionsButton
                  taskId={task.id}
                  studentCount={filteredStudents.length}
                />
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-3 w-10 text-center no-print">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleSelectAllGlobal}
                      className="w-4 h-4 rounded text-[#f98012] focus:ring-[#f98012]/30 cursor-pointer accent-[#f98012]"
                    />
                  </th>
                  <th className="py-2 px-4 font-medium">Estudiante</th>
                  <th className="py-2 px-4 font-medium">Estado</th>
                  <th className="py-2 px-4 font-medium text-center">Entrega Tardía</th>
                  <th className="py-2 px-4 font-medium">Fecha de Envío</th>
                  <th className="py-2 px-4 font-medium text-right no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => {
                  const submission = submissions.find(s => s.studentId === student.id);
                  const isSubmitted = submission && submission.status !== "PENDING";
                  const isGraded = submission && submission.status === "GRADED";
                  const allowLate = submission ? submission.allowLateSubmission : false;
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <tr 
                      key={student.id} 
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                      className={`transition-colors ${isSelected ? "bg-orange-50/40 dark:bg-orange-950/15" : "hover:bg-gray-50/60 dark:hover:bg-zinc-800/30"}`}
                    >
                      <td className="py-3 px-3 text-center no-print">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          className="w-4 h-4 rounded text-[#f98012] focus:ring-[#f98012]/30 cursor-pointer accent-[#f98012]"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-zinc-100">{student.name}</td>
                      <td className="py-3 px-4">
                        {isGraded ? (
                          <span className="badge badge-success flex w-fit items-center gap-1">
                            <CheckCircle size={12}/> Calificada: {submission.grade}
                          </span>
                        ) : isSubmitted ? (
                          <span className="badge badge-info">Entregada</span>
                        ) : (
                          <span className="badge badge-warning flex w-fit items-center gap-1">
                            <Clock size={12}/> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StudentLateSubmissionToggle
                          taskId={task.id}
                          studentId={student.id}
                          studentName={student.name}
                          initialAllowLate={allowLate}
                          initialLateUntil={submission?.lateSubmissionUntil ? new Date(submission.lateSubmissionUntil).toISOString() : null}
                          disabled={task.allowLateSubmission}
                        />
                      </td>
                      <td className="py-3 px-4 text-muted">
                        {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right no-print">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex justify-end gap-2">
                            {submission && task.type !== "EXAM" && submission.fileUrl && (
                              <a href={submission.fileUrl} target="_blank" download className="btn btn-secondary text-sm px-2 py-1 flex items-center gap-1">
                                <Download size={14} /> Archivo
                              </a>
                            )}
                            {task.type === "EXAM" && (
                              <ResetSubmissionButton 
                                taskId={task.id}
                                studentId={student.id}
                                studentName={student.name}
                                hasSubmission={!!submission}
                              />
                            )}
                            {submission && (task.type !== "EXAM" || isSubmitted) && (
                              <Link href={`/docente/tareas/${task.id}/calificar/${student.id}`} className="btn btn-primary text-sm px-2 py-1">
                                Calificar
                              </Link>
                            )}
                            {!submission && task.type !== "EXAM" && (
                              <span className="text-muted text-sm">Sin entrega</span>
                            )}
                          </div>
                          {submission?.gdriveEmail && (
                            <GDriveEmailDisplay email={submission.gdriveEmail} context="task_details" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Prorroga Modal */}
      <BulkProrrogaModal
        taskId={task.id}
        selectedStudents={selectedStudents}
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={() => {
          setSelectedStudentIds([]);
        }}
      />
    </>
  );
}
