const fs = require('fs');
const content = fs.readFileSync('app/docente/contenido/ContenidoClient.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('Enlace del Examen') || line.includes('attachmentUrl') || line.includes('externalUrl')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
