const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'docente', 'planillas', 'PlanillasClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure removeExistingAttachment state exists
if (!content.includes('removeExistingAttachment')) {
  content = content.replace(
    /const\s+\[existingAttachmentUrl,\s*setExistingAttachmentUrl\]\s*=\s*useState<string\s*\|\s*null>\(null\);/,
    'const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);\r\n  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);'
  );
}

// 2. Fix openEditModal to have full implementation
const openEditRegex = /const openEditModal = async \(task: TaskItem\) => \{[\s\S]*?if \(selectedCourseId\) \{/;
const openEditFull = `const openEditModal = async (task: TaskItem) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(\`/api/docente/tareas/\${task.id}\`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Error cargando datos."); return; }
      const t = data.task;
      // Format datetime-local
      const toLocal = (d: string | null) => {
        if (!d) return "";
        if (d.startsWith("9999") || d.startsWith("2100")) return "";
        const date = new Date(d);
        const pad = (n: number) => String(n).padStart(2, "0");
        return \`\${date.getFullYear()}-\${pad(date.getMonth()+1)}-\${pad(date.getDate())}T\${pad(date.getHours())}:\${pad(date.getMinutes())}\`;
      };
      const taskType = t.type || "TASK";
      const catType = (taskType === "TASK_SABER" || taskType === "SABER" ? "EXAM" : taskType) as CatType;
      setAddModal({ type: catType });
      setSelectedSaberSubtype(taskType === "EXAM" ? "EXAM" : "TASK_SABER");
      setEditTaskId(task.id);
      setNewTaskName(t.title || "");
      setNewTaskDescription(t.description || "");
      setNewTaskDueDate(toLocal(t.dueDate));
      setNewTaskIsExternal(!!t.isExternal);
      setNewTaskDuration(t.duration ? String(t.duration) : "");
      setNewTaskWeight(t.weight != null ? String(t.weight) : "0");
      setNewTaskGroupIds((t.groups || []).map((g: any) => g.id));
      setNewTaskStudentIds((t.assignedStudents || []).map((s: any) => s.id));
      setStudentSearch("");
      setNewTaskSelectedThemes(
        t.themes && t.themes.length > 0
          ? t.themes.map((th: any) => th.title)
          : (t.theme ? [t.theme] : [])
      );
      setNewTaskPublishAt(toLocal(t.publishAt));
      setNewTaskAllowLateSubmission(!!t.allowLateSubmission);
      setNewTaskLateSubmissionUntil(toLocal(t.lateSubmissionUntil));
      setExistingAttachmentUrl(t.attachmentUrl || null);
      setRemoveExistingAttachment(false);
      setNewTaskExternalUrl("");
      setNewTaskFile(null);
      setNewTaskResourceIds((t.resources || []).map((r: any) => r.id));
      // Fetch available resources and themes for course
      if (selectedCourseId) {`;

content = content.replace(openEditRegex, openEditFull);

// 3. Fix attachment UI
const uiRegex = /\{\/\* Archivo Adjunto \*\/\}[\s\S]*?\{\/\* Footer Buttons \*\/\}/;
const newAttachmentUI = `{\/* Archivo Adjunto *\/}
                  <div className="input-group">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Archivo Adjunto / Guía de Apoyo (Opcional)
                    </label>
                    {existingAttachmentUrl && !newTaskFile && !removeExistingAttachment && (
                      <div className="flex items-center justify-between p-2.5 mb-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 truncate">
                          📎 Guía adjunta actual
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <a
                            href={existingAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#f97316] hover:underline font-bold"
                          >
                            Ver archivo
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveExistingAttachment(true);
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            title="Eliminar guía adjunta"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    )}
                    {existingAttachmentUrl && !newTaskFile && removeExistingAttachment && (
                      <div className="flex items-center justify-between p-2.5 mb-2 rounded-lg bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                        <span className="font-medium flex items-center gap-1.5">
                          🗑️ Guía marcada para eliminar al guardar
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveExistingAttachment(false);
                          }}
                          className="text-gray-600 dark:text-gray-300 hover:underline font-bold ml-2 text-xs cursor-pointer"
                        >
                          Deshacer
                        </button>
                      </div>
                    )}
                    {newTaskFile && (
                      <div className="flex items-center justify-between p-2.5 mb-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                        <span className="font-semibold flex items-center gap-1.5 truncate">
                          📄 {newTaskFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewTaskFile(null);
                            const fileInput = document.getElementById("modal-file-upload");
                            if (fileInput) fileInput.value = "";
                          }}
                          className="text-red-500 hover:text-red-700 hover:underline font-bold text-xs shrink-0 ml-2 cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                    <div 
                      className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer relative"
                      onClick={() => document.getElementById("modal-file-upload")?.click()}
                    >
                      <input
                        id="modal-file-upload"
                        type="file"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] || null;
                          setNewTaskFile(f);
                          if (f) setRemoveExistingAttachment(false);
                        }}
                      />
                      <svg className="mx-auto h-8 w-8 text-[#f97316] mb-2" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-xs font-bold text-gray-650 dark:text-gray-350 block">
                        {newTaskFile ? "Cambiar archivo seleccionado..." : (existingAttachmentUrl && !removeExistingAttachment ? "Cambiar guía o archivo..." : "Selecciona una guía o archivo")}
                      </span>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Footer Buttons */}`;

content = content.replace(uiRegex, newAttachmentUI);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated PlanillasClient.tsx');
