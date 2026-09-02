const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

// 1. Update filter logic and counts
const filterTarget = `    const totalCount = gradingStudents.length;
    const gradedCount = gradingStudents.filter(s => gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "").length;
    const pendingCount = totalCount - gradedCount;`;

const filterReplacement = `    const totalCount = gradingStudents.length;
    const gradedCount = gradingStudents.filter(s => gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "").length;
    const pendingCount = totalCount - gradedCount;
    const withProrrogaCount = gradingStudents.filter(s => s.submission?.allowLateSubmission).length;`;

content = content.replace(filterTarget, filterReplacement);

// 2. Update status filter type and filtering
const filterTypeTarget = `  const [gradingStatusFilter, setGradingStatusFilter] = useState<"ALL" | "GRADED" | "SUBMITTED" | "PENDING">("ALL");`;
const filterTypeReplacement = `  const [gradingStatusFilter, setGradingStatusFilter] = useState<"ALL" | "GRADED" | "SUBMITTED" | "PENDING" | "PRORROGA">("ALL");`;
content = content.replace(filterTypeTarget, filterTypeReplacement);

const filterConditionTarget = `      if (gradingStatusFilter === "PENDING") return !hasInitialGrade && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      return true;`;

const filterConditionReplacement = `      if (gradingStatusFilter === "PENDING") return !hasInitialGrade && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PRORROGA") return !!s.submission?.allowLateSubmission;
      return true;`;

content = content.replace(filterConditionTarget, filterConditionReplacement);

// 3. Update Toolbar buttons
const tabsTarget = `            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              {[
                { key: "ALL", label: "Todos" },
                { key: "PENDING", label: \`Pendientes (\${pendingCount})\` },
                { key: "GRADED", label: \`Calificados (\${gradedCount})\` },
              ].map(tab => (`;

const tabsReplacement = `            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border flex-wrap" style={{ borderColor: "var(--border-color)" }}>
              {[
                { key: "ALL", label: \`Todos (\${totalCount})\` },
                { key: "PENDING", label: \`Pendientes (\${pendingCount})\` },
                { key: "GRADED", label: \`Calificados (\${gradedCount})\` },
                ...(withProrrogaCount > 0 ? [{ key: "PRORROGA", label: \`Con Prórroga (\${withProrrogaCount})\` }] : []),
              ].map(tab => (`;

content = content.replace(tabsTarget, tabsReplacement);

// 4. Update Selection Actions in Toolbar
const selectionActionsTarget = `            {/* Selection Quick Actions */}
            {selectedStudentIds.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="text-xs font-bold text-orange-800 dark:text-orange-300">
                  Editando a: <strong>{gradingStudents.find(s => s.id === selectedStudentIds[0])?.name}</strong>
                </span>
                <span className="text-orange-300 dark:text-orange-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs font-bold text-orange-600 hover:text-orange-800 dark:hover:text-orange-200 underline"
                >
                  Bloquear
                </button>
              </div>
            )}`;

const selectionActionsReplacement = `            {/* Selection Quick Actions */}
            {selectedStudentIds.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 px-3 py-1.5 rounded-xl shadow-xs flex-wrap">
                <span className="text-xs font-bold text-orange-800 dark:text-orange-300">
                  {selectedStudentIds.length === 1
                    ? <>Editando a: <strong>{gradingStudents.find(s => s.id === selectedStudentIds[0])?.name}</strong></>
                    : <strong>{selectedStudentIds.length} estudiantes seleccionados</strong>}
                </span>
                <span className="text-orange-300 dark:text-orange-700">|</span>
                <button
                  type="button"
                  onClick={() => openGradingProrrogaModal(selectedStudentIds)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-[#f98012] hover:bg-[#e06d09] rounded-lg shadow-xs transition-all hover:scale-[1.02]"
                  title="Asignar o modificar prórroga de entrega para los estudiantes seleccionados"
                >
                  <Calendar size={13} />
                  <span>Asignar Prórroga ({selectedStudentIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveProrrogaSelected(selectedStudentIds)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-800 border rounded-lg transition-colors shadow-2xs"
                  title="Quitar prórroga a los estudiantes seleccionados"
                >
                  <X size={13} />
                  <span>Quitar Prórroga</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs font-bold text-orange-600 hover:text-orange-800 dark:hover:text-orange-200 underline ml-1"
                >
                  Deseleccionar
                </button>
              </div>
            )}`;

content = content.replace(selectionActionsTarget, selectionActionsReplacement);

// 5. Update Table Header with Master Checkbox
const tableHeaderTarget = `                <thead>
                  <tr className="border-b bg-gray-50/80 dark:bg-gray-800/60 text-xs font-bold uppercase tracking-wider text-muted" style={{ borderColor: "var(--border-color)" }}>
                    <th className="py-3.5 px-4 w-14 text-center">No.</th>
                    <th className="py-3.5 px-4 min-w-[220px]">
                      <span>Estudiante</span>
                    </th>
                    <th className="py-3.5 px-4 min-w-[170px]">Estado de Entrega</th>
                    <th className="py-3.5 px-6 w-44 text-center whitespace-nowrap">Calificación (1–5)</th>
                    <th className="py-3.5 px-6 min-w-[340px]">Retroalimentación / Comentario</th>
                  </tr>
                </thead>`;

const tableHeaderReplacement = `                <thead>
                  <tr className="border-b bg-gray-50/80 dark:bg-gray-800/60 text-xs font-bold uppercase tracking-wider text-muted" style={{ borderColor: "var(--border-color)" }}>
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))}
                        onChange={() => {
                          const allSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));
                          if (allSelected) {
                            setSelectedStudentIds([]);
                          } else {
                            setSelectedStudentIds(filteredStudents.map(s => s.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012]"
                        title={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id)) ? "Deseleccionar todos" : "Seleccionar todos los estudiantes visibles"}
                      />
                    </th>
                    <th className="py-3.5 px-2 w-10 text-center">No.</th>
                    <th className="py-3.5 px-4 min-w-[220px]">
                      <span>Estudiante</span>
                    </th>
                    <th className="py-3.5 px-4 min-w-[200px]">Estado de Entrega</th>
                    <th className="py-3.5 px-6 w-44 text-center whitespace-nowrap">Calificación (1–5)</th>
                    <th className="py-3.5 px-6 min-w-[340px]">Retroalimentación / Comentario</th>
                  </tr>
                </thead>`;

content = content.replace(tableHeaderTarget, tableHeaderReplacement);

// 6. Update Row rendering with checkbox and prorroga badge/button
const studentRowStartTarget = `                        {/* Index */}
                        <td className="py-3.5 px-4 text-center font-bold text-xs text-muted">
                          {idx + 1}
                        </td>

                        {/* Student Name & Avatar with Checkbox */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012] shrink-0"
                              title={isSelected ? "Estudiante activado para calificar (clic para desactivar)" : "Activar checkbox para calificar a este estudiante"}
                            />
                            <div
                              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                              style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold leading-tight truncate text-gray-900 dark:text-gray-100">
                                {student.name}
                              </p>
                              <p className="text-xs text-muted mt-0.5 font-medium">{student.groupName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Submission status & attachments */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div>{statusBadge(student.submission)}</div>`;

const studentRowStartReplacement = `                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012] shrink-0"
                            title={isSelected ? "Estudiante seleccionado (clic para deseleccionar)" : "Seleccionar estudiante para calificar o dar prórroga"}
                          />
                        </td>

                        {/* Index */}
                        <td className="py-3.5 px-2 text-center font-bold text-xs text-muted">
                          {idx + 1}
                        </td>

                        {/* Student Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                              style={{ background: "linear-gradient(135deg, #f98012, #e06d09)" }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold leading-tight truncate text-gray-900 dark:text-gray-100">
                                {student.name}
                              </p>
                              <p className="text-xs text-muted mt-0.5 font-medium">{student.groupName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Submission status & attachments & prorroga */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {statusBadge(student.submission)}
                              {student.submission?.allowLateSubmission && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-2xs"
                                  title={student.submission.lateSubmissionUntil ? \`Prórroga activa hasta: \${new Date(student.submission.lateSubmissionUntil).toLocaleString('es-CO')}\` : "Prórroga activa sin fecha límite"}
                                >
                                  <Clock size={10} className="text-amber-600" />
                                  {student.submission.lateSubmissionUntil 
                                    ? \`Prórroga: \${new Date(student.submission.lateSubmissionUntil).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\`
                                    : "Prórroga sin límite"}
                                </span>
                              )}
                            </div>
                            {/* Inline Prorroga Action */}
                            <div className="flex items-center gap-2 mt-0.5">
                              <button
                                type="button"
                                onClick={() => openGradingProrrogaModal([student.id])}
                                className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 hover:underline flex items-center gap-1"
                                title="Configurar prórroga individual para este estudiante"
                              >
                                <Calendar size={11} />
                                <span>{student.submission?.allowLateSubmission ? "Modificar Prórroga" : "Dar Prórroga"}</span>
                              </button>
                            </div>`;

content = content.replace(studentRowStartTarget, studentRowStartReplacement);

// 7. Add the Prorroga Modal portal at the end of if (gradingTask) return
const gradingTaskEndTarget = `        </div>
      </div>
    );
  }`;

const gradingTaskEndReplacement = `        </div>

        {/* ─── Prórroga Modal inside Calificar Estudiantes ─── */}
        {isMounted && gradingProrrogaOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-zinc-800 text-left relative max-h-[90vh] flex flex-col animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f98012]">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Prórroga de Entrega
                    </h3>
                    <p className="text-xs text-muted">
                      Habilita y configura la nueva fecha límite de entrega
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setGradingProrrogaOpen(false)}
                  disabled={savingGradingProrroga}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Selected Students Badge Box */}
                <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-zinc-800/40 border border-orange-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#e06d09] dark:text-[#f98012] flex items-center gap-1.5">
                      <Users size={14} /> Estudiante(s) a aplicar prórroga ({gradingProrrogaStudentIds.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {gradingProrrogaStudentIds.map(sid => {
                      const studentName = gradingStudents.find(s => s.id === sid)?.name || sid;
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 shadow-2xs font-medium"
                        >
                          {studentName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Toggle enable late submission */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                      Permitir entrega con prórroga
                    </span>
                    <span className="text-xs text-muted block mt-0.5">
                      {gradingProrrogaAllow 
                        ? "Los estudiantes seleccionados podrán enviar la actividad aunque haya vencido el plazo."
                        : "Se bloqueará la entrega para estos estudiantes si el plazo general ya expiró."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGradingProrrogaAllow(!gradingProrrogaAllow)}
                    className={\`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${
                      gradingProrrogaAllow ? "bg-[#f98012]" : "bg-gray-200 dark:bg-zinc-700"
                    }\`}
                  >
                    <span
                      className={\`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out \${
                        gradingProrrogaAllow ? "translate-x-5" : "translate-x-0"
                      }\`}
                    />
                  </button>
                </div>

                {/* Date / Time Picker if enabled */}
                {gradingProrrogaAllow && (
                  <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 space-y-3 animate-fade-in">
                    <label className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Calendar size={15} className="text-[#f98012]" />
                      Nueva fecha y hora límite de entrega:
                    </label>

                    <input
                      type="datetime-local"
                      value={gradingProrrogaDate}
                      onChange={(e) => setGradingProrrogaDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-zinc-700 dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f98012]/30 focus:border-[#f98012]"
                    />

                    {/* Presets */}
                    <div>
                      <span className="text-[11px] font-semibold text-muted flex items-center gap-1 mb-1.5">
                        <Sparkles size={12} className="text-[#f98012]" /> Atajos de fecha rápida:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "+1 Día", days: 1 },
                          { label: "+2 Días", days: 2 },
                          { label: "+3 Días", days: 3 },
                          { label: "+1 Semana", days: 7 }
                        ].map(p => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + p.days);
                              d.setHours(23, 59, 0, 0);
                              setGradingProrrogaDate(toColombiaISOString(d.toISOString()));
                            }}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-[#f98012] dark:hover:border-[#f98012] text-gray-700 dark:text-zinc-300 hover:text-[#f98012] transition-colors shadow-2xs"
                          >
                            {p.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setGradingProrrogaDate("")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-gray-400 text-muted transition-colors shadow-2xs"
                        >
                          Sin fecha límite (Indefinido)
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted leading-relaxed">
                      * Si dejas el campo sin fecha, los estudiantes seleccionados podrán enviar la actividad sin límite de tiempo.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                <span className="text-xs text-muted font-medium">
                  Afectará a <strong>{gradingProrrogaStudentIds.length}</strong> {gradingProrrogaStudentIds.length === 1 ? 'estudiante' : 'estudiantes'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGradingProrrogaOpen(false)}
                    disabled={savingGradingProrroga}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGradingProrroga}
                    disabled={savingGradingProrroga || gradingProrrogaStudentIds.length === 0}
                    className="px-5 py-2 text-sm font-bold text-white bg-[#f98012] hover:bg-[#e06d09] rounded-xl shadow-md flex items-center gap-2 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingGradingProrroga ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Aplicar Prórroga ({gradingProrrogaStudentIds.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }`;

content = content.replace(gradingTaskEndTarget, gradingTaskEndReplacement);

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Successfully updated Calificar Estudiantes UI in PlanillasClient.tsx');
