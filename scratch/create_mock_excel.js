const XLSX = require('xlsx');

// Create sheet data
const data = [
  ["INSTITUCION EDUCATIVA MOCK"],
  [],
  [],
  [],
  [],
  [],
  ["No.", "NOMBRE COMPLETO", "SABER 30%", "", "", "HACER 50%", "", "SER 20%"],
  ["", "", "1", "2", "3", "1", "2", "1"],
  ["1", "hector jimenez", "4.5", "3.8", "4.2", "3.5", "4.0", "4.8"],
  ["2", "jose meleguindo", "3.0", "3.2", "3.5", "4.0", "3.8", "4.2"],
  ["3", "juan ascanio", "4.0", "4.1", "4.2", "4.3", "4.4", "4.5"]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

// Define merges for Row 7 (index 6)
ws['!merges'] = [
  { s: { r: 6, c: 2 }, e: { r: 6, c: 4 } }, // SABER 30% spans C7-E7
  { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } }  // HACER 50% spans F7-G7
];

XLSX.utils.book_append_sheet(wb, ws, "Planilla");

XLSX.writeFile(wb, "./scratch/test_planilla.xlsx");
console.log("Mock Excel created successfully.");
