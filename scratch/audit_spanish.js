const fs = require('fs');
const path = require('path');

const rules = [
  // Mojibake & corrupted
  { pattern: /[\uFFFD]/g, name: 'Replacement character (corrupted UTF-8)' },
  { pattern: /Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã‘|Ã |Ã‰|Ã |Ã“|Ãš|Â¿|Â¡|â€“|â€”|â€¦|â€œ|â€|âœ|ðŸ|Â/g, name: 'Mojibake UTF-8' },
  
  // Accents in Spanish text (avoid matching code identifiers/variables by checking common words in strings/UI)
  { pattern: /\bcalificacion\b/gi, fix: 'calificación' },
  { pattern: /\bcalificaciones\b/gi, fix: 'calificaciones' },
  { pattern: /\bevaluacion\b/gi, fix: 'evaluación' },
  { pattern: /\bevaluaciones\b/gi, fix: 'evaluaciones' },
  { pattern: /\bdescripcion\b/gi, fix: 'descripción' },
  { pattern: /\bdescripciones\b/gi, fix: 'descripciones' },
  { pattern: /\bobservacion\b/gi, fix: 'observación' },
  { pattern: /\bobservaciones\b/gi, fix: 'observaciones' },
  { pattern: /\bpublicacion\b/gi, fix: 'publicación' },
  { pattern: /\bconfiguracion\b/gi, fix: 'configuración' },
  { pattern: /\bcreacion\b/gi, fix: 'creación' },
  { pattern: /\bedicion\b/gi, fix: 'edición' },
  { pattern: /\bleccion\b/gi, fix: 'lección' },
  { pattern: /\blecciones\b/gi, fix: 'lecciones' },
  { pattern: /\bseccion\b/gi, fix: 'sección' },
  { pattern: /\bsecciones\b/gi, fix: 'secciones' },
  { pattern: /\batencion\b/gi, fix: 'atención' },
  { pattern: /\binformacion\b/gi, fix: 'información' },
  { pattern: /\baccion\b/gi, fix: 'acción' },
  { pattern: /\bacciones\b/gi, fix: 'acciones' },
  { pattern: /\bsesion\b/gi, fix: 'sesión' },
  { pattern: /\bsesiones\b/gi, fix: 'sesiones' },
  { pattern: /\bopcion\b/gi, fix: 'opción' },
  { pattern: /\bopciones\b/gi, fix: 'opciones' },
  { pattern: /\bsolucion\b/gi, fix: 'solución' },
  { pattern: /\bmodificacion\b/gi, fix: 'modificación' },
  { pattern: /\binstitucion\b/gi, fix: 'institución' },
  { pattern: /\bduracion\b/gi, fix: 'duración' },
  { pattern: /\bautenticacion\b/gi, fix: 'autenticación' },
  { pattern: /\bsincronizacion\b/gi, fix: 'sincronización' },
  { pattern: /\basignacion\b/gi, fix: 'asignación' },
  { pattern: /\bhabilitacion\b/gi, fix: 'habilitación' },
  { pattern: /\bnotificacion\b/gi, fix: 'notificación' },
  { pattern: /\bnotificaciones\b/gi, fix: 'notificaciones' },
  { pattern: /\bexamenes\b/gi, fix: 'exámenes' },
  { pattern: /\bultimo\b/gi, fix: 'último' },
  { pattern: /\bultima\b/gi, fix: 'última' },
  { pattern: /\bultimos\b/gi, fix: 'últimos' },
  { pattern: /\bultimas\b/gi, fix: 'últimas' },
  { pattern: /\bproximo\b/gi, fix: 'próximo' },
  { pattern: /\bproxima\b/gi, fix: 'próxima' },
  { pattern: /\bproximos\b/gi, fix: 'próximos' },
  { pattern: /\bproximas\b/gi, fix: 'próximas' },
  { pattern: /\bcodigo\b/gi, fix: 'código' },
  { pattern: /\bcodigos\b/gi, fix: 'códigos' },
  { pattern: /\bguias\b/gi, fix: 'guías' },
  { pattern: /\bpagina\b/gi, fix: 'página' },
  { pattern: /\bpaginas\b/gi, fix: 'páginas' },
  { pattern: /\btitulo\b/gi, fix: 'título' },
  { pattern: /\btitulos\b/gi, fix: 'títulos' },
  { pattern: /\bnumero\b/gi, fix: 'número' },
  { pattern: /\bnumeros\b/gi, fix: 'números' },
  { pattern: /\brubrica\b/gi, fix: 'rúbrica' },
  { pattern: /\brubricas\b/gi, fix: 'rúbricas' },
  { pattern: /\bprorroga\b/gi, fix: 'prórroga' },
  { pattern: /\bprorrogas\b/gi, fix: 'prórrogas' },
  { pattern: /\bbasico\b/gi, fix: 'básico' },
  { pattern: /\bdesempeno\b/gi, fix: 'desempeño' },
  { pattern: /\bdesempenos\b/gi, fix: 'desempeños' },
  { pattern: /\bano\b/gi, fix: 'año' },
  { pattern: /\banos\b/gi, fix: 'años' },
  { pattern: /\batras\b/gi, fix: 'atrás' },
  { pattern: /\bdespues\b/gi, fix: 'después' },
  { pattern: /\btambien\b/gi, fix: 'también' },
  { pattern: /\bademas\b/gi, fix: 'además' },
  { pattern: /\bningun\b/gi, fix: 'ningún' },
  { pattern: /\bsegun\b/gi, fix: 'según' },
  { pattern: /\bexito\b/gi, fix: 'éxito' },
  { pattern: /\bmultiple\b/gi, fix: 'múltiple' },
  { pattern: /\bmultiples\b/gi, fix: 'múltiples' },
  { pattern: /\blimite\b/gi, fix: 'límite' },
  { pattern: /\bvalido\b/gi, fix: 'válido' },
  { pattern: /\bvalida\b/gi, fix: 'válida' },
  { pattern: /\bfacil\b/gi, fix: 'fácil' },
  { pattern: /\bdificil\b/gi, fix: 'difícil' },
  { pattern: /\bautomatico\b/gi, fix: 'automático' },
  { pattern: /\bautomatica\b/gi, fix: 'automática' },
  { pattern: /\belectronico\b/gi, fix: 'electrónico' },
  { pattern: /\bmetodo\b/gi, fix: 'método' },
  { pattern: /\bmetodos\b/gi, fix: 'métodos' },
  { pattern: /\banalisis\b/gi, fix: 'análisis' },
  { pattern: /\blinea\b/gi, fix: 'línea' },
  { pattern: /\blineas\b/gi, fix: 'líneas' },
  { pattern: /\bterminos\b/gi, fix: 'términos' },
  { pattern: /\btermino\b/gi, fix: 'término' },
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileHits = [];
  lines.forEach((line, idx) => {
    // skip import lines or comments in code unless relevant
    if (line.trim().startsWith('import ') || line.trim().startsWith('export {') || line.trim().startsWith('// eslint')) return;
    for (const rule of rules) {
      const matches = line.match(rule.pattern);
      if (matches) {
        // filter out pure variable names/property names if not in string or JSX
        // Check if match is inside string quotes or JSX tags
        fileHits.push({ lineNum: idx + 1, text: line.trim(), match: matches[0], rule: rule.fix || rule.name });
      }
    }
  });
  if (fileHits.length > 0) {
    console.log(`\n=== FILE: ${filePath} (${fileHits.length} hits) ===`);
    fileHits.forEach(h => {
      console.log(`  Line ${h.lineNum}: [${h.match}] -> ${h.rule}`);
      console.log(`    ${h.text.slice(0, 120)}`);
    });
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (['node_modules', '.next', '.git', 'scratch', '.system_generated', 'dist', 'build'].includes(f)) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(tsx|jsx|ts|js|json)$/.test(f)) {
      scanFile(full);
    }
  }
}

scanDir('./app');
scanDir('./components');
