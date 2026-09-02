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
  const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=files(id,name,mimeType,createdTime,modifiedTime,webViewLink)&q=${encodeURIComponent("trashed = false and modifiedTime > '2026-08-27T00:00:00Z'")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const files = data.files || [];

  const targets = ['ACEVEDO', 'MARTINEZ', 'NIETO', 'TORRES', 'JEAN', 'GABRIELA', 'YANDRY', 'MARIA FERNANDA'];
  console.log('Buscando archivos para los 4 estudiantes restantes:');
  files.forEach(f => {
    if (targets.some(t => f.name.toUpperCase().includes(t))) {
      console.log(`- "${f.name}" | Link: ${f.webViewLink}`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
