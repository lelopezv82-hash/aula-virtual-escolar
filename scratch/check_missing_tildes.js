const fs = require('fs');
const path = require('path');

// Target common Spanish words without tildes that appear in user-facing strings
const replacements = [
  { regex: /(>|['"`])([^<'"`]*?)\bcalificacion\b/gi, word: 'calificacion', fix: 'calificación' },
  { regex: /(>|['"`])([^<'"`]*?)\bcalificaciones\b/gi, word: 'calificaciones', fix: 'calificaciones' }, // usually has no tilde on plural, but checking
  { regex: /(>|['"`])([^<'"`]*?)\bevaluacion\b/gi, word: 'evaluacion', fix: 'evaluación' },
  { regex: /(>|['"`])([^<'"`]*?)\bdescripcion\b/gi, word: 'descripcion', fix: 'descripción' },
  { regex: /(>|['"`])([^<'"`]*?)\bobservacion\b/gi, word: 'observacion', fix: 'observación' },
  { regex: /(>|['"`])([^<'"`]*?)\bpublicacion\b/gi, word: 'publicacion', fix: 'publicación' },
  { regex: /(>|['"`])([^<'"`]*?)\bconfiguracion\b/gi, word: 'configuracion', fix: 'configuración' },
  { regex: /(>|['"`])([^<'"`]*?)\bcreacion\b/gi, word: 'creacion', fix: 'creación' },
  { regex: /(>|['"`])([^<'"`]*?)\bedicion\b/gi, word: 'edicion', fix: 'edición' },
  { regex: /(>|['"`])([^<'"`]*?)\bleccion\b/gi, word: 'leccion', fix: 'lección' },
  { regex: /(>|['"`])([^<'"`]*?)\bseccion\b/gi, word: 'seccion', fix: 'sección' },
  { regex: /(>|['"`])([^<'"`]*?)\batencion\b/gi, word: 'atencion', fix: 'atención' },
  { regex: /(>|['"`])([^<'"`]*?)\binformacion\b/gi, word: 'informacion', fix: 'información' },
  { regex: /(>|['"`])([^<'"`]*?)\baccion\b/gi, word: 'accion', fix: 'acción' },
  { regex: /(>|['"`])([^<'"`]*?)\bsesion\b/gi, word: 'sesion', fix: 'sesión' },
  { regex: /(>|['"`])([^<'"`]*?)\bopcion\b/gi, word: 'opcion', fix: 'opción' },
  { regex: /(>|['"`])([^<'"`]*?)\bsolucion\b/gi, word: 'solucion', fix: 'solución' },
  { regex: /(>|['"`])([^<'"`]*?)\bmodificacion\b/gi, word: 'modificacion', fix: 'modificación' },
  { regex: /(>|['"`])([^<'"`]*?)\binstitucion\b/gi, word: 'institucion', fix: 'institución' },
  { regex: /(>|['"`])([^<'"`]*?)\bduracion\b/gi, word: 'duracion', fix: 'duración' },
  { regex: /(>|['"`])([^<'"`]*?)\bautenticacion\b/gi, word: 'autenticacion', fix: 'autenticación' },
  { regex: /(>|['"`])([^<'"`]*?)\bsincronizacion\b/gi, word: 'sincronizacion', fix: 'sincronización' },
  { regex: /(>|['"`])([^<'"`]*?)\basignacion\b/gi, word: 'asignacion', fix: 'asignación' },
  { regex: /(>|['"`])([^<'"`]*?)\bhabilitacion\b/gi, word: 'habilitacion', fix: 'habilitación' },
  { regex: /(>|['"`])([^<'"`]*?)\bnotificacion\b/gi, word: 'notificacion', fix: 'notificación' },
  { regex: /(>|['"`])([^<'"`]*?)\bexamenes\b/gi, word: 'examenes', fix: 'exámenes' },
  { regex: /(>|['"`])([^<'"`]*?)\bultimo\b/gi, word: 'ultimo', fix: 'último' },
  { regex: /(>|['"`])([^<'"`]*?)\bultima\b/gi, word: 'ultima', fix: 'última' },
  { regex: /(>|['"`])([^<'"`]*?)\bultimos\b/gi, word: 'ultimos', fix: 'últimos' },
  { regex: /(>|['"`])([^<'"`]*?)\bultimas\b/gi, word: 'ultimas', fix: 'últimas' },
  { regex: /(>|['"`])([^<'"`]*?)\bproximo\b/gi, word: 'proximo', fix: 'próximo' },
  { regex: /(>|['"`])([^<'"`]*?)\bproxima\b/gi, word: 'proxima', fix: 'próxima' },
  { regex: /(>|['"`])([^<'"`]*?)\bproximos\b/gi, word: 'proximos', fix: 'próximos' },
  { regex: /(>|['"`])([^<'"`]*?)\bproximas\b/gi, word: 'proximas', fix: 'próximas' },
  { regex: /(>|['"`])([^<'"`]*?)\bcodigo\b/gi, word: 'codigo', fix: 'código' },
  { regex: /(>|['"`])([^<'"`]*?)\bcodigos\b/gi, word: 'codigos', fix: 'códigos' },
  { regex: /(>|['"`])([^<'"`]*?)\bguias\b/gi, word: 'guias', fix: 'guías' },
  { regex: /(>|['"`])([^<'"`]*?)\bpagina\b/gi, word: 'pagina', fix: 'página' },
  { regex: /(>|['"`])([^<'"`]*?)\bpaginas\b/gi, word: 'paginas', fix: 'páginas' },
  { regex: /(>|['"`])([^<'"`]*?)\btitulo\b/gi, word: 'titulo', fix: 'título' },
  { regex: /(>|['"`])([^<'"`]*?)\btitulos\b/gi, word: 'titulos', fix: 'títulos' },
  { regex: /(>|['"`])([^<'"`]*?)\bnumero\b/gi, word: 'numero', fix: 'número' },
  { regex: /(>|['"`])([^<'"`]*?)\bnumeros\b/gi, word: 'numeros', fix: 'números' },
  { regex: /(>|['"`])([^<'"`]*?)\brubrica\b/gi, word: 'rubrica', fix: 'rúbrica' },
  { regex: /(>|['"`])([^<'"`]*?)\brubricas\b/gi, word: 'rubricas', fix: 'rúbricas' },
  { regex: /(>|['"`])([^<'"`]*?)\bprorroga\b/gi, word: 'prorroga', fix: 'prórroga' },
  { regex: /(>|['"`])([^<'"`]*?)\bprorrogas\b/gi, word: 'prorrogas', fix: 'prórrogas' },
  { regex: /(>|['"`])([^<'"`]*?)\bbasico\b/gi, word: 'basico', fix: 'básico' },
  { regex: /(>|['"`])([^<'"`]*?)\bdesempeno\b/gi, word: 'desempeno', fix: 'desempeño' },
  { regex: /(>|['"`])([^<'"`]*?)\bdesempenos\b/gi, word: 'desempenos', fix: 'desempeños' },
  { regex: /(>|['"`])([^<'"`]*?)\batras\b/gi, word: 'atras', fix: 'atrás' },
  { regex: /(>|['"`])([^<'"`]*?)\bdespues\b/gi, word: 'despues', fix: 'después' },
  { regex: /(>|['"`])([^<'"`]*?)\btambien\b/gi, word: 'tambien', fix: 'también' },
  { regex: /(>|['"`])([^<'"`]*?)\bademas\b/gi, word: 'ademas', fix: 'además' },
  { regex: /(>|['"`])([^<'"`]*?)\bningun\b/gi, word: 'ningun', fix: 'ningún' },
  { regex: /(>|['"`])([^<'"`]*?)\bsegun\b/gi, word: 'segun', fix: 'según' },
  { regex: /(>|['"`])([^<'"`]*?)\bexito\b/gi, word: 'exito', fix: 'éxito' },
  { regex: /(>|['"`])([^<'"`]*?)\bmultiple\b/gi, word: 'multiple', fix: 'múltiple' },
  { regex: /(>|['"`])([^<'"`]*?)\bmultiples\b/gi, word: 'multiples', fix: 'múltiples' },
  { regex: /(>|['"`])([^<'"`]*?)\blimite\b/gi, word: 'limite', fix: 'límite' },
  { regex: /(>|['"`])([^<'"`]*?)\bvalido\b/gi, word: 'valido', fix: 'válido' },
  { regex: /(>|['"`])([^<'"`]*?)\bvalida\b/gi, word: 'valida', fix: 'válida' },
  { regex: /(>|['"`])([^<'"`]*?)\bfacil\b/gi, word: 'facil', fix: 'fácil' },
  { regex: /(>|['"`])([^<'"`]*?)\bdificil\b/gi, word: 'dificil', fix: 'difícil' },
  { regex: /(>|['"`])([^<'"`]*?)\bautomatico\b/gi, word: 'automatico', fix: 'automático' },
  { regex: /(>|['"`])([^<'"`]*?)\bautomatica\b/gi, word: 'automatica', fix: 'automática' },
  { regex: /(>|['"`])([^<'"`]*?)\belectronico\b/gi, word: 'electronico', fix: 'electrónico' },
  { regex: /(>|['"`])([^<'"`]*?)\bmetodo\b/gi, word: 'metodo', fix: 'método' },
  { regex: /(>|['"`])([^<'"`]*?)\bmetodos\b/gi, word: 'metodos', fix: 'métodos' },
  { regex: /(>|['"`])([^<'"`]*?)\banalisis\b/gi, word: 'analisis', fix: 'análisis' },
  { regex: /(>|['"`])([^<'"`]*?)\blinea\b/gi, word: 'linea', fix: 'línea' },
  { regex: /(>|['"`])([^<'"`]*?)\blineas\b/gi, word: 'lineas', fix: 'líneas' },
  { regex: /(>|['"`])([^<'"`]*?)\bterminos\b/gi, word: 'terminos', fix: 'términos' },
  { regex: /(>|['"`])([^<'"`]*?)\btermino\b/gi, word: 'termino', fix: 'término' }
];

function checkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (['node_modules', '.next', '.git', 'scratch', '.system_generated', 'dist', 'build'].includes(f)) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      checkDir(full);
    } else if (/\.(tsx|jsx)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.trim().startsWith('import ') || line.trim().startsWith('//')) return;
        for (const item of replacements) {
          if (item.regex.test(line)) {
            // make sure it's not a URL path like /api/estudiante/configuracion or a variable name
            if (!line.includes(`/api/`) && !line.includes(`fetch(`) && !line.includes(`router.`) && !line.includes(`pathname.`)) {
              console.log(`[${f}:${idx + 1}] Misses tilde for '${item.fix}':`);
              console.log(`   ${line.trim()}`);
            }
          }
        }
      });
    }
  }
}

checkDir('./app');
checkDir('./components');
