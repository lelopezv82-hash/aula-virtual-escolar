const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findUnique({
    where: { id: '1b0ca9fb-0730-4aba-9b7d-7957aae3ca16' }
  });

  if (!teacher || !teacher.googleRefreshToken) {
    console.error('No se encontró googleRefreshToken para el profesor');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
    process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: teacher.googleRefreshToken
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  console.log('=== BUSCANDO EN GOOGLE DRIVE DEL PROFESOR ===');
  
  // List all recent files in Google Drive
  const res = await drive.files.list({
    pageSize: 100,
    fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink, webContentLink, parents, trashed)',
    orderBy: 'modifiedTime desc',
    q: "trashed = false"
  });

  const files = res.data.files || [];
  console.log(`Total archivos/carpetas encontrados en Drive: ${files.length}\n`);

  // Get students of 11-02
  const g1102Students = await prisma.user.findMany({
    where: { group: { name: '02', grade: { name: '11' } } }
  });
  const studentNames = g1102Students.map(s => s.name.toLowerCase());

  console.log('--- ARCHIVOS RECIENTES EN DRIVE ---');
  files.forEach(f => {
    const isStudentMatch = studentNames.some(name => f.name.toLowerCase().includes(name.split(' ')[0]) || f.name.toLowerCase().includes(name.split(' ')[1] || ''));
    const is1102Match = f.name.includes('11') || f.name.includes('02') || f.name.toLowerCase().includes('excel') || f.name.toLowerCase().includes('taller');
    
    if (isStudentMatch || is1102Match || new Date(f.modifiedTime) > new Date(Date.now() - 7 * 24 * 3600 * 1000)) {
      console.log(`[${f.id}] "${f.name}" | Mime: ${f.mimeType} | Modificado: ${f.modifiedTime} | Link: ${f.webViewLink}`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
