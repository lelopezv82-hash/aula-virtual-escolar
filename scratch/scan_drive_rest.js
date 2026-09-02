const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAccessToken() {
  const teacher = await prisma.user.findFirst({
    where: { googleRefreshToken: { not: null } }
  });
  if (!teacher) throw new Error('No teacher with googleRefreshToken found');

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
  if (!res.ok) throw new Error('Refresh error: ' + JSON.stringify(data));
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();
  console.log('Token obtenido exitosamente');

  // Search all files on Drive
  const query = encodeURIComponent("trashed = false");
  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=1000&q=${query}&fields=files(id,name,mimeType,createdTime,modifiedTime,webViewLink,parents)`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const driveData = await driveRes.json();
  const files = driveData.files || [];
  console.log(`Total archivos en Google Drive: ${files.length}\n`);

  // Get students of 11-02
  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } }
  });
  const sNames = g1102Students.map(s => s.name);

  console.log('=== BUSCANDO ENTREGAS DE ESTUDIANTES DE 11-02 EN GOOGLE DRIVE ===');
  let matchCount = 0;
  files.forEach(f => {
    const isStudent = sNames.some(name => {
      const parts = name.split(' ').filter(p => p.length > 2);
      return parts.some(p => f.name.toLowerCase().includes(p.toLowerCase()));
    });
    const is1102 = f.name.includes('1102') || f.name.includes('11-02') || f.name.includes('02') || f.name.toLowerCase().includes('excel');

    if (isStudent || is1102) {
      matchCount++;
      console.log(`- [${f.id}] "${f.name}" | Mime: ${f.mimeType} | Modificado: ${f.modifiedTime} | Link: ${f.webViewLink}`);
    }
  });

  console.log(`\nTotal coincidencias en Drive: ${matchCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

