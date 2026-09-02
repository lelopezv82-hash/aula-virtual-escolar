const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'scratch' || f === '.system_generated') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(tsx?|jsx?|json|html|css|md|prisma)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (/[\uFFFD]/.test(line)) {
          console.log(`[FFFD] ${full}:${idx + 1}: ${line.trim().slice(0, 100)}`);
        }
        if (/Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã‘|Ã |Ã‰|Ã |Ã“|Ãš|Â¿|Â¡|â€“|â€”|â€¦|â€œ|â€|âœ|ðŸ/.test(line)) {
          console.log(`[MOJI] ${full}:${idx + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
  }
}

scanDir('.');
