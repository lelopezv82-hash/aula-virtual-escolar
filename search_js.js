const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

console.log('Searching for toUpperCase on charAt or name in .tsx and .ts files...');
walkDir('C:/Users/Estudiante/.gemini/antigravity/scratch/aula_virtual_escolar/app', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('toUpperCase') || content.includes('charAt')) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('toUpperCase') && (line.includes('charAt') || line.includes('name'))) {
          console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});

walkDir('C:/Users/Estudiante/.gemini/antigravity/scratch/aula_virtual_escolar/components', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('toUpperCase') || content.includes('charAt')) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('toUpperCase') && (line.includes('charAt') || line.includes('name'))) {
          console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
