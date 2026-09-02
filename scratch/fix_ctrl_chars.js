const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

// First remove any leftover control characters that corrupted emojis
content = content.replace(/\u001c/g, '');
content = content.replace(/\u0019/g, '');
content = content.replace(/\u0014/g, '');
content = content.replace(/\u001d/g, '');
content = content.replace(/\u0018/g, '');
content = content.replace(/\u0013/g, '');
content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

// Specific string restorations
content = content.replace(/INSTITUCI— N/g, 'INSTITUCIÓN');
content = content.replace(/DESEMPE— O/g, 'DESEMPEÑO');
content = content.replace(/—x\}\s*\{groupGradeBadge\}/g, '🎓 {groupGradeBadge}');
content = content.replace(/: "—x\s*️?\s*Asignar Prórroga a Varios Estudiantes"/g, ': "📅 Asignar Prórroga a Varios Estudiantes"');
content = content.replace(/—x\s*—\s*Entrega en clase/g, '🏫 Entrega en clase');
content = content.replace(/—x\s*—\s*Entrega en plataforma/g, '💻 Entrega en plataforma');
content = content.replace(/—x\s*9\s*Clonar \/ Reutilizar Existente/g, '📋 Clonar / Reutilizar Existente');
content = content.replace(/—x\s*—\s*<strong>Clonación Limpia:<\/strong>/g, '💡 <strong>Clonación Limpia:</strong>');
content = content.replace(/⬢ —x\s*—\s*\$\{t\._count\.questions\} preguntas/g, '⬢ 📝 ${t._count.questions} preguntas');
content = content.replace(/—x\s*Tarea \/ Taller \(Saber\)/g, '📝 Tarea / Taller (Saber)');
content = content.replace(/—x\s*—\s*Examen en Línea \(Saber\)/g, '🧠 Examen en Línea (Saber)');
content = content.replace(/—x\s*\}\s*Guía adjunta actual/g, '📎 Guía adjunta actual');
content = content.replace(/<span className="text-base">—x\s*9<\/span>/g, '<span className="text-base">1️⃣</span>');
content = content.replace(/<span className="text-base">—x\s*—<\/span>/g, '<span className="text-base">2️⃣</span>');
content = content.replace(/<span>—x\s*<\/span>\s*Notas ya existentes/g, '<span>🔒</span> Notas ya existentes');
content = content.replace(/<span>—x\s*—<\/span>\s*Recuerda hacer clic/g, '<span>💡</span> Recuerda hacer clic');
content = content.replace(/<span className="text-xs font-semibold text-gray-700 dark:text-gray-300">—x\s*—\s*Estudiantes encontrados<\/span>/g, '<span className="text-xs font-semibold text-gray-700 dark:text-gray-300">👥 Estudiantes encontrados</span>');
content = content.replace(/<span className="text-xs font-semibold text-slate-600 dark:text-slate-400">—x\s*Notas existentes protegidas<\/span>/g, '<span className="text-xs font-semibold text-slate-600 dark:text-slate-400">🔒 Notas existentes protegidas</span>');
content = content.replace(/—x\s*—\s*Haz clic en <strong>&quot;Guardar&quot;<\/strong>/g, '💡 Haz clic en <strong>&quot;Guardar&quot;</strong>');
content = content.replace(/—x\s*—\s*<strong>Actividad Original:<\/strong>/g, '💡 <strong>Actividad Original:</strong>');
content = content.replace(/Calificación \(1—\s*5\)/g, 'Calificación (1–5)');
content = content.replace(/Consolidado —\s+\$\{selectedCourse/g, 'Consolidado — ${selectedCourse');
content = content.replace(/Grado \$\{activeGradeName\} —\s+Grupo \$\{activeGroupName\}/g, 'Grado ${activeGradeName} — Grupo ${activeGroupName}');
content = content.replace(/\{catInfo\.label\} \{catInfo\.sublabel \? `—\s+\$\{catInfo\.sublabel\}`/g, '{catInfo.label} {catInfo.sublabel ? `— ${catInfo.sublabel}`');
content = content.replace(/\$\{g\.grade\.name\} —\s+\$\{g\.name\}/g, '${g.grade.name} — ${g.name}');
content = content.replace(/\{student\.group\.grade\?\.name\} —\s+\{student\.group\.name\}/g, '{student.group.grade?.name} — {student.group.name}');
content = content.replace(/Directorio de Evaluaciones —\s+\{selectedPeriod\}/g, 'Directorio de Evaluaciones — {selectedPeriod}');
content = content.replace(/SABER —\s+Tarea/g, 'SABER — Tarea');
content = content.replace(/SABER —\s+Examen/g, 'SABER — Examen');
content = content.replace(/` —\s+\$\{cat\.sublabel\}`/g, '` — ${cat.sublabel}`');
content = content.replace(/Visible para alumnos —\s+clic para ocultar/g, 'Visible para alumnos — clic para ocultar');
content = content.replace(/Oculto para alumnos —\s+clic para activar/g, 'Oculto para alumnos — clic para activar');
content = content.replace(/placeholder="—\s*"/g, 'placeholder="—"');
content = content.replace(/: "—\s*"/g, ': "—"');
content = content.replace(/value: selectedCourse\?\.name \?\? "—\s*"/g, 'value: selectedCourse?.name ?? "—"');
content = content.replace(/<span>—\s*<\/span>/g, '<span>—</span>');
content = content.replace(/<span className="text-gray-400 font-bold">—\s*<\/span>/g, '<span className="text-gray-400 font-bold">—</span>');
content = content.replace(/<th key=\{`\$\{cat\.type\}-empty`\} className="border border-gray-200 dark:border-gray-700 p-1 font-normal italic text-gray-400" style=\{\{ width: "56px", minWidth: "56px" \}\}>—\s*<\/th>/g, '<th key={`${cat.type}-empty`} className="border border-gray-200 dark:border-gray-700 p-1 font-normal italic text-gray-400" style={{ width: "56px", minWidth: "56px" }}>—</th>');

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Fixed ctrl chars.');
