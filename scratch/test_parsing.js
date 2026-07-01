const XLSX = require('xlsx');

// Mock state and functions
const CATEGORIES = [
  { type: "EXAM", label: "SABER" },
  { type: "TASK", label: "HACER" },
  { type: "SER", label: "SER" }
];
const taskNumbers = {
  "task-saber-1": 1,
  "task-saber-2": 2,
  "task-saber-3": 3,
  "task-hacer-1": 1,
  "task-hacer-2": 2,
  "task-ser-1": 1
};
const byType = (type) => {
  if (type === "EXAM") return [{ id: "task-saber-1", title: "examen 1" }, { id: "task-saber-2", title: "qq" }, { id: "task-saber-3", title: "qqq" }];
  if (type === "TASK") return [{ id: "task-hacer-1", title: "tarea 1" }, { id: "task-hacer-2", title: "tarea 2" }];
  if (type === "SER") return [{ id: "task-ser-1", title: "Autoevaluación" }];
  return [];
};
const showFinal = false;
const showAttend = false;

const colLetter = (idx) => {
  let s = "";
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

// Load file
const workbook = XLSX.readFile("./scratch/test_planilla.xlsx");
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Run detector to find headerIndex (should be 6 for Fila 7)
let headerIndex = 6; // hardcode for test

const targetRow = rows[headerIndex] || [];
const nextRow = rows[headerIndex + 1] || [];
const excelHeaders = [];
const maxLen = Math.max(targetRow.length, nextRow.length);
const isCategoryName = (str) => {
  const s = str.toLowerCase();
  return s.includes("saber") || s.includes("hacer") || s.includes("ser") || s.includes("final") || s.includes("asistencia") || s.includes("evalua") || s.includes("nota");
};

let lastCategoryHeader = "";
for (let idx = 0; idx < maxLen; idx++) {
  const val = targetRow[idx] ? String(targetRow[idx]).trim() : "";
  const isCat = val.toLowerCase().includes("saber") || val.toLowerCase().includes("hacer") || val.toLowerCase().includes("ser") || val.toLowerCase().includes("final") || val.toLowerCase().includes("asistencia");
  if (isCat) {
    lastCategoryHeader = val;
  } else if (val) {
    lastCategoryHeader = "";
  }

  const h = val || lastCategoryHeader;
  const sub = nextRow[idx] ? String(nextRow[idx]).trim() : "";
  
  let combined = "";
  if (h && sub) {
    if (h.toLowerCase() === sub.toLowerCase()) {
      combined = h;
    } else if (isCategoryName(h) && sub.length <= 12) {
      combined = `${h} - ${sub}`;
    } else {
      combined = h;
    }
  } else if (h) {
    combined = h;
  } else if (sub) {
    const isNoteLabel = /^[0-9a-zA-Z\s\-_#]{1,10}$/.test(sub);
    if (isNoteLabel) {
      combined = sub;
    } else {
      combined = colLetter(idx);
    }
  } else {
    combined = colLetter(idx);
  }
  excelHeaders.push(combined);
}

console.log("Excel Headers extracted:", excelHeaders);

// Auto-select student column
const studentColIdx = excelHeaders.findIndex(h => {
  if (!h) return false;
  const nh = h.toLowerCase();
  return nh.includes("nombre") || nh.includes("estudiante") || nh.includes("alumno") || nh.includes("estudiantes") || nh.includes("nombres") || nh.includes("completo");
});

// Auto-select mappings
const mappings = {};
CATEGORIES.forEach(cat => {
  const catTasks = byType(cat.type);
  catTasks.forEach(t => {
    const platformLabel = `${cat.label} ${taskNumbers[t.id]}`;
    const normLabel = platformLabel.toLowerCase();
    const normTitle = (t.title || "").toLowerCase();
    const numStr = String(taskNumbers[t.id]);

    const matchedIdx = excelHeaders.findIndex(h => {
      if (!h) return false;
      const nh = h.toLowerCase().trim();
      if (nh === "saber 30%" || nh === "hacer 50%" || nh === "ser 20%") return false;

      // Clean percentage to avoid "30%" matching digit "3"
      const nhClean = nh.replace(/\d+%/g, "");

      // Exact matches
      if (nh === normLabel || nh === normTitle || nh === numStr) return true;

      const categoryLabelForCheck = cat.type === "EXAM" ? "saber" : cat.type === "TASK" ? "hacer" : cat.type === "SER" ? "ser" : cat.type === "FINAL" ? "final" : "asistencia";
      const hasCategory = nhClean.includes(categoryLabelForCheck);
      const hasNum = nhClean.includes(` ${numStr}`) || nhClean.endsWith(`-${numStr}`) || nhClean.endsWith(` ${numStr}`) || nhClean.includes(`-${numStr}-`) || nhClean.includes(` ${numStr} `) || nhClean.endsWith(` - ${numStr}`);
      if (hasCategory && hasNum) return true;

      const mentionsOtherCategory = ["saber", "hacer", "ser", "final", "asistencia"].some(c => {
        if (c === categoryLabelForCheck) return false;
        return nhClean.includes(c);
      });
      
      if (!mentionsOtherCategory) {
        if (nhClean === numStr || nhClean === `nota ${numStr}` || nhClean === `nota_${numStr}` || nhClean.endsWith(` - ${numStr}`) || nhClean.endsWith(`-${numStr}`) || nhClean.endsWith(` ${numStr}`)) {
          return true;
        }
      }

      return nhClean.includes(normLabel) || nhClean.includes(normTitle) || normTitle.includes(nhClean);
    });

    mappings[t.id] = matchedIdx;
  });
});

console.log("Mappings:", mappings);
