const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

const filePath = path.join(os.homedir(), 'Downloads', '1102.xlsx');

try {
  const wb = XLSX.readFile(filePath);
  console.log('Hojas en 1102.xlsx:', wb.SheetNames);
  wb.SheetNames.forEach(sheetName => {
    console.log(`\n=== HOJA: ${sheetName} ===`);
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    data.slice(0, 40).forEach((row, i) => {
      if (row && row.length > 0) {
        console.log(`Fila ${i + 1}:`, JSON.stringify(row));
      }
    });
  });
} catch (e) {
  console.error('Error leyendo 1102.xlsx:', e);
}
