const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';
const lines = content.split(/\r?\n/);

// Find line index of '{/* Gestionar tarea o examen directamente */}'
const idx = lines.findIndex(l => l.includes('{/* Gestionar tarea o examen directamente */}'));
console.log('Found target at line index:', idx);

if (idx === -1) {
  console.error('Target comment not found!');
  process.exit(1);
}

// Target goes from idx to idx + 13 (line with ')}' closing {!t.isExternal && ( ... )})
const beforeLines = lines.slice(0, idx);
const afterLines = lines.slice(idx + 14);

const newReplacementLines = [
  '                    {/* Gestionar examen directamente (solo para exámenes) */}',
  '                    {!t.isExternal && (t.type === "EXAM" || t.type === "FINAL") && (',
  '                      <button',
  '                        onClick={() => openQuestionsModal(t)}',
  '                        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors w-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"',
  '                        title="Gestionar preguntas, entregas e intentos"',
  '                      >',
  '                        Gestionar Examen',
  '                      </button>',
  '                    )}'
];

const newContent = [...beforeLines, ...newReplacementLines, ...afterLines].join(eol);
fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', newContent, 'utf8');
console.log('Successfully updated PlanillasClient.tsx using line slicing!');
