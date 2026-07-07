const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

const COURSE_ID = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
const PERIOD = 'Periodo 1';
const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const FILE_ID = '1GzslwtZEG-e-dItXvDXfvlk9KKsMSDwz';
const STUDENT_ID = '51e32186-679f-4ad0-91c9-9a95bb57176b'; // Misael Jose
const TASK_ID = '68970e05-f287-4324-9973-3272c3d0149a'; // examen 1

async function getToken() {
  const account = await prisma.googleDriveAccount.findUnique({ where: { id: ACCOUNT_ID } });
  let token = account.googleAccessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (account.googleRefreshToken && clientId && clientSecret) {
    const resToken = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: account.googleRefreshToken, grant_type: 'refresh_token',
      }),
    });
    if (resToken.ok) { const d = await resToken.json(); token = d.access_token; }
  }
  return token;
}

async function main() {
  console.log('1. Loading token...');
  const token = await getToken();

  console.log('2. Downloading current file from Drive...');
  let res = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  let buffer = Buffer.from(await res.arrayBuffer());

  console.log('3. Modifying Misael Jose\'s exam 1 grade to 4.5 in memory...');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let misaelRowIndex = -1;
  for (let i = 2; i < rows.length; i++) {
    if (rows[i][0] === STUDENT_ID) {
      misaelRowIndex = i;
      break;
    }
  }

  if (misaelRowIndex === -1) {
    throw new Error('Misael Jose not found in sheet rows');
  }

  // Column 3 is exam 1
  const cellRef = XLSX.utils.encode_cell({ r: misaelRowIndex, c: 3 });
  ws[cellRef] = { t: 'n', v: 4.5 };

  console.log('4. Uploading edited sheet back to Drive...');
  const newEditBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const patchRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${FILE_ID}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: newEditBuffer,
    }
  );
  if (!patchRes.ok) throw new Error(`Upload failed: HTTP ${patchRes.status}`);
  console.log('   ✓ Edited sheet uploaded successfully to Drive.');

  // Now, we execute the sync POST logic to see if it processes and updates the DB
  console.log('5. Simulating sync POST parsing and DB update...');
  const syncRes = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const syncBuffer = Buffer.from(await syncRes.arrayBuffer());
  const syncWb = XLSX.read(syncBuffer, { type: 'buffer' });
  const syncWs = syncWb.Sheets[syncWb.SheetNames[0]];
  const syncRows = XLSX.utils.sheet_to_json(syncWs, { header: 1 });

  const metadataRow = syncRows[0];
  const taskIds = metadataRow.slice(3);
  const submissionsToUpsert = [];

  for (let i = 2; i < syncRows.length; i++) {
    const row = syncRows[i];
    if (!row || row.length === 0) continue;
    const studentId = row[0];
    if (!studentId || typeof studentId !== 'string' || studentId === 'STUDENT_ID') continue;

    taskIds.forEach((tId, index) => {
      if (!tId) return;
      const colIndex = index + 3;
      const gradeVal = row[colIndex];
      if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== '') {
        const num = parseFloat(gradeVal);
        if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
          submissionsToUpsert.push({ studentId, taskId: tId, grade: parseFloat(num.toFixed(1)) });
        }
      }
    });
  }

  console.log(`   ✓ Found ${submissionsToUpsert.length} grades in sheet. Updating database...`);
  
  // Database transaction update
  await prisma.$transaction(async (tx) => {
    for (const sub of submissionsToUpsert) {
      await tx.submission.upsert({
        where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
        update: { grade: sub.grade, status: 'GRADED', updatedAt: new Date() },
        create: { taskId: sub.taskId, studentId: sub.studentId, grade: sub.grade, status: 'GRADED' }
      });
    }
  }, {
    maxWait: 20000,
    timeout: 60000
  });
  console.log('   ✓ Database transaction complete.');

  // Verify the DB grade
  const sub = await prisma.submission.findUnique({
    where: { taskId_studentId: { taskId: TASK_ID, studentId: STUDENT_ID } }
  });
  console.log('\n6. Verification check:');
  console.log(`Misael Jose exam 1 grade in DB is now: ${sub?.grade} (expected: 4.5)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
