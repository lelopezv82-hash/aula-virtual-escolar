const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const FILE_ID = '1GzslwtZEG-e-dItXvDXfvlk9KKsMSDwz';
const COURSE_ID = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
const PERIOD = 'Periodo 1';
const STUDENT_ID = '51e32186-679f-4ad0-91c9-9a95bb57176b'; // CASTRO ANGARITA MISAEL JOSE
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
  const token = await getToken();

  // 1. Update grade in DB to 5.0
  console.log('1. Setting Misael Jose\'s exam 1 grade to 5.0 in DB...');
  await prisma.submission.upsert({
    where: { taskId_studentId: { taskId: TASK_ID, studentId: STUDENT_ID } },
    update: { grade: 5.0, status: 'GRADED', updatedAt: new Date() },
    create: { taskId: TASK_ID, studentId: STUDENT_ID, grade: 5.0, status: 'GRADED' }
  });

  // 2. Perform the exact sync POST logic from app/api/docente/gdrive/sync/route.ts
  console.log('2. Running sync logic...');
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
    select: {
      id: true,
      title: true,
      type: true,
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true, status: true, grade: true, id: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('Downloading spreadsheet...');
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

  // A. Parse Excel grades and update DB
  console.log('Parsing Excel grades...');
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
        if (typeof gradeVal === 'string') {
          gradeVal = gradeVal.replace(',', '.');
        }
        const num = parseFloat(gradeVal);
        if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
          submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
        }
      }
    }
  }

  console.log(`Upserting ${submissionsToUpsert.length} parsed grades from Excel to DB...`);
  await prisma.$transaction(async (tx) => {
    for (const sub of submissionsToUpsert) {
      await tx.submission.upsert({
        where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
        update: { grade: sub.grade, status: 'GRADED', updatedAt: new Date() },
        create: { taskId: sub.taskId, studentId: sub.studentId, grade: sub.grade, status: 'GRADED' }
      });
    }
  });

  // B. Write DB grades back to Excel
  console.log('Writing DB grades back to Excel...');
  const freshTasks = await prisma.task.findMany({
    where: { courseId: COURSE_ID, active: true, period: PERIOD },
    select: {
      id: true,
      title: true,
      type: true,
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true, grade: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const freshSaberTasks = freshTasks.filter(t => t.type === "EXAM");
  const freshHacerTasks = freshTasks.filter(t => t.type === "TASK");
  const freshSerTasks   = freshTasks.filter(t => t.type === "SER");

  const studentRowMap = new Map();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const excelName = row[1];
    if (excelName && typeof excelName === 'string') {
      const cleanExcelName = excelName.toLowerCase().replace(/\s+/g, '');
      if (cleanExcelName.includes("nombrecompleto") || cleanExcelName.includes("nombrecom")) continue;

      const matchedStudent = students.find(s => {
        const cleanDbName = s.name.toLowerCase().replace(/\s+/g, '');
        return cleanDbName === cleanExcelName || cleanDbName.includes(cleanExcelName) || cleanExcelName.includes(cleanDbName);
      });

      if (matchedStudent) {
        studentRowMap.set(matchedStudent.id, r);
      }
    }
  }

  students.forEach((student) => {
    const rowIndex = studentRowMap.get(student.id);
    if (rowIndex === undefined) return;

    // SABER
    for (let j = 0; j < SABER_SLOTS; j++) {
      const t = freshSaberTasks[j];
      const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
      const val = sub && sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: SABER_START + j });
      if (val === "") {
        delete ws[cellRef];
      } else {
        ws[cellRef] = { t: 'n', v: val };
      }
    }
  });

  console.log('Uploading Excel back to Google Drive...');
  const newBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const patchRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${FILE_ID}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: newBuffer,
    }
  );
  if (!patchRes.ok) throw new Error(`Upload failed: ${patchRes.status}`);
  console.log('Excel uploaded back successfully!');

  // 3. Verification: Download spreadsheet again and check Misael Jose row
  console.log('3. Downloading Excel again to verify...');
  const verifyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const verifyBuffer = Buffer.from(await verifyRes.arrayBuffer());
  const verifyWb = XLSX.read(verifyBuffer, { type: 'buffer' });
  const verifyWs = verifyWb.Sheets[verifyWb.SheetNames[0]];
  const verifyRows = XLSX.utils.sheet_to_json(verifyWs, { header: 1 });

  const misaelRow = verifyRows[9]; // Row 10 (index 9)
  console.log('Misael Jose Row after sync:', JSON.stringify(misaelRow));
}

main().catch(console.error).finally(() => prisma.$disconnect());
