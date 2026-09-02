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

  let allFiles = [];
  let pageToken = null;
  do {
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,parents)&q=${encodeURIComponent("trashed = false and modifiedTime > '2026-08-27T00:00:00Z'")}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Total archivos hoy en Google Drive: ${allFiles.length}`);

  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } },
    orderBy: { name: 'asc' }
  });

  const matchedSubmissions = [];

  for (const s of g1102Students) {
    const cleanStudentName = s.name.toUpperCase().trim();
    
    // Exact name match at the start of filename (e.g. "NAME - filename.ext")
    const matchedFile = allFiles.find(f => {
      if (f.mimeType === 'application/vnd.google-apps.folder') return false;
      const fn = f.name.toUpperCase();
      return fn.startsWith(cleanStudentName) || fn.includes(cleanStudentName);
    });

    if (matchedFile) {
      matchedSubmissions.push({
        studentId: s.id,
        studentName: s.name,
        fileId: matchedFile.id,
        fileName: matchedFile.name,
        fileUrl: matchedFile.webViewLink,
        submittedAt: new Date(matchedFile.modifiedTime)
      });
    }
  }

  console.log(`\n=== ENTREGAS EXACTAS ENCONTRADAS PARA 11-02 (${matchedSubmissions.length}/${g1102Students.length}) ===`);
  matchedSubmissions.forEach((d, idx) => {
    console.log(`${idx + 1}. [${d.studentName}]`);
    console.log(`   Archivo: "${d.fileName}"`);
    console.log(`   Link: ${d.fileUrl}`);
    console.log(`   Fecha: ${d.submittedAt}`);
  });

  console.log('\n=== ESTUDIANTES SIN ARCHIVO HOY ===');
  const foundIds = new Set(matchedSubmissions.map(d => d.studentId));
  g1102Students.filter(s => !foundIds.has(s.id)).forEach(s => console.log(`- ${s.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
