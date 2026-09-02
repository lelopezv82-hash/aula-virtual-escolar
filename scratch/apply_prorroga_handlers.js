const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

// 1. Add grading prorroga state variables
const stateTarget = 'const [gradingActiveGroupId, setGradingActiveGroupId] = useState<string>("all");';
const stateAddition = `const [gradingActiveGroupId, setGradingActiveGroupId] = useState<string>("all");
  const [gradingProrrogaOpen, setGradingProrrogaOpen] = useState(false);
  const [gradingProrrogaStudentIds, setGradingProrrogaStudentIds] = useState<string[]>([]);
  const [gradingProrrogaAllow, setGradingProrrogaAllow] = useState(true);
  const [gradingProrrogaDate, setGradingProrrogaDate] = useState("");
  const [savingGradingProrroga, setSavingGradingProrroga] = useState(false);`;

content = content.replace(stateTarget, stateAddition);

// 2. Add grading prorroga helper functions and multi-selection
const toggleStudentTarget = `  const toggleStudentSelection = (studentId: string) => {
    // Only one student can be activated at a time for safety
    setSelectedStudentIds(prev => (prev.includes(studentId) ? [] : [studentId]));
  };`;

const toggleStudentReplacement = `  const toggleStudentSelection = (studentId: string) => {
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

content = content.replace(toggleStudentTarget, toggleStudentReplacement);

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Added state and handlers to PlanillasClient.tsx');
