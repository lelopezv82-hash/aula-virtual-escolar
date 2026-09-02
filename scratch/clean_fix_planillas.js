const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // If line contains \uFFFD, let's fix it cleanly
  if (line.includes('\uFFFD')) {
    // Check comments
    if (line.trim().startsWith('//') || line.trim().startsWith('{/*')) {
      line = line.replace(/[\uFFFD\s]+/g, ' ').replace(/\/\/\s+/, '// ─── ').replace(/\s+$/, ' ───');
      if (line.startsWith('{/*')) {
        line = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => {
          return m.replace(/[\uFFFD]+/g, '—');
        });
      }
      line = line.replace(/DESEMPE[\uFFFD\s]*O/g, 'DESEMPEÑO');
      line = line.replace(/INSTITUCI[\uFFFD\s]*N/g, 'INSTITUCIÓN');
    }

    // Replace specific patterns
    line = line.replace(/DESEMPE[\uFFFD\s]*O/g, 'DESEMPEÑO');
    line = line.replace(/INSTITUCI[\uFFFD\s]*N/g, 'INSTITUCIÓN');
    line = line.replace(/Consolidado\s*[\uFFFD\s]*/g, 'Consolidado — ');
    line = line.replace(/0[\uFFFD\s]*A,\s*25[\uFFFD\s]*Z,\s*26[\uFFFD\s]*AA\s*⬦/g, '0 → A, 25 → Z, 26 → AA …');
    line = line.replace(/`Grado \$\{activeGradeName\}\s*[\uFFFD\s]*Grupo \$\{activeGroupName\}`/g, '`Grado ${activeGradeName} — Grupo ${activeGroupName}`');
    line = line.replace(/\{catInfo\.label\}\s*\{catInfo\.sublabel\s*\?\s*`[\uFFFD\s]*\$\{catInfo\.sublabel\}`\s*:\s*""\}/g, '{catInfo.label} {catInfo.sublabel ? `— ${catInfo.sublabel}` : ""}');
    line = line.replace(/[\uFFFD]x[\}\s]*\s*\{groupGradeBadge\}/g, '🎓 {groupGradeBadge}');
    line = line.replace(/¡Guardado con\s*[\uFFFD\s]*0?xito!/g, '¡Guardado con éxito!');
    line = line.replace(/Calificación \(1[\uFFFD\s]*5\)/g, 'Calificación (1–5)');
    line = line.replace(/placeholder="[\uFFFD\s]*"/g, 'placeholder="—"');
    line = line.replace(/: "[\uFFFD\s]*"/g, ': "—"');
    line = line.replace(/>[\uFFFD\s]*</g, '>—<');
    line = line.replace(/"[\uFFFD\s]*"/g, '"—"');
    line = line.replace(/`\$\{g\.grade\.name\}\s*[\uFFFD\s]*\$\{g\.name\}`/g, '`${g.grade.name} — ${g.name}`');
    line = line.replace(/\{student\.group\.grade\?\.name\}\s*[\uFFFD\s]*\{student\.group\.name\}/g, '{student.group.grade?.name} — {student.group.name}');
    line = line.replace(/Directorio de Evaluaciones\s*[\uFFFD\s]*\{selectedPeriod\}/g, 'Directorio de Evaluaciones — {selectedPeriod}');
    line = line.replace(/"SABER\s*[\uFFFD\s]*Tarea"/g, '"SABER — Tarea"');
    line = line.replace(/"SABER\s*[\uFFFD\s]*Examen"/g, '"SABER — Examen"');
    line = line.replace(/`\s*[\uFFFD\s]*\$\{cat\.sublabel\}`/g, '` — ${cat.sublabel}`');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*Entrega en clase/g, '🏫 Entrega en clase');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*Entrega en plataforma/g, '💻 Entrega en plataforma');
    line = line.replace(/"Visible para alumnos\s*[\uFFFD\s]*clic para ocultar"/g, '"Visible para alumnos — clic para ocultar"');
    line = line.replace(/"Oculto para alumnos\s*[\uFFFD\s]*clic para activar"/g, '"Oculto para alumnos — clic para activar"');
    line = line.replace(/[\uFFFD]S[\uFFFD]?\s*Crear Desde Cero/g, '✨ Crear Desde Cero');
    line = line.replace(/[\uFFFD]x\s*9?\s*Clonar \/ Reutilizar Existente/g, '📋 Clonar / Reutilizar Existente');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*<strong>Clonación Limpia:<\/strong>/g, '💡 <strong>Clonación Limpia:</strong>');
    line = line.replace(/⬢\s*[\uFFFD]x\s*[\uFFFD]?\s*\$\{t\._count\.questions\}\s*preguntas/g, '⬢ 📝 ${t._count.questions} preguntas');
    line = line.replace(/[\uFFFD]x\s*Tarea \/ Taller \(Saber\)/g, '📝 Tarea / Taller (Saber)');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*Examen en Línea \(Saber\)/g, '🧠 Examen en Línea (Saber)');
    line = line.replace(/Descripci[\uFFFD]n/g, 'Descripción');
    line = line.replace(/evaluaci[\uFFFD]n/g, 'evaluación');
    line = line.replace(/aqu[\uFFFD]/g, 'aquí');
    line = line.replace(/[\uFFFD]x\s*\}?\s*Guía adjunta actual/g, '📎 Guía adjunta actual');
    line = line.replace(/<span className="text-base">[\uFFFD]x\s*9?<\/span>/g, '<span className="text-base">1️⃣</span>');
    line = line.replace(/<span className="text-base">[\uFFFD]x\s*[\uFFFD]?<\/span>/g, '<span className="text-base">2️⃣</span>');
    line = line.replace(/<span>[\uFFFD]S&?<\/span>/g, '<span>✅</span>');
    line = line.replace(/<span>[\uFFFD]x\s*<\/span>/g, '<span>🔒</span>');
    line = line.replace(/<span>[\uFFFD]a[\uFFFD]?️?<\/span>/g, '<span>⚠️</span>');
    line = line.replace(/<span>[\uFFFD]x\s*[\uFFFD]?<\/span>/g, '<span>💡</span>');
    line = line.replace(/>[\uFFFD]x\s*[\uFFFD]?\s*Estudiantes encontrados/g, '>👥 Estudiantes encontrados');
    line = line.replace(/>[\uFFFD]S&?\s*Notas nuevas agregadas/g, '>✅ Notas nuevas agregadas');
    line = line.replace(/>[\uFFFD]x\s*Notas existentes protegidas/g, '>🔒 Notas existentes protegidas');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*Haz clic en <strong>/g, '💡 Haz clic en <strong>');
    line = line.replace(/Entendido\s*[\uFFFD]S?\s*/g, 'Entendido ✓');
    line = line.replace(/[\uFFFD]x\s*[\uFFFD]?\s*<strong>Actividad Original:<\/strong>/g, '💡 <strong>Actividad Original:</strong>');
    line = line.replace(/: "[\uFFFD]x\s*️?\s*Asignar Prórroga a Varios Estudiantes"/g, ': "📅 Asignar Prórroga a Varios Estudiantes"');
    line = line.replace(/Abrir en Drive\s*[\uFFFD\s]*/g, 'Abrir en Drive ↗ ');

    // Any remaining \uFFFD in strings/templates
    line = line.replace(/\uFFFD/g, '—');
  }

  lines[i] = line;
}

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', lines.join('\n'), 'utf8');
console.log('Fixed all lines.');
