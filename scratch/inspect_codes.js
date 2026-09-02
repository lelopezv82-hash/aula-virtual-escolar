const fs = require('fs');

const content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (/[\uFFFD]/.test(line)) {
    const codes = [];
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code === 0xFFFD || code > 127) {
        codes.push(`pos ${i}: 0x${code.toString(16)} ('${line[i]}')`);
      }
    }
    console.log(`L${idx + 1}: ${codes.join(', ')}`);
    console.log(`   Text: ${line.trim()}`);
  }
});
