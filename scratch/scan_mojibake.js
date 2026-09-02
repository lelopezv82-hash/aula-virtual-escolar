const fs = require('fs');
const path = require('path');

const mojibakeRegex = /[\uFFFD]|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã‘|Ã |Ã‰|Ã |Ã“|Ãš|Â¿|Â¡|â€“|â€”|â€¦|â€œ|â€|âœ|ðŸ|Â/;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'scratch') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(tsx?|jsx?|json|html|css|md)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.match(mojibakeRegex);
      if (matches) {
        console.log('CORRUPTED:', full, 'matched:', matches[0]);
      }
    }
  }
}

scanDir('.');
