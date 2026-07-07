const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

// IDs de todos los archivos duplicados a eliminar (excepto el que vamos a conservar)
const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const COURSE_ID = '8b7f656a-8d63-4f11-825a-f2fd05cf9140';
const PERIOD = 'Periodo 1';

// Todos los IDs de archivos duplicados en el Drive del docente
const ALL_FILE_IDS = [
  '1mAM7GKDDgnEREbHW4IplvGIJFZmvXDrH',
  '1ncU0jPPa2pNMs2C4Jy1y1E8GI1Oye3Yn',
  '1s1lh9qMfOpWpVGBdinKvSA0_XHFf_QiT',
  '1TNxpM1C6SSS9AEKN0OSYGaqK_bsutR05',
  '1f6aOf1ahijOlCHrYF-1YSILHGQHkZBjF',
  '1K9IJaY-pVVDJBp84LVVOSQ2w1Sq0baCr'
];

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
  return token;
}

async function generateSyncFileFromDB(token, accountId) {
  // Get all students in the course
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
      if (!studentMap.has(student.id)) {
        const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
        studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel });
      }
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
        select: { studentId: true, grade: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const saberTasks = tasks.filter(t => t.type === 'EXAM');
  const hacerTasks = tasks.filter(t => t.type === 'TASK');
  const serTasks = tasks.filter(t => t.type === 'SER');
  const finalTasks = tasks.filter(t => t.type === 'FINAL');
  const attendTasks = tasks.filter(t => t.type === 'ATTEND');

  let counter = 1;
  const taskNumbers = {};
  [...saberTasks, ...hacerTasks, ...serTasks, ...finalTasks, ...attendTasks].forEach(t => taskNumbers[t.id] = counter++);

  const activeTasks = [...saberTasks, ...hacerTasks, ...serTasks, ...finalTasks, ...attendTasks];

  const row1 = ['STUDENT_ID', 'STUDENT_NAME', 'GROUP', ...activeTasks.map(t => t.id)];
  const row2 = ['ID Estudiante', 'Nombre Completo', 'Grupo', ...activeTasks.map(t => {
    const cat = t.type === 'EXAM' ? 'SABER' : t.type === 'TASK' ? 'HACER' : t.type === 'SER' ? 'SER' : t.type === 'FINAL' ? 'EXAMEN FINAL' : 'ASISTENCIA';
    return `${cat} ${taskNumbers[t.id]} - ${t.title}`;
  })];

  const dataRows = [row1, row2];
  students.forEach(student => {
    const row = [student.id, student.name, student.groupName];
    activeTasks.forEach(t => {
      const sub = t.submissions.find(s => s.studentId === student.id);
      row.push(sub && sub.grade !== null && sub.grade !== undefined ? sub.grade.toFixed(1) : '');
    });
    dataRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!rows'] = [{ hidden: true }];
  ws['!cols'] = Array.from({ length: row2.length }, () => ({ wch: 15 }));
  ws['!cols'][0] = { wch: 25 };
  ws['!cols'][1] = { wch: 30 };
  ws['!cols'][2] = { wch: 15 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Upload as a new file
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Sincro_Planilla_fisica_${PERIOD}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  });

  if (!metaRes.ok) throw new Error(`Create file metadata failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  const newFileId = meta.id;

  // Upload content
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media&fields=id,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      body: buffer
    }
  );
  if (!uploadRes.ok) throw new Error(`Upload content failed: ${uploadRes.status}`);
  const uploadData = await uploadRes.json();

  return { fileId: newFileId, webViewLink: meta.webViewLink || '' };
}

async function main() {
  console.log('Getting token...');
  const token = await getToken();

  // Delete all duplicate files
  console.log('\nDeleting all duplicate files...');
  for (const fileId of ALL_FILE_IDS) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 204) {
      console.log(`  ✓ Deleted: ${fileId}`);
    } else {
      console.log(`  ✗ Could not delete ${fileId}: HTTP ${res.status}`);
    }
  }

  // Create a fresh sync file from DB
  console.log('\nCreating fresh sync file from current DB grades...');
  const { fileId: newFileId, webViewLink } = await generateSyncFileFromDB(token, ACCOUNT_ID);
  console.log(`  ✓ Created new file: ${newFileId}`);
  console.log(`  Link: ${webViewLink}`);

  // Update DB to point to the new file
  const course = await prisma.course.findUnique({
    where: { id: COURSE_ID },
    select: { gDriveSyncFiles: true }
  });
  const existingSync = course.gDriveSyncFiles || {};
  await prisma.course.update({
    where: { id: COURSE_ID },
    data: {
      gDriveSyncFiles: {
        ...existingSync,
        [PERIOD]: {
          fileId: newFileId,
          accountId: ACCOUNT_ID
        }
      }
    }
  });
  console.log(`  ✓ DB updated to point to new file: ${newFileId}`);
  console.log('\nDone! Now you have a single clean file in Drive.');
  console.log(`Open it here: ${webViewLink}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
