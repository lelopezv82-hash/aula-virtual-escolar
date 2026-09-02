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

  // Get all files from 11-02 students
  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } }
  });

  console.log(`Buscando archivos en Google Drive para los ${g1102Students.length} estudiantes de 11-02...`);

  // Query Google Drive
  let allFiles = [];
  let pageToken = null;
  do {
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,parents)&q=${encodeURIComponent("trashed = false")}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Total archivos en Drive: ${allFiles.length}`);

  const studentFilesMap = {};

  for (const s of g1102Students) {
    const sParts = s.name.toLowerCase().split(' ').filter(p => p.length > 2);
    const matched = allFiles.filter(f => {
      if (f.mimeType === 'application/vnd.google-apps.folder') return false;
      const fn = f.name.toLowerCase();
      return sParts.every(p => fn.includes(p)) || (sParts.slice(0, 2).every(p => fn.includes(p)) && (fn.includes('11') || fn.includes('excel') || fn.includes('taller') || fn.includes('02')));
    });

    studentFilesMap[s.id] = {
      name: s.name,
      files: matched
    };
  }

  console.log('\n=== RESULTADOS DE ARCHIVOS ENCONTRADOS PARA 11-02 ===');
  let totalFound = 0;
  for (const [sId, info] of Object.entries(studentFilesMap)) {
    console.log(`\nEstudiante: ${info.name}`);
    if (info.files.length === 0) {
      console.log('  (Sin archivos específicos encontrados en Drive)');
    } else {
      totalFound += info.files.length;
      info.files.forEach(f => {
        console.log(`  - [${f.id}] "${f.name}" | Modificado: ${f.modifiedTime} | Link: ${f.webViewLink}`);
      });
    }
  }

  console.log(`\nTotal archivos recuperados para estudiantes de 11-02: ${totalFound}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
