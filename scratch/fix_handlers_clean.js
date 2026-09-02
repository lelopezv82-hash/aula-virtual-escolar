const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

const targetStr = `  const handleCloneFromPicker = async () => {
    if (!selectedReuseTaskId || !selectedCourseId) {
      alert("Selecciona una actividad para clonar.");
      return;
    }
    const targetGroups = newTaskGroupIds.length > 0 ? newTaskGroupIds : (selectedGroupId ? [selectedGroupId] : []);
    if (targetGroups.length === 0) {
      alert("Selecciona al menos un grupo de destino.");
      return;
    }
    setAddingTask(true);
    try {
      const res = await fetch(\`/api/docente/tareas/\${selectedReuseTaskId}/duplicate\`, {
        method: "POST",
    fetchData();
  };

  const toggleStudentSelection = (studentId: string) => {
    // Only one student can be activated at a time for safety
    setSelectedStudentIds(prev => (prev.includes(studentId) ? [] : [studentId]));
  };`;

const replacementStr = `  const handleCloneFromPicker = async () => {
    if (!selectedReuseTaskId || !selectedCourseId) {
      alert("Selecciona una actividad para clonar.");
      return;
    }
    const targetGroups = newTaskGroupIds.length > 0 ? newTaskGroupIds : (selectedGroupId ? [selectedGroupId] : []);
    if (targetGroups.length === 0) {
      alert("Selecciona al menos un grupo de destino.");
      return;
    }
    setAddingTask(true);
    try {
      const res = await fetch(\`/api/docente/tareas/\${selectedReuseTaskId}/duplicate\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCourseId: selectedCourseId,
          targetGroupIds: targetGroups,
          targetPeriod: selectedPeriod,
          title: newTaskName.trim() || undefined,
          dueDate: newTaskDueDate || undefined,
        })
      });
      const data = await res.json();
      if (res.ok && data.task) {
        setAddModal(null);
        setShowReusePicker(false);
        setSelectedReuseTaskId("");
        fetchData();
      } else {
        alert(data.error || "Error al clonar la actividad.");
      }
    } catch {
      alert("Error de conexión al clonar.");
    } finally {
      setAddingTask(false);
    }
  };

  const closeGrading = () => {
    if (hasUnsavedGradingChanges) {
      toast.warning(
        "¡Calificaciones sin guardar!",
        "Has modificado notas o comentarios. Debes presionar 'Guardar Calificaciones' para guardar los cambios antes de salir."
      );
      return;
    }
    updateUrlAndStorage(selectedCourseId, selectedPeriod, selectedGroupId, null);
    setGradingTask(null);
    setGradingSearch("");
    setBulkGradeValue("");
    fetchData();
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => (prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]));
  };

  const openGradingProrrogaModal = (studentIds: string[]) => {
    if (studentIds.length === 0) {
      toast.warning("Sin selección", "Selecciona al menos un estudiante para configurar prórroga.");
      return;
    }
    setGradingProrrogaStudentIds(studentIds);
    setGradingProrrogaAllow(true);
    const firstSub = gradingStudents.find(s => studentIds.includes(s.id))?.submission;
    if (firstSub?.lateSubmissionUntil) {
      setGradingProrrogaDate(toColombiaISOString(firstSub.lateSubmissionUntil));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
      setGradingProrrogaDate(toColombiaISOString(d.toISOString()));
    }
    setGradingProrrogaOpen(true);
  };

  const handleSaveGradingProrroga = async () => {
    if (!gradingTask || gradingProrrogaStudentIds.length === 0) return;
    setSavingGradingProrroga(true);
    try {
      const res = await fetch(\`/api/docente/tareas/\${gradingTask.id}/prorroga\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: gradingProrrogaStudentIds,
          allowLateSubmission: gradingProrrogaAllow,
          lateSubmissionUntil: gradingProrrogaAllow && gradingProrrogaDate ? gradingProrrogaDate : null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const untilISO = gradingProrrogaAllow && gradingProrrogaDate ? fromColombiaLocalStringToDate(gradingProrrogaDate)?.toISOString() || null : null;
        setGradingStudents(prev => prev.map(s => {
          if (gradingProrrogaStudentIds.includes(s.id)) {
            const currentSub = s.submission || {
              id: \`sub-\${s.id}\`,
              status: "PENDING",
              grade: null,
              feedback: null,
              submittedAt: null,
              fileUrl: null
            };
            return {
              ...s,
              submission: {
                ...currentSub,
                allowLateSubmission: gradingProrrogaAllow,
                lateSubmissionUntil: untilISO
              }
            };
          }
          return s;
        }));

        if (gradingProrrogaAllow) {
          setGradeInputs(prev => {
            const updated = { ...prev };
            gradingProrrogaStudentIds.forEach(sid => {
              const s = gradingStudents.find(x => x.id === sid);
              if (s && !s.submission?.grade && updated[sid] === "1.0") {
                updated[sid] = "";
              }
            });
            return updated;
          });
          setFeedbackInputs(prev => {
            const updated = { ...prev };
            gradingProrrogaStudentIds.forEach(sid => {
              const s = gradingStudents.find(x => x.id === sid);
              if (s && !s.submission?.feedback && updated[sid]?.includes("plazo establecido")) {
                updated[sid] = "";
              }
            });
            return updated;
          });
        }

        setGradingProrrogaOpen(false);
        toast.success(
          "¡Prórroga aplicada!",
          \`Se configuró la prórroga correctamente para \${gradingProrrogaStudentIds.length} estudiante(s).\`
        );
      } else {
        toast.error("Error", data.error || "No se pudo aplicar la prórroga.");
      }
    } catch {
      toast.error("Error de conexión", "No se pudo comunicar con el servidor.");
    } finally {
      setSavingGradingProrroga(false);
    }
  };

  const handleRemoveProrrogaSelected = async (studentIds: string[]) => {
    if (!gradingTask || studentIds.length === 0) return;
    try {
      const res = await fetch(\`/api/docente/tareas/\${gradingTask.id}/prorroga\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          allowLateSubmission: false,
          lateSubmissionUntil: null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGradingStudents(prev => prev.map(s => {
          if (studentIds.includes(s.id) && s.submission) {
            return {
              ...s,
              submission: {
                ...s.submission,
                allowLateSubmission: false,
                lateSubmissionUntil: null
              }
            };
          }
          return s;
        }));
        toast.success("Prórroga revocada", "Se quitó la prórroga a los estudiantes seleccionados.");
      } else {
        toast.error("Error", data.error || "No se pudo quitar la prórroga.");
      }
    } catch {
      toast.error("Error de conexión", "No se pudo comunicar con el servidor.");
    }
  };`;

if (!content.includes(targetStr)) {
  console.error("targetStr not found!");
  process.exit(1);
}

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Fixed handleCloneFromPicker and handlers successfully!');
