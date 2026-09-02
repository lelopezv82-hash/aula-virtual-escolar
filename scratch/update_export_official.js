const fs = require('fs');

let content = fs.readFileSync('app/docente/planillas/PlanillasClient.tsx', 'utf8');
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';
const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('const exportToOfficialTemplate = () => {'));
const endIdx = lines.findIndex(l => l.includes('const exportToPDF = () => {'));

console.log('Found exportToOfficialTemplate at:', startIdx, 'to', endIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find exportToOfficialTemplate boundaries');
  process.exit(1);
}

const newExportFunction = `  const exportToOfficialTemplate = () => {
    // ─── Column layout (matches template image exactly) ───
    // A(0):  No.
    // B(1):  NOMBRE COMPLETO
    // C-F(2-5):   SABER 30%  4 slots
    // G-P(6-15):  HACER 50%  10 slots
    // Q-S(16-18): SER 20%    3 slots
    // T(19): DEF SABER  (formula)
    // U(20): DEF HACER  (formula)
    // V(21): DEF SER    (formula)
    // W(22): DEF final  (formula)
    // X(23): DESEMPEÑO (formula)
    const TOTAL_COLS = 24;
    const SABER_START = 2;  const SABER_SLOTS = 4;
    const HACER_START = 6;  const HACER_SLOTS = 10;
    const SER_START  = 16;  const SER_SLOTS   = 3;
    const COL_DEF_SABER = 19;
    const COL_DEF_HACER = 20;
    const COL_DEF_SER   = 21;
    const COL_DEF       = 22;
    const COL_DESEMP    = 23;

    const saberTasks = tasks.filter(t => t.type === "EXAM" || t.type === "TASK_SABER" || t.type === "SABER").slice(0, SABER_SLOTS);
    const hacerTasks = tasks.filter(t => t.type === "TASK").slice(0, HACER_SLOTS);
    const serTasks   = tasks.filter(t => t.type === "SER").slice(0, SER_SLOTS);

    const saberPct = (courseWeights?.saberPercent ?? 30) / 100;
    const hacerPct = (courseWeights?.hacerPercent ?? 50) / 100;
    const serPct   = (courseWeights?.serPercent   ?? 20) / 100;

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const gradeLabel = selectedGroup?.grade?.name
      ? \`\${selectedGroup.grade.name} - \${selectedGroup.name}\`
      : (selectedGroup?.name ?? "");

    // Helper: build empty row of TOTAL_COLS cells
    const emptyRow = () => Array<any>(TOTAL_COLS).fill("");

    // ─── Row 0: INSTITUCIÓN EDUCATIVA ───
    const r0 = emptyRow(); r0[0] = "INSTITUCIÓN EDUCATIVA";
    // ─── Row 1: School name ───
    const r1 = emptyRow(); r1[0] = "MONSEÑOR DÍAZ PLATA";
    // ─── Row 2: LISTADO DE DESEMPEÑO ───
    const r2 = emptyRow(); r2[0] = "LISTADO DE DESEMPEÑO 2026";
    // ─── Row 3: empty ───
    const r3 = emptyRow();
    // ─── Row 4: meta (DOCENTE / ASIGNATURA / GRADO / PERIODO) ───
    const r4 = emptyRow();
    r4[0]  = "DOCENTE:";   r4[1]  = teacherName;
    r4[4]  = "ASIGNATURA:"; r4[5]  = selectedCourse?.name ?? "";
    r4[11] = "GRADO:";     r4[12] = gradeLabel;
    r4[16] = "PERIODO:";   r4[17] = selectedPeriod;
    // ─── Row 5: empty ───
    const r5 = emptyRow();
    // ─── Row 6: category headers ───
    const r6 = emptyRow();
    r6[0]  = "No.";
    r6[1]  = "NOMBRE COMPLETO";
    r6[SABER_START] = \`SABER \${Math.round(saberPct * 100)}%\`;
    r6[HACER_START] = \`HACER \${Math.round(hacerPct * 100)}%\`;
    r6[SER_START]   = \`SER \${Math.round(serPct * 100)}%\`;
    r6[COL_DEF_SABER] = "DEF";
    r6[COL_DEF]     = "DEF";
    r6[COL_DESEMP]  = "DESEMPEÑO";
    // ─── Row 7: sub-column numbers ───
    const r7 = emptyRow();
    for (let j = 0; j < SABER_SLOTS; j++) r7[SABER_START + j] = j + 1;
    for (let j = 0; j < HACER_SLOTS; j++) r7[HACER_START + j] = j + 1;
    for (let j = 0; j < SER_SLOTS;   j++) r7[SER_START   + j] = j + 1;
    r7[COL_DEF_SABER] = "SABER";
    r7[COL_DEF_HACER] = "HACER";
    r7[COL_DEF_SER]   = "SER";

    // ─── Row 8: Activity Names for each column ───
    const r8 = emptyRow();
    r8[1] = "Nombre de la Actividad:";
    for (let j = 0; j < SABER_SLOTS; j++) {
      r8[SABER_START + j] = saberTasks[j]?.title ? saberTasks[j].title : "—";
    }
    for (let j = 0; j < HACER_SLOTS; j++) {
      r8[HACER_START + j] = hacerTasks[j]?.title ? hacerTasks[j].title : "—";
    }
    for (let j = 0; j < SER_SLOTS; j++) {
      r8[SER_START + j] = serTasks[j]?.title ? serTasks[j].title : "—";
    }

    const wsData: any[][] = [r0, r1, r2, r3, r4, r5, r6, r7, r8];

    // ─── Data rows start at Excel row 10 (1-indexed), index 9 ───
    const FIRST_DATA_EXCEL_ROW = 10;

    students.forEach((student, i) => {
      const grades = gradesGrid[student.id] || {};
      const excelRow = FIRST_DATA_EXCEL_ROW + i; // 1-indexed for formulas

      const row: any[] = [i + 1, student.name];

      // SABER slots
      for (let j = 0; j < SABER_SLOTS; j++) {
        const t = saberTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }
      // HACER slots
      for (let j = 0; j < HACER_SLOTS; j++) {
        const t = hacerTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }
      // SER slots
      for (let j = 0; j < SER_SLOTS; j++) {
        const t = serTasks[j];
        const v = t ? grades[t.id] : undefined;
        row.push(v ? parseFloat(v) : "");
      }

      // Excel column letters for formula references
      const sE = "C"; const sL = "F"; // SABER C:F
      const hE = "G"; const hL = "P"; // HACER G:P
      const aE = "Q"; const aL = "S"; // SER   Q:S
      const dS = "T"; const dH = "U"; const dA = "V"; const dF = "W";

      row.push({ t: "n", f: \`IFERROR(AVERAGE(\${sE}\${excelRow}:\${sL}\${excelRow})*\${saberPct},0)\` });
      row.push({ t: "n", f: \`IFERROR(AVERAGE(\${hE}\${excelRow}:\${hL}\${excelRow})*\${hacerPct},0)\` });
      row.push({ t: "n", f: \`IFERROR(AVERAGE(\${aE}\${excelRow}:\${aL}\${excelRow})*\${serPct},0)\` });
      row.push({ t: "n", f: \`IFERROR(\${dS}\${excelRow}+\${dH}\${excelRow}+\${dA}\${excelRow},0)\` });
      row.push({ t: "s", f: \`IF(\${dF}\${excelRow}=0,"",IF(\${dF}\${excelRow}>=4.6,"SUPERIOR",IF(\${dF}\${excelRow}>=4.0,"ALTO",IF(\${dF}\${excelRow}>=3.0,"BÁSICO","BAJO"))))\` });

      wsData.push(row);
    });

    // ─── Append Detalle de Actividades Legend below students ───
    const emptyRow1 = emptyRow();
    const legendHeader = emptyRow();
    legendHeader[0] = "DETALLE Y CONVENCIONES DE ACTIVIDADES EVALUATIVAS";

    const legendSubHeader = emptyRow();
    legendSubHeader[0] = "COL.";
    legendSubHeader[1] = "DIMENSIÓN";
    legendSubHeader[2] = "No.";
    legendSubHeader[3] = "NOMBRE DE LA ACTIVIDAD / EVALUACIÓN";
    legendSubHeader[12] = "MODALIDAD DE ENTREGA";
    legendSubHeader[18] = "FECHA LÍMITE";

    wsData.push(emptyRow1);
    wsData.push(legendHeader);
    wsData.push(legendSubHeader);

    // List all configured tasks
    const allConfiguredTasks = [
      ...saberTasks.map((t, idx) => ({ t, cat: "SABER", num: idx + 1, colLetter: String.fromCharCode(67 + idx) })),
      ...hacerTasks.map((t, idx) => ({ t, cat: "HACER", num: idx + 1, colLetter: String.fromCharCode(71 + idx) })),
      ...serTasks.map((t, idx) => ({ t, cat: "SER", num: idx + 1, colLetter: String.fromCharCode(81 + idx) })),
    ];

    allConfiguredTasks.forEach(item => {
      const row = emptyRow();
      row[0] = item.colLetter;
      row[1] = item.cat;
      row[2] = item.num;
      row[3] = item.t.title;
      row[12] = item.t.isExternal ? "Entrega en Clase (Física)" : "Entrega en Plataforma Virtual";
      row[18] = item.t.dueDate ? new Date(item.t.dueDate).toLocaleDateString('es-CO') : "Sin fecha límite";
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // ─── Column widths ───
    ws["!cols"] = [
      { wch: 5 },   // A: No.
      { wch: 32 },  // B: Nombre
      ...Array(SABER_SLOTS).fill(null).map(() => ({ wch: 14 })),  // C-F: Saber (expanded to show activity titles)
      ...Array(HACER_SLOTS).fill(null).map(() => ({ wch: 14 })),  // G-P: Hacer (expanded to show activity titles)
      ...Array(SER_SLOTS).fill(null).map(() => ({ wch: 14 })),    // Q-S: Ser (expanded to show activity titles)
      { wch: 10 }, { wch: 10 }, { wch: 10 },  // T-V: DEF sub
      { wch: 10 },  // W: DEF
      { wch: 13 },  // X: DESEMPEÑO
    ];

    // ─── Row heights ───
    ws["!rows"] = [
      { hpt: 18 }, // Row 1: Institution
      { hpt: 28 }, // Row 2: School name
      { hpt: 18 }, // Row 3: Listado
      { hpt: 10 }, // Row 4: empty
      { hpt: 20 }, // Row 5: meta
      { hpt: 10 }, // Row 6: empty
      { hpt: 28 }, // Row 7: category headers
      { hpt: 20 }, // Row 8: sub-numbers
      { hpt: 35 }, // Row 9: activity titles
    ];

    // ─── Cell merges ───
    const legendHeaderRowIndex = FIRST_DATA_EXCEL_ROW + students.length + 1;
    const legendSubHeaderRowIndex = legendHeaderRowIndex + 1;

    ws["!merges"] = [
      // Title rows
      { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } }, // INSTITUCIÓN
      { s: { r: 1, c: 0 }, e: { r: 1, c: TOTAL_COLS - 1 } }, // School name
      { s: { r: 2, c: 0 }, e: { r: 2, c: TOTAL_COLS - 1 } }, // Listado
      // Meta row
      { s: { r: 4, c: 1  }, e: { r: 4, c: 3  } },  // Teacher name value
      { s: { r: 4, c: 5  }, e: { r: 4, c: 10 } },  // Subject value
      { s: { r: 4, c: 12 }, e: { r: 4, c: 15 } },  // Grade value
      { s: { r: 4, c: 17 }, e: { r: 4, c: TOTAL_COLS - 1 } }, // Period value
      // Category header rows (rows 6..8)
      { s: { r: 6, c: 0 }, e: { r: 8, c: 0 } },  // No.
      { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } },  // NOMBRE COMPLETO
      { s: { r: 6, c: SABER_START }, e: { r: 6, c: SABER_START + SABER_SLOTS - 1 } }, // SABER
      { s: { r: 6, c: HACER_START }, e: { r: 6, c: HACER_START + HACER_SLOTS - 1 } }, // HACER
      { s: { r: 6, c: SER_START   }, e: { r: 6, c: SER_START   + SER_SLOTS   - 1 } }, // SER
      { s: { r: 6, c: COL_DEF_SABER }, e: { r: 6, c: COL_DEF_SER } }, // DEF (3 sub-cols)
      { s: { r: 6, c: COL_DEF    }, e: { r: 8, c: COL_DEF    } }, // DEF final spans 3 rows
      { s: { r: 6, c: COL_DESEMP }, e: { r: 8, c: COL_DESEMP } }, // DESEMPEÑO spans 3 rows
      // Legend section merges
      { s: { r: legendHeaderRowIndex, c: 0 }, e: { r: legendHeaderRowIndex, c: TOTAL_COLS - 1 } },
      { s: { r: legendSubHeaderRowIndex, c: 3 }, e: { r: legendSubHeaderRowIndex, c: 11 } },
      { s: { r: legendSubHeaderRowIndex, c: 12 }, e: { r: legendSubHeaderRowIndex, c: 17 } },
      { s: { r: legendSubHeaderRowIndex, c: 18 }, e: { r: legendSubHeaderRowIndex, c: TOTAL_COLS - 1 } },
    ];

    // Add row merges for each item in the legend table
    allConfiguredTasks.forEach((_, idx) => {
      const rIdx = legendSubHeaderRowIndex + 1 + idx;
      ws["!merges"]?.push(
        { s: { r: rIdx, c: 3 }, e: { r: rIdx, c: 11 } },
        { s: { r: rIdx, c: 12 }, e: { r: rIdx, c: 17 } },
        { s: { r: rIdx, c: 18 }, e: { r: rIdx, c: TOTAL_COLS - 1 } }
      );
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planilla Oficial");

    // ─── Sheet 2: Detalle Completo de Actividades ───
    const sheet2Data: any[][] = [
      ["INSTITUCIÓN EDUCATIVA MONSEÑOR DÍAZ PLATA"],
      [\`DETALLE DE ACTIVIDADES EVALUATIVAS - \${selectedPeriod.toUpperCase()}\`],
      [\`Docente: \${teacherName}\`, \`Asignatura: \${selectedCourse?.name ?? ""}\`, \`Grado/Grupo: \${gradeLabel}\`],
      [],
      ["#", "DIMENSIÓN", "COLUMNA", "TÍTULO DE LA ACTIVIDAD", "MODALIDAD", "TIPO", "FECHA LÍMITE", "DESCRIPCIÓN"],
    ];

    tasks.forEach((t, idx) => {
      sheet2Data.push([
        idx + 1,
        t.type === "EXAM" || t.type === "TASK_SABER" || t.type === "SABER" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type,
        taskNumbers[t.id] ?? (idx + 1),
        t.title,
        t.isExternal ? "Entrega en Clase" : "Entrega en Plataforma",
        t.type === "EXAM" ? "Examen / Cuestionario" : "Tarea / Taller",
        t.dueDate ? new Date(t.dueDate).toLocaleString('es-CO') : "Sin límite",
        t.description || "—"
      ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 10 },
      { wch: 38 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "Detalle Actividades");

    const safeName = (selectedCourse?.name ?? "").replace(/[\\\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, \`Planilla_Oficial_\${safeName}_\${selectedPeriod}.xlsx\`);
  };`;

const beforeLines = lines.slice(0, startIdx);
const afterLines = lines.slice(endIdx);

const newContent = [...beforeLines, newExportFunction, ...afterLines].join(eol);
fs.writeFileSync('app/docente/planillas/PlanillasClient.tsx', newContent, 'utf8');
console.log('Successfully updated exportToOfficialTemplate with activity names!');
