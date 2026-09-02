const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

content = content.replace(/\{\/\*[\s\S]*?\*\/\}\s*───/g, (m) => {
  return m.replace(/\s*───$/, '');
});

// Clean up any double spaces in section comments
content = content.replace(/\/\/\s+───\s+/g, '// ─── ');

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Cleaned comment tails');
