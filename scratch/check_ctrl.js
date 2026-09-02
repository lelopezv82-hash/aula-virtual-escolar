const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (['node_modules', '.next', '.git', 'scratch', '.system_generated', 'dist', 'build'].includes(f)) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(tsx|jsx|ts|js|json|css|html|md)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // match non-printable control chars except \r, \t, \n
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(line)) {
          console.log(`[CTRL CHAR] ${full}:${idx + 1} -> ${line.trim()}`);
        }
      });
    }
  }
}

scanDir('./app');
scanDir('./components');
scanDir('./lib');
