const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const FILE_ID = '1GzslwtZEG-e-dItXvDXfvlk9KKsMSDwz';
const COURSE_ID = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
const PERIOD = 'Periodo 1';

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
  console.log('1. Fetching token and current state...');
  const token = await getToken();

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
    select: { id: true, title: true, type: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Course: ${course.name}`);
  console.log(`Total students: ${students.length}`);
  console.log(`Total tasks: ${tasks.length}`);

  console.log('2. Downloading sheet from Google Drive...');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    if (rows[r] && rows[r][1] && String(rows[r][1]).toLowerCase().includes("nombre completo")) {
      headerRowIndex = r;
      break;
    }
  }

  console.log(`Header row index: ${headerRowIndex}`);

  if (headerRowIndex === -1) {
    console.log('Not official format.');
    return;
  }

  const saberTasksFilter = tasks.filter(t => t.type === "EXAM");
  const hacerTasksFilter = tasks.filter(t => t.type === "TASK");
  const serTasksFilter   = tasks.filter(t => t.type === "SER");

  const SABER_START = 2;  const SABER_SLOTS = 4;
  const HACER_START = 6;  const HACER_SLOTS = 10;
  const SER_START  = 16;  const SER_SLOTS   = 3;

  const submissionsToUpsert = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const studentNameInExcel = row[1];
    if (!studentNameInExcel || typeof studentNameInExcel !== "string") continue;

    const studentIndex = i - (headerRowIndex + 1);
    let student = students[studentIndex];

    const cleanExcelName = studentNameInExcel.toLowerCase().replace(/\s+/g, '');
    let cleanDbName = student ? student.name.toLowerCase().replace(/\s+/g, '') : '';
    
    if (!student || (!cleanExcelName.includes(cleanDbName) && !cleanDbName.includes(cleanExcelName))) {
      const foundStudent = students.find(s => {
        const sName = s.name.toLowerCase().replace(/\s+/g, '');
        return sName === cleanExcelName || sName.includes(cleanExcelName) || cleanExcelName.includes(sName);
      });
      if (!foundStudent) continue;
      student = foundStudent;
    }

    const studentId = student.id;

    // SABER
    for (let j = 0; j < SABER_SLOTS; j++) {
      const t = saberTasksFilter[j];
      if (!t) continue;
      const colIndex = SABER_START + j;
      let gradeVal = row[colIndex];
      if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
        // Handle comma decimal replacement
        if (typeof gradeVal === 'string') {
          gradeVal = gradeVal.replace(',', '.');
        }
        const num = parseFloat(gradeVal);
        if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
          submissionsToUpsert.push({ studentName: student.name, studentId, taskId: t.id, title: t.title, grade: parseFloat(num.toFixed(1)) });
        }
      }
    }

    // HACER
    for (let j = 0; j < HACER_SLOTS; j++) {
      const t = hacerTasksFilter[j];
      if (!t) continue;
      const colIndex = HACER_START + j;
      let gradeVal = row[colIndex];
      if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
        if (typeof gradeVal === 'string') {
          gradeVal = gradeVal.replace(',', '.');
        }
        const num = parseFloat(gradeVal);
        if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
          submissionsToUpsert.push({ studentName: student.name, studentId, taskId: t.id, title: t.title, grade: parseFloat(num.toFixed(1)) });
        }
      }
    }

    // SER
    for (let j = 0; j < SER_SLOTS; j++) {
      const t = serTasksFilter[j];
      if (!t) continue;
      const colIndex = SER_START + j;
      let gradeVal = row[colIndex];
      if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
        if (typeof gradeVal === 'string') {
          gradeVal = gradeVal.replace(',', '.');
        }
        const num = parseFloat(gradeVal);
        if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
          submissionsToUpsert.push({ studentName: student.name, studentId, taskId: t.id, title: t.title, grade: parseFloat(num.toFixed(1)) });
        }
      }
    }
  }

  console.log(`Submissions parsed from Excel sheet (total ${submissionsToUpsert.length}):`);
  submissionsToUpsert.forEach(s => {
    console.log(`  - Student: "${s.studentName}" | Task: "${s.title}" | Grade: ${s.grade}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
