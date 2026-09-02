const fs = require('fs');

const content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (/[\uFFFD]/.test(line)) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
