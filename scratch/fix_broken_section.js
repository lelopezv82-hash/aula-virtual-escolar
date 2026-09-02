const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'docente', 'planillas', 'PlanillasClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure openEditModal and handleEditTask are properly complete
const brokenSectionRegex = /if \(selectedCourseId\) \{\s*setLoadingResources\(true\);\s*fetch\(`\/api\/docente\/recursos\?courseId=\$\{selectedCourseId\}`\)\s*\.then\(r => r\.json\(\)\)\s*const handleToggleActive/;

const fixedSection = `if (selectedCourseId) {
        setLoadingResources(true);
        fetch(\`/api/docente/recursos?courseId=\${selectedCourseId}\`)
          .then(r => r.json())
          .then(d => { if (d.resources) setModalResources(d.resources); })
          .catch(() => {})
          .finally(() => setLoadingResources(false));
        fetch(\`/api/docente/temas?courseId=\${selectedCourseId}\`)
          .then(r => r.json())
          .then(d => { if (d.themes) setPlanillasThemes(d.themes); })
          .catch(() => {});
        fetch("/api/docente/estudiantes")
          .then(r => r.json())
          .then(d => { if (d.students) setAllCourseStudents(d.students); })
          .catch(() => {});
      }
    } catch { alert("Error de conexión."); }
    setLoadingEdit(false);
  };

  const handleEditTask = async () => {
    if (!newTaskName.trim() || !addModal || !editTaskId) return;
    setAddingTask(true);
    try {
      const res = await fetch(\`/api/docente/tareas/\${editTaskId}\`, { method: "PATCH", body: buildFormData() });
      if (res.ok) { setAddModal(null); setEditTaskId(null); fetchData(); }
      else { const d = await res.json(); alert(d.error ?? "Error al guardar cambios."); }
    } catch { alert("Error de conexión."); }
    setAddingTask(false);
  };

  const handleToggleActive`;

if (brokenSectionRegex.test(content)) {
  content = content.replace(brokenSectionRegex, fixedSection);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed broken section in PlanillasClient.tsx");
} else {
  console.log("Broken section regex did not match, checking content...");
}
