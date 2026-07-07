const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

async function main() {
  const courseId = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
  const period = 'Periodo 1';
  const teacherId = '1b0ca9fb-0730-4aba-9b7d-7957aae3ca16';
  const accountId = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';

  console.log('--- STARTING SYNC SIMULATION ---');

  // 1. Get Token
  const account = await prisma.googleDriveAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');
  let token = account.googleAccessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (account.googleRefreshToken && clientId && clientSecret) {
    const resToken = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.googleRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (resToken.ok) {
      const data = await resToken.json();
      token = data.access_token;
    }
  }
  console.log('Token resolved successfully');

  // 2. Fetch Course details (same as route.ts)
  const course = await prisma.course.findUnique({
    where: { id: courseId },
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
      if (!studentMap.has(student.id)) {
        const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
        studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel });
      }
    }
  }
  const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const studentIds = students.map(s => s.id);

  // Fetch tasks
  const tasks = await prisma.task.findMany({
    where: { courseId, active: true, period },
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      duration: true,
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true, status: true, grade: true, id: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Loaded ${students.length} students and ${tasks.length} tasks`);

  // 3. Download active file
  const syncFiles = course.gDriveSyncFiles || {};
  const fileEntry = syncFiles[period];
  const fileId = '1mAM7GKDDgnEREbHW4IplvGIJFZmvXDrH';
  console.log(`Downloading file: ${fileId}`);
  
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!fileRes.ok) {
    throw new Error(`Download failed: ${fileRes.status} ${fileRes.statusText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  console.log(`Workbook sheets: ${JSON.stringify(workbook.SheetNames)}`);
  console.log(`Read ${rows.length} rows`);

  if (rows.length >= 2) {
    const metadataRow = rows[0];
    let isOfficialFormat = false;
    let submissionsToUpsert = [];
    let submissionsToDelete = [];

    // Format 1: Simple template
    if (metadataRow && metadataRow[0] === "STUDENT_ID" && metadataRow[1] === "STUDENT_NAME") {
      console.log('Format detected: Simple format');
      const taskIds = metadataRow.slice(3);
      console.log('Task IDs in sheet:', taskIds);

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const studentId = row[0];
        if (!studentId || typeof studentId !== "string" || studentId === "STUDENT_ID") continue;

        if (!studentMap.has(studentId)) {
          console.log(`Student ID ${studentId} not in course map`);
          continue;
        }

        taskIds.forEach((taskId, index) => {
          if (!taskId) return;
          const colIndex = index + 3;
          const gradeVal = row[colIndex];

          if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
            submissionsToDelete.push({ studentId, taskId });
          } else {
            const num = parseFloat(gradeVal);
            if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
              submissionsToUpsert.push({ studentId, taskId, grade: parseFloat(num.toFixed(1)) });
            }
          }
        });
      }
    }
    // Format 2: Official template
    else if (rows.length >= 9 && rows[6] && String(rows[6][1]).toLowerCase().includes("nombre completo")) {
      console.log('Format detected: Official format');
      isOfficialFormat = true;
      const saberTasksFilter = tasks.filter(t => t.type === "EXAM");
      const hacerTasksFilter = tasks.filter(t => t.type === "TASK");
      const serTasksFilter   = tasks.filter(t => t.type === "SER");

      const SABER_START = 2;  const SABER_SLOTS = 4;
      const HACER_START = 6;  const HACER_SLOTS = 10;
      const SER_START  = 16;  const SER_SLOTS   = 3;

      for (let i = 8; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const studentNameInExcel = row[1];
        if (!studentNameInExcel || typeof studentNameInExcel !== "string") continue;

        const studentIndex = i - 8;
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
          const gradeVal = row[colIndex];
          if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
            submissionsToDelete.push({ studentId, taskId: t.id });
          } else {
            const num = parseFloat(gradeVal);
            if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
              submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
            }
          }
        }

        // HACER
        for (let j = 0; j < HACER_SLOTS; j++) {
          const t = hacerTasksFilter[j];
          if (!t) continue;
          const colIndex = HACER_START + j;
          const gradeVal = row[colIndex];
          if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
            submissionsToDelete.push({ studentId, taskId: t.id });
          } else {
            const num = parseFloat(gradeVal);
            if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
              submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
            }
          }
        }

        // SER
        for (let j = 0; j < SER_SLOTS; j++) {
          const t = serTasksFilter[j];
          if (!t) continue;
          const colIndex = SER_START + j;
          const gradeVal = row[colIndex];
          if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
            submissionsToDelete.push({ studentId, taskId: t.id });
          } else {
            const num = parseFloat(gradeVal);
            if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
              submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
            }
          }
        }
      }
    } else {
      console.log('Format not recognized. Row 0:', JSON.stringify(rows[0]), 'Row 6:', rows[6] ? JSON.stringify(rows[6]) : 'undefined');
    }

    const misaelUpserts = submissionsToUpsert.filter(s => s.studentId === '51e32186-679f-4ad0-91c9-9a95bb57176b');
    console.log('Misael Jose upserts:', JSON.stringify(misaelUpserts));
    console.log('Submissions to upsert:', submissionsToUpsert.length, JSON.stringify(submissionsToUpsert.slice(0, 5)));
    console.log('Submissions to delete:', submissionsToDelete.length, JSON.stringify(submissionsToDelete.slice(0, 5)));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
