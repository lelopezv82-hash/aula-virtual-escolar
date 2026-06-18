const fs = require('fs');

const checkFile = (filepath) => {
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Ver Respuestas') || line.includes('Respuestas') || line.includes('unlockedAnswers') || line.includes('attempt')) {
      console.log(`${filepath}:${idx + 1}: ${line.trim()}`);
    }
  });
};

checkFile('app/estudiante/examenes/page.tsx');
checkFile('app/estudiante/calificaciones/page.tsx');
