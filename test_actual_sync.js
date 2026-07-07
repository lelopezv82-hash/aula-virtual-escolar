const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

const COURSE_ID = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
const PERIOD = 'Periodo 1';
const TEACHER_ID = 'teacher_default_id_placeholder'; // We'll query it from course
const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const FILE_ID = '1GzslwtZEG-e-dItXvDXfvlk9KKsMSDwz';

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
  console.log('Loading token...');
  const token = await getToken();

  console.log('Fetching course & student structure...');
  const course = await prisma.course.findUnique({
    where: { id: COURSE_ID },
    include: {
      groups: {
        include: {
          students: {
            where: { role: 'STUDENT' },
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
          },
          grade: { select: { name: true } }
        }
      }
    }
  });

  const studentMap = new Map();
  for (const group of course.groups) {
    for (const student of group.students) {
      studentMap.set(student.id, student);
    }
  }
  const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const studentIds = students.map(s => s.id);

  const tasks = await prisma.task.findMany({
    where: { courseId: COURSE_ID, active: true, period: PERIOD },
    select: { id: true, title: true, type: true }
  });

  console.log(`Downloading file from Drive: ${FILE_ID}...`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status}`);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  console.log(`Sheet rows loaded: ${rows.length}`);
  if (rows.length < 2) {
    console.log('Sheet too empty to parse.');
    return;
  }

  const metadataRow = rows[0];
  console.log('Detecting format...');
  if (metadataRow && metadataRow[0] === "STUDENT_ID" && metadataRow[1] === "STUDENT_NAME") {
    console.log('Format: SIMPLE');
    const taskIds = metadataRow.slice(3);
    const submissionsToUpsert = [];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const studentId = row[0];
      if (!studentId || typeof studentId !== 'string' || studentId === 'STUDENT_ID') continue;
      if (!studentMap.has(studentId)) continue;

      taskIds.forEach((taskId, index) => {
        if (!taskId) return;
        const colIndex = index + 3;
        const gradeVal = row[colIndex];
        if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
          const num = parseFloat(gradeVal);
          if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
            submissionsToUpsert.push({ studentId, taskId, grade: parseFloat(num.toFixed(1)) });
          }
        }
      });
    }

    console.log(`Submissions to upsert: ${submissionsToUpsert.length}`);
    if (submissionsToUpsert.length > 0) {
      console.log('Preview first 5 upserts:', submissionsToUpsert.slice(0, 5));
    }
  } else if (
    rows.length >= 9 &&
    rows[6] &&
    String(rows[6][1]).toLowerCase().includes("nombre completo")
  ) {
    console.log('Format: OFFICIAL');
    // Implement similar parser logic
  } else {
    console.log('Format: UNKNOWN');
    console.log('Row 0:', rows[0]);
    console.log('Row 6:', rows[6]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
