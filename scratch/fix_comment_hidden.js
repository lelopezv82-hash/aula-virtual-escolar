const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';
const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('// ─── Attach Excel Notes / Comments (Notas de Celda) on Column Number Headers'));
const endIdx = lines.findIndex(l => l.includes('// ─── Column widths ───'));

console.log('Found comment section at lines:', startIdx, 'to', endIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find comment section boundaries');
  process.exit(1);
}

const newCommentSection = `    // ─── Attach Excel Notes / Comments (Notas de Celda) on Column Number Headers (Row 8, index 7) ───
    const attachCellComment = (r: number, c: number, numVal: number, task: any) => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { t: "n", v: numVal };
      const commentText = \`Actividad: \${task.title}\\nModalidad: \${task.isExternal ? "Entrega en clase" : "Entrega en plataforma"}\${task.dueDate ? \`\\nFecha límite: \${new Date(task.dueDate).toLocaleDateString('es-CO')}\` : ""}\`;
      const commentArr: any = [{
        a: "Aula Virtual",
        t: commentText,
        hidden: true
      }];
      commentArr.hidden = true;
      ws[cellRef].c = commentArr;
    };

    for (let j = 0; j < SABER_SLOTS; j++) {
      const task = saberTasks[j];
      if (task) attachCellComment(7, SABER_START + j, j + 1, task);
    }
    for (let j = 0; j < HACER_SLOTS; j++) {
      const task = hacerTasks[j];
      if (task) attachCellComment(7, HACER_START + j, j + 1, task);
    }
    for (let j = 0; j < SER_SLOTS; j++) {
      const task = serTasks[j];
      if (task) attachCellComment(7, SER_START + j, j + 1, task);
    }`;

const beforeLines = lines.slice(0, startIdx);
const afterLines = lines.slice(endIdx);

const newContent = [...beforeLines, newCommentSection, ...afterLines].join(eol);
fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', newContent, 'utf8');
console.log('Successfully updated cell comments with hidden: true in PlanillasClient.tsx!');
