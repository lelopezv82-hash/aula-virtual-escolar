const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const taskId = '572c326e-82ff-41a2-a02e-a22de14ec022'; // Tarea para 11-02

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
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink)&q=${encodeURIComponent("trashed = false and modifiedTime > '2026-08-27T00:00:00Z'")}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Buscando archivos entregados hoy para restaurar... (${allFiles.length} en Drive)`);

  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } },
    orderBy: { name: 'asc' }
  });

  let restoredCount = 0;

  for (const s of g1102Students) {
    const cleanStudentName = s.name.toUpperCase().trim();
    
    const matchedFile = allFiles.find(f => {
      if (f.mimeType === 'application/vnd.google-apps.folder') return false;
      const fn = f.name.toUpperCase();
      return fn.startsWith(cleanStudentName) || fn.includes(cleanStudentName);
    });

    if (matchedFile) {
      console.log(`Restaurando entrega para: ${s.name} -> "${matchedFile.name}"`);
      
      await prisma.submission.upsert({
        where: {
          taskId_studentId: {
            taskId,
            studentId: s.id
          }
        },
        create: {
          taskId,
          studentId: s.id,
          fileUrl: matchedFile.webViewLink,
          status: 'SUBMITTED',
          submittedAt: new Date(matchedFile.modifiedTime),
          gdriveEmail: 'lelopezv22@iemonsenordiazplata.edu.co'
        },
        update: {
          fileUrl: matchedFile.webViewLink,
          status: 'SUBMITTED',
          submittedAt: new Date(matchedFile.modifiedTime),
          gdriveEmail: 'lelopezv22@iemonsenordiazplata.edu.co'
        }
      });

      restoredCount++;
    }
  }

  console.log(`\n¡ÉXITO! Se restauraron ${restoredCount} entregas con sus archivos originales para el grupo 11-02.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

