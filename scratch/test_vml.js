const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([["A", "B"], [1, 2]]);

// Case 1: normal array without hidden on the array
const c1 = [{ a: "Test", t: "Comment 1" }];
ws["A1"].c = c1;

// Case 2: array with hidden = true on the array itself AND inside item
const c2 = [{ a: "Test", t: "Comment 2", hidden: true }];
c2.hidden = true;
ws["B1"].c = c2;

XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

const fs = require('fs');
fs.writeFileSync('scratch/out.xlsx', out);

console.log("Written scratch/out.xlsx successfully!");
