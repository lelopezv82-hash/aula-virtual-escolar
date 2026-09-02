const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');

content = content.replace(
  '  isExternal?: boolean;\n  dueDate?: string;',
  '  isExternal?: boolean;\n  description?: string;\n  dueDate?: string;'
);

content = content.replace(
  '  isExternal?: boolean;\r\n  dueDate?: string;',
  '  isExternal?: boolean;\r\n  description?: string;\r\n  dueDate?: string;'
);

fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', content, 'utf8');
console.log('Added description to TaskItem interface');
