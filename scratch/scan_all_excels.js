const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const os = require('os');

const downloads = path.join(os.homedir(), 'Downloads');
const files = fs.readdirSync(downloads).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'));

files.forEach(f => {
  const p = path.join(downloads, f);
  const stats = fs.statSync(p);
  console.log(`\n========================================`);
  console.log(`ARCHIVO: ${f} (modificado: ${stats.mtime})`);
  try {
    const wb = XLSX.readFile(p);
    wb.SheetNames.forEach(s => {
      console.log(`-- Sheet: ${s} --`);
      const data = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1 });
      data.slice(0, 15).forEach((row, i) => {
        if (row && row.length > 0) console.log(`  Row ${i+1}:`, JSON.stringify(row.slice(0, 10)));
      });
    });
  } catch (e) {
    console.error('Error reading', f, e.message);
  }
});
