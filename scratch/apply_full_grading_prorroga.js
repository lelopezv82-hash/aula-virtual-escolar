const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

const startStr = '  if (gradingTask) {';
const endStr = '  if (questionsModalTask) {';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers:', { startIndex, endIndex });
  process.exit(1);
}

const replacement = `  if (gradingTask) {
    const totalCount = gradingStudents.length;
    const gradedCount = gradingStudents.filter(s => gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "").length;
    const pendingCount = totalCount - gradedCount;
    const withProrrogaCount = gradingStudents.filter(s => s.submission?.allowLateSubmission).length;
    
    // Average
    const validGrades = gradingStudents
      .map(s => parseFloat(gradeInputs[s.id] || ""))
      .filter(g => !isNaN(g) && g >= 1.0 && g <= 5.0);
    const averageGrade = validGrades.length > 0
      ? (validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(2)
      : null;

    const filteredStudents = gradingStudents.filter(s => {
      const q = gradingSearch.toLowerCase().trim();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || (s.groupName && s.groupName.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      // Always keep actively selected student visible so they never disappear or get blocked while editing
      if (selectedStudentIds.includes(s.id)) return true;

      const hasInitialGrade = s.submission?.grade != null || s.submission?.status === "GRADED";
      if (gradingStatusFilter === "GRADED") return hasInitialGrade || (gradeInputs[s.id] !== undefined && gradeInputs[s.id] !== "");
      if (gradingStatusFilter === "SUBMITTED") return (s.submission?.status === "SUBMITTED" || s.submission?.fileUrl) && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PENDING") return !hasInitialGrade && (!gradeInputs[s.id] || gradeInputs[s.id] === "");
      if (gradingStatusFilter === "PRORROGA") return !!s.submission?.allowLateSubmission;
      return true;
    });

    const catInfo = CATEGORIES.find(c => c.type === (gradingTask.type === "TASK_SABER" || gradingTask.type === "SABER" ? "EXAM" : gradingTask.type)) ?? CATEGORIES[1];
    const selectedGroupObj = groups.find(g => g.id === selectedGroupId);
    const activeGroupObj = gradingAvailableGroups.find(g => g.id === gradingActiveGroupId) || selectedGroupObj;
    const activeGradeName = (activeGroupObj as any)?.gradeName || (activeGroupObj as any)?.grade?.name || selectedGroupObj?.grade?.name || students[0]?.group?.grade?.name || "";
    const activeGroupName = activeGroupObj?.name || selectedGroupObj?.name || students[0]?.group?.name || "";
    const groupGradeBadge = activeGradeName && activeGroupName 
      ? \`Grado \${activeGradeName} — Grupo \${activeGroupName}\`
      : activeGroupName 
      ? \`Grupo \${activeGroupName}\`
      : "";

    const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));

    return (
      <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 60px - 4rem)', minHeight: '580px' }}>
        {/* Top Header & Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-sm" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-4">
            <button
              onClick={closeGrading}
              className="p-2.5 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-700 dark:text-gray-200 flex items-center gap-2 font-semibold text-sm shadow-sm"
              style={{ borderColor: "var(--border-color)" }}
              title="Volver a la planilla"
            >
              <ArrowLeft size={18} />
              <span>Volver a la Planilla</span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={\`px-2.5 py-0.5 rounded-full font-extrabold text-xs uppercase tracking-wider \${catInfo.color.badge}\`}>
                  {catInfo.label} {catInfo.sublabel ? \`— \${catInfo.sublabel}\` : ""}
                </span>
                {groupGradeBadge && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    🎓 {groupGradeBadge}
                  </span>
                )}
                <span className="text-xs text-muted font-semibold">
                  {selectedCourse?.name ? \`\${selectedCourse.name} ⬢ \` : ""}{selectedPeriod}
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
                <Pencil size={22} className="text-[#f98012]" />
                {gradingTask.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Direct Prorroga button in top header */}
            <button
              type="button"
              onClick={() => {
                const targetIds = selectedStudentIds.length > 0 ? selectedStudentIds : gradingStudents.map(s => s.id);
                openGradingProrrogaModal(targetIds);
              }}
              className="px-4 py-2.5 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/80 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-[#ea580c] dark:text-orange-300 font-bold text-xs flex items-center gap-2 shadow-xs transition-all hover:scale-[1.02]"
              title="Configurar prórroga de entrega para estudiantes"
            >
              <Calendar size={16} className="text-[#f98012]" />
              <span>{selectedStudentIds.length > 0 ? \`Prórroga (\${selectedStudentIds.length})\` : "Asignar Prórroga"}</span>
            </button>

            {hasUnsavedGradingChanges && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 px-3 py-2 rounded-xl animate-pulse shadow-xs">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Cambios sin guardar</span>
              </div>
            )}
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents}
              className={\`btn \${gradingSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "btn-primary"} px-5 py-2.5 font-bold shadow-md flex items-center gap-2\`}
            >
              {savingGrades ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Guardando...
                </>
              ) : gradingSaved ? (
                <>
                  <CheckCircle size={18} />
                  ¡Guardado con éxito!
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Calificaciones
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {gradingSaved && (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-4 py-3 rounded-xl animate-fade-in shadow-sm">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            ¡Todas las calificaciones y comentarios fueron guardados correctamente en el sistema!
          </div>
        )}
        {gradingError && (
          <div className="alert alert-danger font-semibold text-sm">
            {gradingError}
          </div>
        )}

        {/* Toolbar & Filters Card */}
        <div className="card p-4 rounded-xl border bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-4 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 flex-1 min-w-[260px] flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre de estudiante o grupo..."
                value={gradingSearch}
                onChange={e => setGradingSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ borderColor: "var(--border-color)" }}
              />
              {gradingSearch && (
                <button
                  onClick={() => setGradingSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border flex-wrap" style={{ borderColor: "var(--border-color)" }}>
              {[
                { key: "ALL", label: \`Todos (\${totalCount})\` },
                { key: "PENDING", label: \`Pendientes (\${pendingCount})\` },
                { key: "GRADED", label: \`Calificados (\${gradedCount})\` },
                ...(withProrrogaCount > 0 ? [{ key: "PRORROGA", label: \`Con Prórroga (\${withProrrogaCount})\` }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setGradingStatusFilter(tab.key as any)}
                  className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${
                    gradingStatusFilter === tab.key
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }\`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selection Quick Actions & Prorroga Toolbar */}
            {selectedStudentIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 px-3 py-1.5 rounded-xl shadow-xs flex-wrap">
                <span className="text-xs font-bold text-orange-800 dark:text-orange-300">
                  {selectedStudentIds.length === 1
                    ? <>Editando a: <strong>{gradingStudents.find(s => s.id === selectedStudentIds[0])?.name}</strong></>
                    : <strong>{selectedStudentIds.length} seleccionados</strong>}
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
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pendingStudents = filteredStudents.filter(s => !s.submission || s.submission.status !== "SUBMITTED");
                    if (pendingStudents.length > 0) {
                      openGradingProrrogaModal(pendingStudents.map(s => s.id));
                    } else {
                      openGradingProrrogaModal(filteredStudents.map(s => s.id));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100/70 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 rounded-xl border border-orange-200 dark:border-orange-800 transition-all shadow-2xs"
                  title="Asignar prórroga masiva a estudiantes"
                >
                  <Calendar size={14} className="text-[#f98012]" />
                  <span>Prórroga Masiva</span>
                </button>
              </div>
            )}

            {gradingAvailableGroups.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[11px] font-bold text-muted px-2">Grupo:</span>
                <button
                  onClick={() => changeGradingGroup("all")}
                  className={\`px-2.5 py-1 rounded-lg text-xs font-bold transition-all \${
                    gradingActiveGroupId === "all"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                  }\`}
                >
                  Todos ({gradingAvailableGroups.length})
                </button>
                {gradingAvailableGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => changeGradingGroup(g.id)}
                    className={\`px-2.5 py-1 rounded-lg text-xs font-bold transition-all \${
                      gradingActiveGroupId === g.id
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-muted hover:text-gray-800 dark:hover:text-gray-200"
                    }\`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Students List / Table */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
        <div className="card rounded-2xl border shadow-sm bg-white dark:bg-gray-900 overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-[#f98012]" size={40} />
              <p className="text-sm font-semibold text-muted">Cargando lista de estudiantes...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-20 px-4">
              <p className="text-muted font-medium text-base">No se encontraron estudiantes para los filtros seleccionados.</p>
              {(gradingSearch || gradingStatusFilter !== "ALL") && (
                <button
                  onClick={() => { setGradingSearch(""); setGradingStatusFilter("ALL"); }}
                  className="mt-3 text-xs font-bold text-[#f98012] underline hover:no-underline"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80 dark:bg-gray-800/60 text-xs font-bold uppercase tracking-wider text-muted" style={{ borderColor: "var(--border-color)" }}>
                    <th className="py-3.5 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={() => {
                          if (allFilteredSelected) {
                            setSelectedStudentIds([]);
                          } else {
                            setSelectedStudentIds(filteredStudents.map(s => s.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012]"
                        title={allFilteredSelected ? "Deseleccionar todos los estudiantes" : "Seleccionar todos los estudiantes visibles"}
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
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                  {filteredStudents.map((student, idx) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    const gradeVal = gradeInputs[student.id] ?? "";
                    const numGrade = parseFloat(gradeVal);
                    const hasValidGrade = !isNaN(numGrade) && numGrade >= 1.0 && numGrade <= 5.0;

                    return (
                      <tr
                        key={student.id}
                        className={\`transition-all \${
                          isSelected
                            ? "bg-orange-50/50 dark:bg-orange-950/20 border-l-4 border-l-[#f98012] shadow-sm font-medium"
                            : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40 border-l-4 border-l-transparent"
                        }\`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#f98012] shrink-0"
                            title={isSelected ? "Estudiante seleccionado (clic para desmarcar)" : "Seleccionar para calificar o asignar prórroga"}
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

                        {/* Submission status, attachments & prorroga */}
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

                            {/* Direct Prorroga action button */}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openGradingProrrogaModal([student.id])}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ea580c] dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 hover:underline cursor-pointer"
                                title="Abrir configuración de prórroga para este estudiante"
                              >
                                <Calendar size={11} className="text-[#f98012]" />
                                <span>{student.submission?.allowLateSubmission ? "Modificar Prórroga" : "Dar Prórroga"}</span>
                              </button>
                            </div>

                            {student.submission?.submittedAt && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock size={11} className="text-[#f97316]" />
                                <span>{new Date(student.submission.submittedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            )}
                            {student.submission?.fileUrl && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {isSelected ? (
                                  <>
                                    <a
                                      href={student.submission.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs cursor-pointer"
                                      title="Ver archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      Ver Archivo
                                    </a>
                                    <a
                                      href={student.submission.fileUrl}
                                      download
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer"
                                      title="Descargar archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </a>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed select-none opacity-60"
                                      title="Activa la casilla del estudiante para ver el archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      Ver Archivo
                                    </button>
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed select-none opacity-60"
                                      title="Activa la casilla del estudiante para descargar el archivo"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      Descargar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Grade Input */}
                        <td className="py-3.5 px-6 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            disabled={!isSelected}
                            value={gradeVal}
                            onChange={e => {
                              let val = e.target.value.replace(',', '.');
                              if (val !== "" && !/^\\d*\\.?\\d*$/.test(val)) return;
                              const num = parseFloat(val);
                              if (!isNaN(num) && num > 5.0) return;
                              setGradeInputs(prev => ({ ...prev, [student.id]: val }));
                            }}
                            title={!isSelected ? "Activa la casilla del estudiante para modificar calificación" : undefined}
                            className={\`w-24 text-center font-black rounded-xl border py-1.5 text-base outline-none transition-all \${
                              isSelected
                                ? "border-orange-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ring-2 ring-orange-500 shadow-sm"
                                : hasValidGrade
                                ? numGrade < 3.0
                                  ? "border-red-300 text-red-600 bg-red-50/50 dark:bg-red-950/20 shadow-sm"
                                  : numGrade < 4.0
                                  ? "border-amber-300 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                                  : "border-emerald-300 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            }\`}
                          />
                        </td>

                        {/* Feedback / Comentario */}
                        <td className="py-3.5 px-6">
                          <input
                            type="text"
                            placeholder={!isSelected ? "Activa la casilla para escribir observación..." : "Comentario u observación opcional para el estudiante..."}
                            disabled={!isSelected}
                            value={feedbackInputs[student.id] ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              setFeedbackInputs(prev => ({ ...prev, [student.id]: val }));
                            }}
                            title={!isSelected ? "Activa la casilla del estudiante para escribir comentario" : undefined}
                            className={\`w-full py-1.5 px-3 rounded-xl border text-sm transition-colors \${
                              isSelected
                                ? "border-orange-400 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ring-2 ring-orange-500/50 focus:outline-none"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white placeholder:text-gray-400"
                            }\`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-5 py-3 rounded-2xl border shadow-lg flex items-center justify-between gap-4 mt-1" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 text-xs font-bold text-muted flex-wrap">
            <span>Calificados: <strong className="text-emerald-600 text-sm">{gradedCount}</strong>/{totalCount}</span>
            <span>•</span>
            <span>Pendientes: <strong className="text-amber-600 text-sm">{pendingCount}</strong></span>
            {withProrrogaCount > 0 && (
              <>
                <span>•</span>
                <span>Con Prórroga: <strong className="text-[#f98012] text-sm">{withProrrogaCount}</strong></span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={closeGrading}
              className="btn btn-secondary py-2 px-4 text-xs font-bold"
            >
              Volver a Planilla
            </button>
            <button
              onClick={saveManualGrades}
              disabled={savingGrades || loadingStudents}
              className={\`btn \${gradingSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "btn-primary"} py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md\`}
            >
              {savingGrades ? (
                <>
                  <Loader2 className="animate-spin" size={15} />
                  Guardando...
                </>
              ) : gradingSaved ? (
                <>
                  <CheckCircle size={15} />
                  ¡Guardado con éxito!
                </>
              ) : (
                <>
                  <Save size={15} />
                  Guardar Calificaciones
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── Prórroga Modal inside Calificar Estudiantes ─── */}
        {isMounted && gradingProrrogaOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-zinc-800 text-left relative max-h-[90vh] flex flex-col animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f98012]">
                    <Calendar size={20} />
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
  }

`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Successfully replaced grading section!');
