const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

// Line-by-line replacement for guaranteed exact matching
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Comment dividers
  if (line.includes('// \uFFFD') || line.includes('// ')) {
    line = line.replace(/\/\/ [\uFFFD\s]+ Interfaces [\uFFFD\s]+/g, '// ─── Interfaces ──────────────────────────────────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Helpers [\uFFFD\s]+/g, '// ─── Helpers ─────────────────────────────────────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Main Component [\uFFFD\s]+/g, '// ─── Main Component ──────────────────────────────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Selector state [\uFFFD\s]+/g, '// ─── Selector state ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Sync Helper for URL & LocalStorage [\uFFFD\s]+/g, '// ─── Sync Helper for URL & LocalStorage ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Restore from localStorage on mount if URL parameters were absent [\uFFFD\s]+/g, '// ─── Restore from localStorage on mount if URL parameters were absent ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Data state [\uFFFD\s]+/g, '// ─── Data state ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Grades grid state [\uFFFD\s]+/g, '// ─── Grades grid state ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Weights edit state [\uFFFD\s]+/g, '// ─── Weights edit state ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Portal mount guard \(SSR-safe\) [\uFFFD\s]+/g, '// ─── Portal mount guard (SSR-safe) ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Add column modal [\uFFFD\s]+/g, '// ─── Add column modal ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Resource linking in modal [\uFFFD\s]+/g, '// ─── Resource linking in modal ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Edit modal [\uFFFD\s]+/g, '// ─── Edit modal ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Toggle active [\uFFFD\s]+/g, '// ─── Toggle active ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Delete confirm [\uFFFD\s]+/g, '// ─── Delete confirm ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Manual Grading Full-Screen State [\uFFFD\s]+/g, '// ─── Manual Grading Full-Screen State ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Duplication \/ Cloning Modal State [\uFFFD\s]+/g, '// ─── Duplication / Cloning Modal State ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Reusable tasks for Add Modal [\uFFFD\s]+/g, '// ─── Reusable tasks for Add Modal ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Exam \/ Task Management Modal [\uFFFD\s]+/g, '// ─── Exam / Task Management Modal ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Custom Excel Sync Wizard State [\uFFFD\s]+/g, '// ─── Custom Excel Sync Wizard State ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Derived [\uFFFD\s]+/g, '// ─── Derived ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ URL Query Param watcher [\uFFFD\s]+/g, '// ─── URL Query Param watcher for calificarTaskId persistence across F5 ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Category slices [\uFFFD\s]+/g, '// ─── Category slices ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Cell handler [\uFFFD\s]+/g, '// ─── Cell handler ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Save grades [\uFFFD\s]+/g, '// ─── Save grades ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Save weight percentages [\uFFFD\s]+/g, '// ─── Save weight percentages ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Add column [\uFFFD\s]+/g, '// ─── Add column ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Excel export [\uFFFD\s]+/g, '// ─── Excel export (Institutional Monsenor Diaz Plata Grade Sheet) ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Row heights [\uFFFD\s]+/g, '// ─── Row heights ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Cell merges [\uFFFD\s]+/g, '// ─── Cell merges ───');
    line = line.replace(/\/\/ [\uFFFD\s]+ Render helpers [\uFFFD\s]+/g, '// ─── Render helpers ──────────────────────────────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Full-Screen Manual Grading View [\uFFFD\s]+/g, '// ─── Full-Screen Manual Grading View ────────────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Full-Page Task \/ Exam Management View [\uFFFD\s]+/g, '// ─── Full-Page Task / Exam Management View ──────────────────────────────');
    line = line.replace(/\/\/ [\uFFFD\s]+ Main render [\uFFFD\s]+/g, '// ─── Main render ─────────────────────────────────────────────────────────');
    line = line.replace(/DESEMPE[\uFFFD] O/g, 'DESEMPEÑO');
    line = line.replace(/INSTITUCI[\uFFFD] N/g, 'INSTITUCIÓN');
    line = line.replace(/Category header row \(row 6\) [\uFFFD]\s+/g, 'Category header row (row 6) — ');
  }

  // JSX comments
  if (line.includes('{/*') && (line.includes('\uFFFD') || line.includes(''))) {
    line = line.replace(/\{\/\* [\uFFFD\s]+ Fallback wizard[^\*]+\*\/\}/g, '{/* ─── Fallback wizard: only shown when auto-detection couldn\'t find student column ─── */}');
    line = line.replace(/\{\/\* [\uFFFD\s]+ Sync Confirm Modal \(portal [\uFFFD\s]+ escapes overflow:hidden\) [\uFFFD\s]+ \*\/\}/g, '{/* ─── Sync Confirm Modal (portal — escapes overflow:hidden) ─── */}');
    line = line.replace(/\{\/\* [\uFFFD\s]+ Sync Result Modal \(portal [\uFFFD\s]+ escapes overflow:hidden\) [\uFFFD\s]+ \*\/\}/g, '{/* ─── Sync Result Modal (portal — escapes overflow:hidden) ─── */}');
    line = line.replace(/\{\/\* [\uFFFD\s]+ Duplicate \/ Clone Task Modal [\uFFFD\s]+ \*\/\}/g, '{/* ─── Duplicate / Clone Task Modal ─── */}');
    line = line.replace(/\{\/\* Final [\uFFFD\s]+ same color scale as Desempeño \*\/\}/g, '{/* Final — same color scale as Desempeño */}');
    line = line.replace(/\{\/\* Row 4 & Checkboxes [\uFFFD\s]+ hidden for SER \*\/\}/g, '{/* Row 4 & Checkboxes — hidden for SER */}');
  }

  // Code & text replacements
  line = line.replace(/DESEMPE[\uFFFD] O/g, 'DESEMPEÑO');
  line = line.replace(/INSTITUCI[\uFFFD] N/g, 'INSTITUCIÓN');
  line = line.replace(/Consolidado [\uFFFD]\s+/g, 'Consolidado — ');
  line = line.replace(/0[\uFFFD]\s+A, 25[\uFFFD]\s+Z, 26[\uFFFD]\s+AA ⬦/g, '0 → A, 25 → Z, 26 → AA …');
  line = line.replace(/`Grado \$\{activeGradeName\} [\uFFFD]\s+Grupo \$\{activeGroupName\}`/g, '`Grado ${activeGradeName} — Grupo ${activeGroupName}`');
  line = line.replace(/\{catInfo\.label\} \{catInfo\.sublabel \? `[\uFFFD]\s+\$\{catInfo\.sublabel\}` : ""\}/g, '{catInfo.label} {catInfo.sublabel ? `— ${catInfo.sublabel}` : ""}');
  line = line.replace(/[\uFFFD]x\}\s+\{groupGradeBadge\}/g, '🎓 {groupGradeBadge}');
  line = line.replace(/¡Guardado con [\uFFFD]0xito!/g, '¡Guardado con éxito!');
  line = line.replace(/Calificación \(1[\uFFFD]\s*5\)/g, 'Calificación (1–5)');
  line = line.replace(/placeholder="[\uFFFD]\s*"/g, 'placeholder="—"');
  line = line.replace(/: "[\uFFFD]\s*"/g, ': "—"');
  line = line.replace(/>[\uFFFD]\s*</g, '>—<');
  line = line.replace(/"[\uFFFD]\s*"/g, '"—"');
  line = line.replace(/`\$\{g\.grade\.name\} [\uFFFD]\s+\$\{g\.name\}`/g, '`${g.grade.name} — ${g.name}`');
  line = line.replace(/\{student\.group\.grade\?\.name\} [\uFFFD]\s+\{student\.group\.name\}/g, '{student.group.grade?.name} — {student.group.name}');
  line = line.replace(/Directorio de Evaluaciones [\uFFFD]\s+\{selectedPeriod\}/g, 'Directorio de Evaluaciones — {selectedPeriod}');
  line = line.replace(/"SABER [\uFFFD]\s+Tarea"/g, '"SABER — Tarea"');
  line = line.replace(/"SABER [\uFFFD]\s+Examen"/g, '"SABER — Examen"');
  line = line.replace(/` [\uFFFD]\s+\$\{cat\.sublabel\}`/g, '` — ${cat.sublabel}`');
  line = line.replace(/[\uFFFD]x [\uFFFD] Entrega en clase/g, '🏫 Entrega en clase');
  line = line.replace(/[\uFFFD]x [\uFFFD] Entrega en plataforma/g, '💻 Entrega en plataforma');
  line = line.replace(/"Visible para alumnos [\uFFFD]\s+clic para ocultar"/g, '"Visible para alumnos — clic para ocultar"');
  line = line.replace(/"Oculto para alumnos [\uFFFD]\s+clic para activar"/g, '"Oculto para alumnos — clic para activar"');
  line = line.replace(/[\uFFFD]S[\uFFFD] Crear Desde Cero/g, '✨ Crear Desde Cero');
  line = line.replace(/[\uFFFD]x 9 Clonar \/ Reutilizar Existente/g, '📋 Clonar / Reutilizar Existente');
  line = line.replace(/[\uFFFD]x [\uFFFD] <strong>Clonación Limpia:<\/strong>/g, '💡 <strong>Clonación Limpia:</strong>');
  line = line.replace(/⬢ [\uFFFD]x [\uFFFD] \$\{t\._count\.questions\} preguntas/g, '⬢ 📝 ${t._count.questions} preguntas');
  line = line.replace(/[\uFFFD]x\s+Tarea \/ Taller \(Saber\)/g, '📝 Tarea / Taller (Saber)');
  line = line.replace(/[\uFFFD]x [\uFFFD] Examen en Línea \(Saber\)/g, '🧠 Examen en Línea (Saber)');
  line = line.replace(/Descripci[\uFFFD]n/g, 'Descripción');
  line = line.replace(/evaluaci[\uFFFD]n/g, 'evaluación');
  line = line.replace(/aqu[\uFFFD]/g, 'aquí');
  line = line.replace(/[\uFFFD]x \} Guía adjunta actual/g, '📎 Guía adjunta actual');
  line = line.replace(/<span className="text-base">[\uFFFD]x 9<\/span>/g, '<span className="text-base">1️⃣</span>');
  line = line.replace(/<span className="text-base">[\uFFFD]x [\uFFFD]<\/span>/g, '<span className="text-base">2️⃣</span>');
  line = line.replace(/<span>[\uFFFD]S&<\/span>/g, '<span>✅</span>');
  line = line.replace(/<span>[\uFFFD]x\s+<\/span>/g, '<span>🔒</span>');
  line = line.replace(/<span>[\uFFFD]a[\uFFFD]️<\/span>/g, '<span>⚠️</span>');
  line = line.replace(/<span>[\uFFFD]x [\uFFFD]<\/span>/g, '<span>💡</span>');
  line = line.replace(/>[\uFFFD]x [\uFFFD] Estudiantes encontrados/g, '>👥 Estudiantes encontrados');
  line = line.replace(/>[\uFFFD]S& Notas nuevas agregadas/g, '>✅ Notas nuevas agregadas');
  line = line.replace(/>[\uFFFD]x\s+Notas existentes protegidas/g, '>🔒 Notas existentes protegidas');
  line = line.replace(/[\uFFFD]x [\uFFFD] Haz clic en <strong>/g, '💡 Haz clic en <strong>');
  line = line.replace(/Entendido [\uFFFD]S\s*/g, 'Entendido ✓');
  line = line.replace(/[\uFFFD]x [\uFFFD] <strong>Actividad Original:<\/strong>/g, '💡 <strong>Actividad Original:</strong>');
  line = line.replace(/: "[\uFFFD]x\s+️ Asignar Prórroga a Varios Estudiantes"/g, ': "📅 Asignar Prórroga a Varios Estudiantes"');
  line = line.replace(/Abrir en Drive [\uFFFD]\s*/g, 'Abrir en Drive ↗');

  lines[i] = line;
}

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', lines.join('\n'), 'utf8');
console.log('Processed all lines.');
