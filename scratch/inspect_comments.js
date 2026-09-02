const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([["A", "B"], [1, 2]]);

ws["A1"].c = [{ a: "Test", t: "Comment default" }];
ws["B1"].c = [{ a: "Test", t: "Comment hidden true", hidden: true }];
ws["A2"].c = [{ a: "Test", t: "Comment hidden false", hidden: false }];

XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

// Let's check xlsx internals
console.log("Written successfully, length:", out.length);
