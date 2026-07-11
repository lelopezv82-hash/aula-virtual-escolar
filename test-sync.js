const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
require('dotenv').config();

const prisma = new PrismaClient();

async function getGoogleAccessToken(teacherId) {
  const accounts = await prisma.googleDriveAccount.findMany({
    where: { userId: teacherId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (accounts.length === 0) return null;

  // For testing, just return the first access token directly
  return accounts[0].googleAccessToken;
}

// download function using node-fetch (Next.js has fetch globally, but node 18+ has it too)
async function downloadDriveFile(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,name,modifiedTime`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Failed metadata: ${res.statusText}`);
  }
  const meta = await res.json();
  console.log(`File: "${meta.name}" [MIME: ${meta.mimeType}] [Modified: ${meta.modifiedTime}]`);
  
  const isNative = meta.mimeType === 'application/vnd.google-apps.spreadsheet';
  const downloadUrl = isNative
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!downloadRes.ok) {
    throw new Error(`Failed download Alt=${isNative}: ${downloadRes.statusText}`);
  }
  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function normalizeName(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function detectGroupColumns(rows) {
  let saberStart = 2, hacerStart = 7, serStart = 18;
  let saberSlots = 4, hacerSlots = 10, serSlots = 3;

  const scanRows = Math.min(rows.length, 12);
  const keywords = { saber: -1, hacer: -1, ser: -1 };

  for (let r = 0; r < scanRows; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (keywords.saber === -1 && cell.includes('saber')) keywords.saber = c;
      if (keywords.hacer === -1 && cell.includes('hacer')) keywords.hacer = c;
      if (keywords.ser === -1 && (cell === 'ser' || cell.startsWith('ser '))) keywords.ser = c;
    }
    if (keywords.saber !== -1 && keywords.hacer !== -1 && keywords.ser !== -1) break;
  }

  if (keywords.saber !== -1) saberStart = keywords.saber;
  if (keywords.hacer !== -1) hacerStart = keywords.hacer;
  if (keywords.ser !== -1) serStart = keywords.ser;

  if (keywords.saber !== -1 && keywords.hacer !== -1)
    saberSlots = Math.max(1, hacerStart - saberStart);
  if (keywords.hacer !== -1 && keywords.ser !== -1)
    hacerSlots = Math.max(1, serStart - hacerStart);

  return { saberStart, saberSlots, hacerStart, hacerSlots, serStart, serSlots, keywords };
}

async function run() {
  try {
    const allCourses = await prisma.course.findMany();
    const courses = allCourses.filter(c => c.gDriveSyncFiles !== null && c.gDriveSyncFiles !== undefined);

    console.log(`Found ${courses.length} courses with Drive files.`);

    for (const course of courses) {
      console.log(`\n--------------------------------------------`);
      console.log(`Course: "${course.name}" (ID: ${course.id})`);
      const syncFiles = course.gDriveSyncFiles || {};
      
      for (const [period, fileEntry] of Object.entries(syncFiles)) {
        console.log(`\nPeriod: "${period}"`);
        let fileId = typeof fileEntry === 'object' ? fileEntry.fileId : fileEntry;
        console.log(`File ID: ${fileId}`);
        
        const token = await getGoogleAccessToken(course.teacherId);
        if (!token) {
          console.log(`No token found for teacher ID: ${course.teacherId}`);
          continue;
        }

        try {
          const buffer = await downloadDriveFile(token, fileId);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          console.log("Workbook Sheet Names:", workbook.SheetNames);
          const sheetName = workbook.SheetNames[0];
          const ws = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          console.log(`Parsed ${rows.length} rows.`);
          if (rows.length < 5) {
            console.log(`Too few rows.`);
            continue;
          }

          // Let's print the first 12 rows' first 20 cells
          console.log("\n--- FIRST 12 ROWS ---");
          for (let i = 0; i < Math.min(12, rows.length); i++) {
            const cells = (rows[i] || []).slice(0, 30).map(c => String(c || '').trim());
            console.log(`Row ${i}:`, JSON.stringify(cells));
          }

          // Check if simple format or official format
          const firstRow = rows[0];
          if (firstRow && firstRow[0] === "STUDENT_ID" && firstRow[1] === "STUDENT_NAME") {
            console.log("Detected Simple Format.");
          } else {
            console.log("Detected Official/Custom Format.");
            let headerRowIndex = -1;
            for (let r = 0; r < Math.min(rows.length, 15); r++) {
              if (rows[r] && rows[r][1] && String(rows[r][1]).toLowerCase().includes("nombre completo")) {
                headerRowIndex = r;
                break;
              }
            }
            console.log(`Detected headerRowIndex: ${headerRowIndex}`);
            if (headerRowIndex !== -1) {
              const cols = detectGroupColumns(rows);
              console.log("Detected column ranges:", cols);
              
              // Let's try to match a few students
              const dbStudents = await prisma.user.findMany({
                where: { role: 'STUDENT' }, // this might be simple, let's check course students
                select: { id: true, name: true }
              });
              console.log(`Found ${dbStudents.length} total students in DB.`);
              
              let matchedCount = 0;
              for (let i = headerRowIndex + 1; i < Math.min(rows.length, headerRowIndex + 10); i++) {
                const row = rows[i];
                if (!row) continue;
                const studentNameInExcel = String(row[1] || '').trim();
                if (!studentNameInExcel) continue;
                const excelNorm = normalizeName(studentNameInExcel);
                
                const matched = dbStudents.find(s => {
                  const dn = normalizeName(s.name);
                  return dn === excelNorm || dn.includes(excelNorm) || excelNorm.includes(dn);
                });
                console.log(`Row ${i}: "${studentNameInExcel}" -> Normalized: "${excelNorm}" -> Matched: ${matched ? `"${matched.name}"` : 'NONE'}`);
                if (matched) matchedCount++;
              }
            }
          }
        } catch (err) {
          console.error(`Error processing file:`, err);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
