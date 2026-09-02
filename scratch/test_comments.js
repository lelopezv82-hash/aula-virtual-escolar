const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const wsData = [
  ["No.", "Nombre", 1, 2],
  [1, "Juan Perez", 4.5, 3.8]
];

const ws = XLSX.utils.aoa_to_sheet(wsData);

// Add comment to C1 (row 0, col 2)
const c1Ref = XLSX.utils.encode_cell({ r: 0, c: 2 });
ws[c1Ref].c = [{ a: "Aula Virtual", t: "Taller conceptual sobre programación" }];

// Add comment to D1 (row 0, col 3)
const d1Ref = XLSX.utils.encode_cell({ r: 0, c: 3 });
ws[d1Ref].c = [{ a: "Aula Virtual", t: "Examen Saber 1" }];

XLSX.utils.book_append_sheet(wb, ws, "Test");
XLSX.writeFile(wb, "scratch/test_comments.xlsx");
console.log("Successfully wrote test_comments.xlsx with comments!");
