const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAccessToken() {
  const teacher = await prisma.user.findFirst({
    where: { googleRefreshToken: { not: null } }
  });
  const clientId = 'GOOGLE_CLIENT_ID_PLACEHOLDER';
  const clientSecret = 'GOOGLE_CLIENT_SECRET_PLACEHOLDER';

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: teacher.googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();

  // Query files modified on Aug 27, 2026
  let allFiles = [];
  let pageToken = null;
  do {
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,parents)&q=${encodeURIComponent("trashed = false and modifiedTime > '2026-08-27T00:00:00Z'")}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Archivos subidos/modificados HOY (27 de agosto) en Google Drive: ${allFiles.length}\n`);

  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } },
    orderBy: { name: 'asc' }
  });

  const matchingDeliveries = [];

  for (const s of g1102Students) {
    const sParts = s.name.toLowerCase().split(' ').filter(p => p.length > 2);
    // Find best match among today's files
    const studentFiles = allFiles.filter(f => {
      if (f.mimeType === 'application/vnd.google-apps.folder') return false;
      const fn = f.name.toLowerCase();
      return sParts.some(p => fn.includes(p));
    });

    if (studentFiles.length > 0) {
      studentFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
      const bestFile = studentFiles[0];
      matchingDeliveries.push({
        studentId: s.id,
        studentName: s.name,
        fileId: bestFile.id,
        fileName: bestFile.name,
        fileUrl: bestFile.webViewLink,
        submittedAt: bestFile.modifiedTime
      });
    }
  }

  console.log(`=== ENTREGAS ENCONTRADAS PARA 11-02 HOY (${matchingDeliveries.length}/${g1102Students.length}) ===`);
  matchingDeliveries.forEach(d => {
    console.log(`- ${d.studentName} -> "${d.fileName}" | Link: ${d.fileUrl}`);
  });

  // Also check if any files from 11-02 students are in earlier days
  console.log('\n=== ESTUDIANTES DE 11-02 SIN ENTREGA HOY ===');
  const foundStudentIds = new Set(matchingDeliveries.map(d => d.studentId));
  const missingStudents = g1102Students.filter(s => !foundStudentIds.has(s.id));
  missingStudents.forEach(s => {
    console.log(`- ${s.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
